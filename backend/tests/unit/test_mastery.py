"""Score-percentage and mastery-threshold math (>= 95% completes a lesson)."""

import pytest

from app.services.attempt_service import compute_score_pct, is_mastered


@pytest.mark.parametrize(
    "score, max_score, expected",
    [
        (25, 25, 100.0),
        (24, 25, 96.0),
        (23, 25, 92.0),
        (19, 20, 95.0),  # exactly 95.0%
        (0, 25, 0.0),
        (1, 3, 33.33),
        (2, 3, 66.66),  # floored, never rounded up
    ],
)
def test_compute_score_pct(score, max_score, expected):
    assert compute_score_pct(score, max_score) == expected


def test_just_below_threshold_is_not_rounded_up_to_mastery():
    # 94.996% must not display as 95.00 and count as mastered.
    pct = compute_score_pct(94.996, 100)
    assert pct == 94.99
    assert not is_mastered(pct)


@pytest.mark.parametrize(
    "pct, mastered",
    [(100.0, True), (96.0, True), (95.0, True), (94.99, False), (92.0, False), (0.0, False)],
)
def test_is_mastered_threshold(pct, mastered):
    assert is_mastered(pct) is mastered
