"""Render the *teaching* part of each curriculum lesson from the source PDFs.

For every lesson in backend/app/data/curriculum.json this finds the lesson's
pages in resources/*.pdf, keeps the pages up to (not including) the textbook's own
numbered exercises, crops away the e-book chrome (Home/Quit buttons, page footer)
and writes them as JPEGs to frontend/public/lessons/<lesson id>/<n>.jpg. The
number of pages is written back to curriculum.json as `theory_pages`.

Nothing is generated or rewritten: the kid sees the PDF's own pages.

Dev-only tool (PyMuPDF and Pillow are NOT runtime dependencies):
    uv run --with pymupdf --with pillow python backend/scripts/build_lesson_theory.py [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RESOURCES = ROOT / "resources"
CURRICULUM = ROOT / "backend" / "app" / "data" / "curriculum.json"
OUT_DIR = ROOT / "frontend" / "public" / "lessons"

DPI = 110
JPG_QUALITY = 72
TOP_CROP = 24          # pt: the "Home | Quit" e-book buttons
BOTTOM_MARGIN = 4      # pt kept above the page footer
EXERCISE_BANNER = 40   # pt: the 'Practice' banner just above the first exercise
MIN_THEORY_HEIGHT = 90  # pt of real content needed above an exercise cut for the page to count
UNIT_END = re.compile(r"^(Mid-Unit Review|Unit Review|Practice Test|Unit Problem|Investigation)", re.I)
# Units whose exercise numbers are not extractable text use this cue rule instead of the
# numbered-exercise cut. Fallback for units whose exercise numbers are not extractable text (unit 5): a teaching
# page has a worked example, a "Reflect & Share" or a key-idea arrow, and the first page
# after the lesson opening with none of these is taken to be the exercise section.
CUE_STOP_UNITS = {5}
TEACHING_CUES = re.compile(r"Example|Solution|Reflect\s*&\s*Share|➢")
EXERCISE_X_MAX = 260  # exercise numbers sit in the body column (~x=181), not the far margin
EXERCISE_START = re.compile(r"^1\.\s")


def pdf_for_unit(number: int) -> Path:
    for p in RESOURCES.glob("*.pdf"):
        if re.match(rf"^{number}\s", p.name):
            return p
    raise FileNotFoundError(f"no PDF for unit {number} in {RESOURCES}")


def lines_of(page):
    """[(text, x0, y0, y1)] for every text line on the page."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                x0, y0, _x1, y1 = line["bbox"]
                out.append((text, x0, y0, y1))
    return out


def header_ids(lines):
    """Lesson ids whose header ('2.2' in the coloured top bar, y < 45) is on this page."""
    return [t for t, _x, y0, _y1 in lines if y0 < 45 and re.match(r"^\d{1,2}\.\d$", t)]


def footer_top(page, lines):
    """y of the running footer (e.g. '46  UNIT 2: Ratio and Rate' / '2.1 What Is a Ratio? 45')."""
    ys = [y0 for t, _x, y0, _y1 in lines
          if y0 > page.rect.height - 70 and (re.search(r"UNIT \d+:", t) or re.search(r"\s\d{2,3}$", t))]
    return min(ys) if ys else page.rect.height - 30


def exercise_cut(lines):
    """y where the textbook's numbered exercises begin ('1. ...' at the left margin), or None."""
    ys = [y0 for t, x0, y0, _y1 in lines if EXERCISE_START.match(t) and x0 < EXERCISE_X_MAX]
    return min(ys) if ys else None


def _is_blank(px, w, y):
    return all(min(px[x, y]) > 244 for x in range(0, w, 3))


def _is_banner_row(px, w, y):
    """Most of the row is the dark-teal section banner colour (Explore / Connect / Practice)."""
    lo, hi = int(w * 0.25), int(w * 0.9)
    teal = sum(1 for x in range(lo, hi, 3)
               if px[x, y][0] < 130 and px[x, y][1] > px[x, y][0] + 25 and px[x, y][2] > px[x, y][0] + 15)
    return teal > 0.5 * len(range(lo, hi, 3))


