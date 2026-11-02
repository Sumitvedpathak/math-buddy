import pytest
from pydantic import ValidationError

from app.writing_coach.levels import (
    LEVEL_BANDS,
    LEVELS,
    clamp_percent_to_level,
    level_for_percent,
    percent_matches_level,
)
from app.writing_coach.schemas import GeneratedItem, Review
from app.writing_coach.transcript import CorrectionTooLargeError, check_correction, word_diff

from .samples import GOOD_ITEM, GOOD_REVIEW


def test_bands_cover_every_percent_once():
    seen = []
    for level, lo, hi in LEVEL_BANDS:
        seen.extend(range(lo, hi + 1))
    assert sorted(seen) == list(range(0, 101))


@pytest.mark.parametrize(
    "percent,level",
    [(0, "1-"), (49, "1-"), (50, "1-"), (55, "1"), (59, "1+"), (60, "2-"), (65, "2"),
     (69, "2+"), (70, "3-"), (75, "3"), (79, "3+"), (80, "4-"), (90, "4"), (100, "4+")],
)
def test_level_for_percent(percent, level):
    assert level_for_percent(percent) == level


def test_every_level_round_trips():
    for level, lo, hi in LEVEL_BANDS:
        assert level_for_percent(lo) == level
        assert level_for_percent(hi) == level
        assert percent_matches_level(level, lo) and percent_matches_level(level, hi)
    assert len(LEVELS) == 12


def test_clamp_percent_to_level():
    assert clamp_percent_to_level("3", 90) == 76
    assert clamp_percent_to_level("3", 10) == 73
    assert clamp_percent_to_level("3", 75) == 75


def test_review_accepts_valid_json():
    r = Review.model_validate(GOOD_REVIEW)
    assert r.level == "3-" and r.percent == 72 and r.allPartsAnswered


def test_review_pulls_mismatched_percent_into_the_level_band():
    r = Review.model_validate({**GOOD_REVIEW, "level": "2", "percent": 78})
    assert r.level == "2" and r.percent == 66


def test_review_rejects_unknown_level_and_bad_score():
    with pytest.raises(ValidationError):
        Review.model_validate({**GOOD_REVIEW, "level": "5"})
    bad = {**GOOD_REVIEW, "scores": {**GOOD_REVIEW["scores"], "cite": {"score": 3, "note": ""}}}
    with pytest.raises(ValidationError):
        Review.model_validate(bad)


def test_review_missed_parts_force_all_parts_false_and_conventions_capped():
    r = Review.model_validate(
        {**GOOD_REVIEW, "missedParts": ["part b"], "conventions": ["a", "b", "c"]}
    )
    assert r.allPartsAnswered is False
    assert r.conventions == ["a", "b"]


def test_review_drops_tags_not_found_in_transcript():
    r = Review.model_validate(
        {**GOOD_REVIEW, "sentenceTags": [
            {"sentence": "The Acadians were deported.", "tag": "answer"},
            {"sentence": "Invented sentence.", "tag": "cite"},
        ]}
    )
    r.drop_unmatched_tags("The Acadians were deported. They lost farms.")
    assert [t.sentence for t in r.sentenceTags] == ["The Acadians were deported."]


def test_generated_item_validates_lengths():
    GeneratedItem.model_validate(GOOD_ITEM)
    with pytest.raises(ValidationError):
        GeneratedItem.model_validate({**GOOD_ITEM, "model_answer": "too short"})
    with pytest.raises(ValidationError):
        GeneratedItem.model_validate({**GOOD_ITEM, "key_terms": ["a", "b"]})


def test_correction_may_fix_misread_words():
    original = "The Acadians were deprted from Nova Scotia [illegible] 1755"
    diff = check_correction(original, "The Acadians were deported from Nova Scotia in 1755")
    assert {"op": "replace", "before": "deprted", "after": "deported"} in diff


def test_correction_rejects_added_content():
    with pytest.raises(CorrectionTooLargeError):
        check_correction("short answer here", "short answer here " + "and a whole new sentence " * 4)


def test_word_diff_is_empty_when_unchanged():
    assert word_diff("same words", "same words") == []
