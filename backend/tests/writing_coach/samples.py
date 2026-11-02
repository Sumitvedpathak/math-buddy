"""Shared fixtures for the Writing Coach tests. The sample answers are written for the tests."""

MODEL_ANSWER = " ".join(["word"] * 160)

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

GOOD_REVIEW = {
    "level": "3-",
    "percent": 72,
    "summary": "You answered clearly. Add one more piece of evidence.",
    "allPartsAnswered": True,
    "missedParts": [],
    "scores": {
        "restate": {"score": 2, "note": "Good start."},
        "answer": {"score": 1, "note": "Clear but general."},
        "cite": {"score": 1, "note": "One example."},
        "explain": {"score": 1, "note": "Explain each example."},
        "extend": {"score": 0, "note": "No deeper idea."},
    },
    "categories": {"knowledge": "k", "thinking": "t", "communication": "c", "application": "a"},
    "sentenceTags": [],
    "strengths": ["Clear first sentence."],
    "nextSteps": ["Add a second date.", "Say how it proves your point."],
    "pushQuestion": "How might a Mi'kmaw family see this?",
    "sentenceUpgrade": {"original": "It was bad.", "better": "It tore families apart."},
    "conventions": [],
}
