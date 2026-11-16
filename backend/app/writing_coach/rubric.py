"""The teacher's rubric, the extra marking rules, and the sentence counts the app does itself."""

import json
import re
from collections import Counter
from pathlib import Path

# Wording copied from the teacher's PDF. Edit only if the teacher changes it.
RUBRIC: dict = json.loads((Path(__file__).parent / "data" / "rubric.json").read_text(encoding="utf-8"))

CRITERIA_KEYS = ("understanding", "evidence", "communication")

# ---- Rules from the parent's brief. These are NOT in the PDF, so they live here on their own.
NO_EVIDENCE_CRITERION_CAP = "2-"  # no quote or specific evidence: the Evidence criterion stops here
NO_EVIDENCE_OVERALL_CAP = "2+"  # ... and the overall mark stops here
TARGET_SENTENCES = (5, 7)
MODEL_ANSWER_SENTENCES = (4, 8)  # the target, with a little tolerance to avoid pointless retries
REPEATED_OPENER_MIN = 3

_END_OF_SENTENCE = re.compile(r"[.!?]+[\"'”’)]*(?=\s|$)")
_READER_MARKS = re.compile(r"\[\?\]|\[illegible\]")
_WORD = re.compile(r"\w[\w'’-]*")
# A period after these does not end a sentence.
_ABBREVIATIONS = {"mr", "mrs", "ms", "dr", "st", "mt", "lt", "gen", "col", "capt", "gov", "sgt", "rev", "jr", "sr"}


def split_sentences(text: str) -> list[str]:
    """Cut an answer into sentences. Text with no end mark still counts as one sentence."""
    clean = _READER_MARKS.sub("", text)
    sentences, start = [], 0
    for match in _END_OF_SENTENCE.finditer(clean):
        words = _WORD.findall(clean[start:match.start()])
        last = words[-1] if words else ""
        if match.group().startswith(".") and (last.lower() in _ABBREVIATIONS or (len(last) == 1 and last.isupper())):
            continue
        sentences.append(clean[start:match.end()].strip())
        start = match.end()
    sentences.append(clean[start:].strip())
    return [s for s in sentences if _WORD.search(s)]


def _repeated_openers(sentences: list[str]) -> list[str]:
    """Openers used by 3 or more sentences: the first two words if they match, else the first word."""
    openers = [_WORD.findall(s)[:2] for s in sentences]
    first_words = Counter(words[0].lower() for words in openers)
    pairs = Counter(" ".join(words).lower() for words in openers)
    found = []
    for word, count in first_words.items():
        if count < REPEATED_OPENER_MIN:
            continue
        same_start = [words for words in openers if words[0].lower() == word]
        pair = next(
            (w for w in same_start if pairs[" ".join(w).lower()] >= REPEATED_OPENER_MIN and len(w) == 2), None
        )
        opener = " ".join(pair) if pair else same_start[0][0]
        found.append(opener[0].upper() + opener[1:])
    return found


def sentence_stats(text: str) -> dict:
    sentences = split_sentences(text)
    return {"sentenceCount": len(sentences), "repeatedOpeners": _repeated_openers(sentences)}
