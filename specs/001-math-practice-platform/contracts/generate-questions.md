# API Contract: Generate Questions

**Endpoint**: `POST /api/v1/questions/generate`
**Handler**: `backend/app/api/v1/questions.py`
**Service**: `backend/app/services/question_service.py`
**Integration**: `backend/app/integrations/openrouter.py`
**Prompt**: `backend/prompts/generate_questions.txt`

---

## Purpose

Accepts a session configuration (topics, age group, question count) and returns a complete
set of generated questions for the session together with a pool of fun facts for the loading
screen. Called once per session; the practice page is not shown until this call completes.

---

## Request

**Method**: `POST`  
**Path**: `/api/v1/questions/generate`  
**Content-Type**: `application/json`

### Body Schema

```json
{
  "topics": ["Vedic Maths", "Algebra"],
  "age_group": "9-10",
  "question_count": 30
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `topics` | `string[]` | Yes | min 1 item; each item non-empty | Selected topic names |
| `age_group` | `"9-10" \| "11-12"` | Yes | exact match only | Calibrates difficulty |
| `question_count` | `integer` | No (default 30) | 1–100 inclusive | Total questions to generate |

---

## Response

**Status**: `200 OK`  
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
    },
    {
      "id": "7bc91e32-1234-4ab2-c5de-6f78901bcd23",
      "topic": "Algebra",
      "problem_type": "squares",
      "text": "Simplify: (x + 3)²",
      "difficulty_tier": 2
    }
  ],
  "fun_facts": [
    "A snail can sleep for up to 3 years.",
    "Honey never spoils — archaeologists have found 3000-year-old honey in Egyptian tombs.",
    "The Eiffel Tower grows about 15cm taller in summer due to heat expansion."
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `questions` | `QuestionSchema[]` | All questions for the session, ordered ascending by `difficulty_tier` |
| `fun_facts` | `string[]` | Minimum 10 items; child-safe; suitable for ages 9–12 |

### QuestionSchema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `string` | UUID | Unique identifier |
| `topic` | `string` | Non-empty | Matches one of the submitted topics |
| `problem_type` | `enum` | One of: `multiplication`, `division`, `fractions`, `mixed_fractions`, `squares` | Mandatory type categorisation |
| `text` | `string` | Non-empty; child-safe | The question text shown to the student |
| `difficulty_tier` | `integer` | ≥ 1; ascending across the full set | Ordinal difficulty rank |

---

## Business Rules Enforced by the Service

1. **All five mandatory problem types must appear** in every response regardless of topic
   selection. If the LLM response is missing any of the five types, the service rejects and
   retries the call (max 2 retries before returning a 503).
2. **Vedic Maths questions** (when "Vedic Maths" is in `topics`) must use only the four
   defined patterns. Service validates with regex after parsing.
3. **Questions are sorted** by `difficulty_tier` ascending before the response is returned,
   regardless of LLM output order.
4. **All content must be child-safe**. The prompt explicitly instructs the LLM; no additional
   filtering is applied in v1 beyond the prompt constraint.
5. **Fun facts**: minimum 10 returned, child-safe, no repeats within the array.

---

## Error Responses

| Status | Condition |
|--------|-----------|
| `422 Unprocessable Entity` | Request body fails Pydantic validation (missing fields, invalid age_group, etc.) |
| `503 Service Unavailable` | OpenRouter API call fails or returns invalid JSON after retries |

### Error body shape (503)

```json
{
  "detail": "Question generation failed after retries. Please try again."
}
```

---

## LLM Prompt Template (`prompts/generate_questions.txt`)

Template variables: `{{ topics }}`, `{{ age_group }}`, `{{ question_count }}`,
`{{ facts_count }}`

Key instructions embedded in the template:
- Generate exactly `{{ question_count }}` questions covering the provided topics.
- Calibrate difficulty to age group `{{ age_group }}` (9-10 → ~Grade 3–4 Canadian/NCERT;
  11-12 → ~Grade 5–6).
- Every session MUST include at least one question of each type: multiplication, division,
  fractions, mixed fractions, squares — distributed as evenly as possible.
- Difficulty MUST increase with every question — easiest first, hardest last.
- Vedic Maths questions MUST follow one of the four patterns; all four patterns must appear.
- Generate `{{ facts_count }}` fun facts: surprising, unknown, interesting for boys aged
  9–12. Topics: science, animals, space, sports, history, technology. No adult content.
- Return ONLY valid JSON matching the schema. No preamble, no markdown fences.
- All question text and fun facts must be child-safe and age-appropriate.
