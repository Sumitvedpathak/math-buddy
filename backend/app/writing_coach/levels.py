"""Ontario achievement-chart levels <-> percent. Single source of truth for the mapping.

Bands: L1 50-59, L2 60-69, L3 70-79, L4 80-100. Inside a band, minus is the bottom
third and plus the top third. Anything under 50% is reported as "1-".
"""

# (level, lowest percent, highest percent), lowest band first.
LEVEL_BANDS: list[tuple[str, int, int]] = [
    ("1-", 0, 52),
    ("1", 53, 56),
    ("1+", 57, 59),
    ("2-", 60, 62),
    ("2", 63, 66),
    ("2+", 67, 69),
    ("3-", 70, 72),
    ("3", 73, 76),
    ("3+", 77, 79),
    ("4-", 80, 84),
    ("4", 85, 92),
    ("4+", 93, 100),
]

LEVELS = [level for level, _, _ in LEVEL_BANDS]
_BANDS = {level: (lo, hi) for level, lo, hi in LEVEL_BANDS}


def level_for_percent(percent: int) -> str:
    percent = max(0, min(100, int(percent)))
    for level, lo, hi in LEVEL_BANDS:
        if lo <= percent <= hi:
            return level
    raise AssertionError("unreachable")  # bands cover 0-100


def band_for_level(level: str) -> tuple[int, int]:
    try:
        return _BANDS[level]
    except KeyError as exc:
        raise ValueError(f"Unknown level: {level!r}") from exc


def percent_matches_level(level: str, percent: int) -> bool:
    lo, hi = band_for_level(level)
    return lo <= percent <= hi


def step_level(level: str, steps: int) -> str:
    """Move along 1- ... 4+ (steps is negative to go down). Stops at the ends."""
    index = LEVELS.index(level) + steps
    return LEVELS[max(0, min(len(LEVELS) - 1, index))]


def clamp_percent_to_level(level: str, percent: int) -> int:
    """Nearest percent inside the level's band (the level is the Reviewer's judgement)."""
    lo, hi = band_for_level(level)
    return max(lo, min(hi, int(percent)))
