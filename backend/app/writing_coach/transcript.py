"""Word diff between the Reader's transcript and the student's corrected version.

He may fix words the Reader misread. He may NOT fix his own spelling or capitals at this
stage (the review marks those), and he may not add content. Everything he changes is stored
as a diff so a parent can see it.
"""

import difflib

MAX_EXTRA_WORDS = 5       # corrected text may be at most this many words longer overall
MAX_GROWTH_PER_EDIT = 2   # a single replaced span may grow by at most this many words
SPELLING_FIX_RATIO = 0.8  # a one-word change this similar to the original looks like a spelling fix
READER_MARKERS = ("[illegible]", "[?]")  # words the Reader itself was unsure about


class CorrectionTooLargeError(ValueError):
    pass


class CapitalChangeError(ValueError):
    pass


def _words(text: str) -> list[str]:
    return text.split()


def _resolves_reader_doubt(before: str) -> bool:
    return any(marker in before for marker in READER_MARKERS)


def _looks_like_spelling_fix(before: str, after: str) -> bool:
    b, a = before.split(), after.split()
    if len(b) != 1 or len(a) != 1 or _resolves_reader_doubt(before):
        return False
    return difflib.SequenceMatcher(a=before.lower(), b=after.lower()).ratio() >= SPELLING_FIX_RATIO


def word_diff(original: str, corrected: str) -> list[dict]:
    """Changed spans only: [{"op", "before", "after", "suspect"}].

    `suspect` marks a single-word change that looks like him fixing his own spelling.
    """
    a, b = _words(original), _words(corrected)
    ops = difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
    diff = []
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            continue
        before, after = " ".join(a[i1:i2]), " ".join(b[j1:j2])
        diff.append({
            "op": tag, "before": before, "after": after,
            "suspect": tag == "replace" and _looks_like_spelling_fix(before, after),
        })
    return diff


def check_correction(original: str, corrected: str) -> list[dict]:
    """Return the diff, or raise if the change adds content or only fixes his own capitals."""
    a, b = _words(original), _words(corrected)
    if len(b) - len(a) > MAX_EXTRA_WORDS:
        raise CorrectionTooLargeError(
            "You can only fix words the app misread. Please don't add new sentences."
        )
    diff = word_diff(original, corrected)
    for change in diff:
        before_n = len(change["before"].split())
        after_n = len(change["after"].split())
        if after_n - before_n > MAX_GROWTH_PER_EDIT:
            raise CorrectionTooLargeError(
                "One of your changes adds too many words. Only fix words that were misread."
            )
        if (
            change["op"] == "replace"
            and change["before"] != change["after"]
            and change["before"].lower() == change["after"].lower()
            and not _resolves_reader_doubt(change["before"])
        ):
            raise CapitalChangeError(
                f"“{change['before']}” is how you wrote it. Leave your own capital "
                "letters as they are. The review will point them out."
            )
    return diff


def check_fixed_errors(draft_errors: list[dict], rewrite_text: str) -> list[dict]:
    """Were the conventions errors flagged in the draft fixed in the rewrite?

    status: "fixed" (the correction is there and the error is gone), "still_there" (the same
    mistake is in the rewrite), or "rewritten" (the error is gone but so is the phrase).
    """
    results = []
    for err in draft_errors:
        original, correction = err.get("original", ""), err.get("correction", "")
        if original and original in rewrite_text:
            status = "still_there"
        elif correction and correction in rewrite_text:
            status = "fixed"
        else:
            status = "rewritten"
        results.append({**err, "status": status})
    return results
