# API Contract: Evaluate Answers

**Endpoint**: `POST /api/v1/answers/evaluate`
**Handler**: `backend/app/api/v1/evaluate.py`
**Service**: `backend/app/services/evaluation_service.py`
**Integration**: `backend/app/integrations/openrouter.py`
**Prompt**: `backend/prompts/evaluate_answers.txt`

---

## Purpose

Accepts the full question set and all student answers (sketch images as base64 PNG or typed
text), evaluates each answer using the LLM, and returns per-question marks, feedback, a
total score, and a topic breakdown. Called once per session on Submit confirmation.

---

## Request

**Method**: `POST`  
**Path**: `/api/v1/answers/evaluate`  
**Content-Type**: `application/json`

### Body Schema

```json
{
  "questions": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "topic": "Vedic Maths",
      "problem_type": "multiplication",
      "text": "Calculate: 13 × 17",
      "difficulty_tier": 1
    }
  ],
  "answers": [
    {
      "question_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "mode": "sketch",
      "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
    }
  ]
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `questions` | `QuestionSchema[]` | Yes | Non-empty | Same question objects returned by generate |
| `answers` | `AnswerSchema[]` | Yes | May be empty | Student answers; unanswered questions auto-score 0 |

### AnswerSchema

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `question_id` | `string` | Yes | Must match a question `id` | Links answer to question |
| `mode` | `"sketch" \| "text"` | Yes | Exact match | Input mode used |
| `content` | `string` | Yes | Non-empty | Base64 PNG data URI (sketch) or plain text |

---

## Response

**Status**: `200 OK`  
**Content-Type**: `application/json`

### Body Schema

```json
{
  "results": [
    {
      "question_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "marks": 2,
      "feedback": "Great work! You got the right answer and showed your working clearly using the Vedic method."
    }
  ],
  "total_score": 2,
  "max_score": 2,
  "topic_breakdown": {
    "Vedic Maths": {
      "score": 2,
      "max_score": 2,
      "question_count": 1
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `results` | `QuestionResultSchema[]` | One entry per question in the submitted `questions` array |
| `total_score` | `integer` | Sum of all `marks` |
| `max_score` | `integer` | Total possible marks (2 × number of questions) |
| `topic_breakdown` | `dict[str, TopicScoreSchema]` | Score summary keyed by topic name |

### QuestionResultSchema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `question_id` | `string` | Matches input question id | Links result to question |
| `marks` | `0 \| 1 \| 2` | Exact values only | 2=correct answer + method; 1=partial; 0=wrong |
| `feedback` | `string` | Non-empty; child-safe; encouraging | Shown on results dashboard |

### TopicScoreSchema

| Field | Type | Description |
|-------|------|-------------|
| `score` | `integer` | Total marks awarded for this topic |
| `max_score` | `integer` | Maximum possible marks for this topic |
| `question_count` | `integer` | Number of questions in this topic |

---

## Marking Scheme

| Marks | Criteria |
|-------|----------|
| **2** | Correct final answer AND correct method/working is visible and shown |
| **1** | Correct final answer only (no working shown), OR correct method but wrong final answer |
| **0** | Incorrect answer with no correct working, OR blank/no attempt |

---

## Business Rules Enforced by the Service

1. **Unanswered questions**: Any question in `questions` that has no matching entry in
   `answers` is automatically scored 0 marks with a neutral child-safe feedback message
   ("No answer was provided for this question."). These do not consume LLM tokens.
2. **Sketch answers**: The `content` field is validated as a `data:image/png;base64,` URI
   before being passed to the LLM. Malformed URIs are treated as unanswered (score 0).
3. **Per-question LLM calls**: Each answered question is evaluated in a separate LLM call
   to avoid context window issues with 30 images. Calls are made concurrently using
   `asyncio.gather`.
4. **Topic breakdown**: Computed server-side from `questions` and `results`; not derived
   from the LLM response.
5. **Content safety**: The prompt instructs the LLM to produce child-safe, encouraging
   feedback appropriate for ages 9–12.

---

## Error Responses

| Status | Condition |
|--------|-----------|
| `422 Unprocessable Entity` | Request body fails Pydantic validation |
| `503 Service Unavailable` | OpenRouter API call fails after retries |

### Error body shape (503)

```json
{
  "detail": "Answer evaluation failed. Please try again."
}
```

---

## LLM Prompt Template (`prompts/evaluate_answers.txt`)

Template variables: `{{ question_text }}`, `{{ answer_mode }}`, `{{ answer_content }}`,
`{{ age_group }}`

Key instructions embedded in the template:
- Question: `{{ question_text }}`
- The student is aged between 9 and 12. Be encouraging and supportive in all feedback.
- If `{{ answer_mode }}` is `sketch`: examine the handwritten working in the provided image.
  Identify the student's method and whether the final answer is correct.
- If `{{ answer_mode }}` is `text`: read the typed answer. Working may be shown inline.
- Award **2 marks** if the final answer is correct AND the method/working is shown and correct.
- Award **1 mark** if the final answer is correct but no working is shown, OR if the working
  is correct but the final answer has a minor error.
- Award **0 marks** if the answer is incorrect and the working does not demonstrate
  understanding.
- Write 1–2 sentences of encouraging, age-appropriate feedback explaining the marks awarded.
- All feedback must be child-safe, positive in tone, and free from adult themes.
- Return ONLY valid JSON: `{"marks": 0|1|2, "feedback": "..."}`. No preamble, no markdown.