def trim(img):
    """Drop trailing blank space and a dangling section banner (e.g. the 'Practice' bar that
    follows the last example). Returns the cropped image, or None if too little is left."""
    px, (w, h) = img.load(), img.size
    bottom = h
    while bottom > 0 and _is_blank(px, w, bottom - 1):
        bottom -= 1
    # A trailing banner: the last banner-coloured row sits within a few px of the bottom of
    # the content (only its soft shadow / anti-aliased edge follows it).
    limit = h  # never pad back into a trimmed banner
    last = next((y for y in range(bottom - 1, max(0, bottom - 40), -1) if _is_banner_row(px, w, y)), None)
    if last is not None:
        top = last
        while top > 0 and _is_banner_row(px, w, top - 1):
            top -= 1
        if last - top >= 8:  # a real bar, not a stray teal row
            limit = bottom = top
            while bottom > 0 and _is_blank(px, w, bottom - 1):
                bottom -= 1
    if bottom < MIN_THEORY_HEIGHT * DPI / 72:
        return None
    return img.crop((0, 0, w, min(limit, bottom + 12)))


def theory_pages_for(doc, lesson_id, use_cue_stop=False):
    """[(page_index, clip_rect)] for the teaching part of one lesson."""
    page_lines = [lines_of(pg) for pg in doc]
    start = next((i for i, ls in enumerate(page_lines) if lesson_id in header_ids(ls)), None)
    if start is None:
        return []

    kept = []
    for i in range(start, len(doc)):
        page, lines = doc[i], page_lines[i]
        if i > start:
            if header_ids(lines):  # next lesson's opening page
                break
            if lines and UNIT_END.match(lines[0][0]):
                break
            if use_cue_stop and not TEACHING_CUES.search(" ".join(t for t, *_ in lines)):
                break  # exercises (or other non-teaching pages) start here
        cut = exercise_cut(lines)
        bottom = footer_top(page, lines) - BOTTOM_MARGIN
        if cut is not None:
            if cut - TOP_CROP >= MIN_THEORY_HEIGHT:
                kept.append((i, pymupdf.Rect(0, TOP_CROP, page.rect.width, cut - EXERCISE_BANNER)))
            break
        kept.append((i, pymupdf.Rect(0, TOP_CROP, page.rect.width, bottom)))
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report pages only; write nothing")
    args = ap.parse_args()

    data = json.loads(CURRICULUM.read_text(encoding="utf-8"))
    total = 0
    for unit in data["units"]:
        doc = pymupdf.open(pdf_for_unit(unit["number"]))
        use_cue_stop = unit["number"] in CUE_STOP_UNITS
        for lesson in unit["lessons"]:
            kept = theory_pages_for(doc, lesson["id"], use_cue_stop)
            lesson["theory_pages"] = len(kept)
            total += len(kept)
            print(f"{lesson['id']:>5} {lesson['title'][:38]:<38} pdf pages {[i + 1 for i, _ in kept]}")
            if args.dry_run:
                continue
            target = OUT_DIR / lesson["id"]
            target.mkdir(parents=True, exist_ok=True)
            for old in target.glob("*.jpg"):
                old.unlink()
            saved = 0
            for i, clip in kept:
                pix = doc[i].get_pixmap(dpi=DPI, clip=clip)
                img = trim(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
                if img is None:
                    continue
                saved += 1
                img.save(target / f"{saved}.jpg", "JPEG", quality=JPG_QUALITY, optimize=True)
            lesson["theory_pages"] = saved

    if not args.dry_run:
        CURRICULUM.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"{total} theory pages across {sum(len(u['lessons']) for u in data['units'])} lessons")
    return 0


if __name__ == "__main__":
    sys.exit(main())
