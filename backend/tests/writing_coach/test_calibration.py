"""Calibration check: does the real Reviewer rank a Level 2, 3 and 4 answer in order?

Skipped by default because it calls the real model (costs a few cents). Run it with:
    WC_CALIBRATE=1 pytest tests/writing_coach/test_calibration.py -s
The three answers below are SAMPLES WRITTEN FOR THIS TEST (not by the student). Replace
them with real teacher-marked answers when you have them.
"""

import os

import pytest

from app.writing_coach.agents import review_answer

pytestmark = pytest.mark.skipif(
    os.getenv("WC_CALIBRATE") != "1", reason="calls the real model; set WC_CALIBRATE=1"
)

ITEM = {
    "question": "Explain why the Expulsion of the Acadians in 1755 was a turning point for Acadian families.",
    "command_words": ["Explain"],
    "parts": 1,
    "key_terms": ["Acadian", "Expulsion", "deportation", "Mi'kmaw"],
}

# SAMPLE (labelled): Level 2 - correct but brief and general.
LEVEL_2 = "The Acadians were forced to leave Nova Scotia in 1755. It was a bad thing for them. Their farms were taken and they went on ships."

# SAMPLE (labelled): Level 3 - answers fully, specific evidence, justified.
LEVEL_3 = (
    "The Expulsion of the Acadians in 1755 was a turning point because it destroyed the "
    "communities Acadian families had built over a hundred years. Governor Lawrence ordered "
    "thousands of Acadians onto ships after they refused an unconditional oath of allegiance. "
    "This shows that the British valued control over the lives of ordinary families. Families "
    "were split up and sent to different colonies and to France. This shows how the "
    "deportation broke apart the Acadian community. Their farms and dyked marshland were given "
    "to New England Planters, so they could not simply return home."
)

# SAMPLE (labelled): Level 4 - connections, analysis, perspectives, beyond the obvious.
LEVEL_4 = (
    "The Expulsion of the Acadians in 1755 was a turning point for Acadian families because it "
    "ended their way of life and began a long struggle to survive as a people. After refusing an "
    "unconditional oath, Acadians were deported on Governor Lawrence's orders, and their dyked "
    "farms were given to New England Planters. This shows that the British treated the "
    "Acadians' land as more valuable than their rights. Families were split between British "
    "colonies, Britain and France, which shows that the aim was to break up a community the "
    "British feared in wartime. However, the Mi'kmaw, who had been allies of the Acadians, also "
    "lost trusted neighbours, and some Acadians survived only because Mi'kmaw families hid them. "
    "In the long term, Acadians who settled in Louisiana became the Cajuns, which shows that "
    "their culture survived even though the community was scattered. Today, Acadian Day on "
    "August 15 shows that the memory of 1755 is still part of who they are."
)


@pytest.mark.asyncio
async def test_reviewer_ranks_level_2_3_4_in_order():
    percents = []
    for text in (LEVEL_2, LEVEL_3, LEVEL_4):
        review, _ = await review_answer(
            subject="history", kind="draft", item=ITEM, focus="Cite and Explain",
            rubric_override=None, transcript=text,
        )
        percents.append(review.percent)
    print("Level 2 / 3 / 4 sample percents:", percents)
    # Order and spread matter; exact scores vary by model. Observed 2026-11-02:
    #   Haiku-class Reviewer 50 / 68 / 75, Sonnet-class Reviewer 54 / 74 / 88.
    assert percents[0] < percents[1] < percents[2]
    assert percents[0] < 70
    assert percents[2] - percents[0] >= 15
