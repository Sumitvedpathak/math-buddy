"""Shared fixtures for the Writing Coach tests. The sample answers are written for the tests."""

MODEL_ANSWER = "This is one complete sentence of the model answer. " * 6

GOOD_ITEM = {
    "question": "Explain why the Expulsion of the Acadians in 1755 was a turning point.",
    "command_words": ["Explain"],
    "parts": 1,
    "thinking_focus": "Cause and Consequence",
    "background": "In 1755 British officials ordered Acadians to leave Nova Scotia. Thousands were put on ships.",
    "key_terms": ["Acadian", "Expulsion", "deportation", "Mi'kmaw"],
    "extend_hints": ["Think about the Mi'kmaw view.", "Link to refugees today."],
    "model_answer": MODEL_ANSWER,
    "text_kind": "card",
}


def criteria(understanding=("3-", 72), evidence=("3-", 71), communication=("3-", 73), errors=()):
    """The three rubric criteria as the Reviewer returns them. The defaults average to 72 (3-)."""
    def one(mark, name):
        return {"level": mark[0], "percent": mark[1], "note": f"{name} note", "nextStep": f"{name} next step"}
    return {
        "understanding": one(understanding, "Understanding"),
        "evidence": one(evidence, "Evidence"),
        "communication": {**one(communication, "Communication"), "errors": list(errors)},
    }


GOOD_REVIEW = {
    "summary": "You answered clearly. Add one more piece of evidence.",
    "allPartsAnswered": True,
    "missedParts": [],
    "hasSpecificEvidence": True,
    "criteria": criteria(),
    "sentenceTags": [],
    "strengths": ["Clear first sentence."],
    "nextSteps": ["Add a second date.", "Say how it proves your point."],
    "pushQuestion": "How might a Mi'kmaw family see this?",
    "sentenceUpgrade": {"original": "It was bad.", "better": "It tore families apart."},
}

# A review stored before the teacher's rubric was added. These stay in the database as they are.
OLD_REVIEW = {
    "level": "3-",
    "percent": 72,
    "summary": "Older review.",
    "allPartsAnswered": True,
    "missedParts": [],
    "scores": {
        "restate": {"score": 2, "note": ""},
        "answer": {"score": 1, "note": ""},
        "cite": {"score": 1, "note": ""},
        "explain": {"score": 1, "note": ""},
        "extend": {"score": 0, "note": ""},
    },
    "categories": {"knowledge": "k", "thinking": "t", "communication": "c", "application": "a"},
    "sentenceTags": [],
    "strengths": [],
    "nextSteps": [],
    "pushQuestion": "",
    "sentenceUpgrade": {"original": "", "better": ""},
    "conventions": {
        "score": 1,
        "levelAdjustment": -1,
        "errors": [{"original": "grand river", "correction": "Grand River", "type": "capitalization",
                    "category": "capital_place", "rule": "Names of places need capitals"}],
    },
    "contentLevel": "3",
    "contentPercent": 75,
}
