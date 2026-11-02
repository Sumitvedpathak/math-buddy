"""Word diff between the Reader's transcript and the student's corrected version.

The student may fix misread words, not add content, so the correction is checked.
"""

import difflib

MAX_EXTRA_WORDS = 5       # corrected text may be at most this many words longer overall
MAX_GROWTH_PER_EDIT = 2   # a single replaced span may grow by at most this many words


class CorrectionTooLargeError(ValueError):
    pass


def _words(text: str) -> list[str]:
    return text.split()


def word_diff(original: str, corrected: str) -> list[dict]:
    """Changed spans only: [{"op": "replace"|"insert"|"delete", "before": str, "after": str}]."""
    a, b = _words(original), _words(corrected)
    ops = difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
    return [
        {"op": tag, "before": " ".join(a[i1:i2]), "after": " ".join(b[j1:j2])}
        for tag, i1, i2, j1, j2 in ops
        if tag != "equal"
    ]


def check_correction(original: str, corrected: str) -> list[dict]:
    """Return the diff, or raise CorrectionTooLargeError if it adds new content."""
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
    return diff
