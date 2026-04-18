# Data Model: Math Practice Platform for Kids

**Phase**: 1 — Design
**Date**: 2026-04-18
**Feature**: [plan.md](plan.md)

All session state is in-memory only (React Context). The backend uses Pydantic v2 schemas for
request/response validation. There are no database models in v1.

---

## Frontend Data Model (React Context — in-memory)

### AppScreen

```js
/** @typedef {"home" | "loading" | "practice" | "evaluating" | "dashboard"} AppScreen */
```

The current screen determines which top-level component renders. Transitions:

```
home ──[Start Practice clicked]──► loading
loading ──[questions ready]──────► practice
practice ──[Submit clicked]──────► evaluating
evaluating ──[results ready]─────► dashboard
dashboard ──[Try Again clicked]──► home
* ──[AI error]────────────────────► (same screen, ErrorBanner shown, retry preserves state)
```

---

### SessionState (React Context shape)

```js
/**
 * @typedef {Object} SessionState
 * @property {AppScreen} screen
 * @property {string} ageGroup            - "9-10" | "11-12"
 * @property {string[]} selectedTopics    - e.g. ["Vedic Maths", "Algebra"]
 * @property {number} questionCount       - default 30
 * @property {Question[]} questions       - populated after generation
 * @property {string[]} funFacts          - populated after generation; non-repeating per session
 * @property {Record<string, Answer>} answers  - keyed by question id
 * @property {EvaluationResult|null} evaluationResult
 * @property {AppError|null} error        - null when no error
 */
```

---

### Question (frontend shape, received from backend)

```js
/**
 * @typedef {Object} Question
 * @property {string} id                  - UUID
 * @property {string} topic               - e.g. "Vedic Maths", "Algebra"
 * @property {"multiplication"|"division"|"fractions"|"mixed_fractions"|"squares"} problemType
 * @property {string} text                - the question prompt shown to the student
 * @property {number} difficultyTier      - integer 1–N, ascending across the session set
 */
```

---

### Answer (frontend shape, built during practice)

```js
/**
 * @typedef {Object} Answer
 * @property {string} questionId
 * @property {"sketch"|"text"} mode
 * @property {string} content             - base64 PNG string (sketch) or plain text (text)
 */
```

---

### EvaluationResult (frontend shape, received from backend)

```js
/**
 * @typedef {Object} EvaluationResult
 * @property {QuestionResult[]} results
 * @property {number} totalScore
 * @property {number} maxScore
 * @property {Record<string, TopicScore>} topicBreakdown  - keyed by topic name
 */

/**
 * @typedef {Object} QuestionResult
 * @property {string} questionId
 * @property {0|1|2} marks
 * @property {string} feedback            - short, encouraging, child-safe explanation
 */

/**
 * @typedef {Object} TopicScore
 * @property {number} score               - total marks awarded for this topic
 * @property {number} maxScore            - maximum possible marks for this topic
 * @property {number} questionCount       - number of questions in this topic
 */
```

---

### AppError (frontend shape)

```js
/**
 * @typedef {Object} AppError
 * @property {string} message             - user-facing themed error message
 * @property {() => void} retryFn         - function to call when retry is pressed
 */
```

---

### Topic (frontend config shape — defines available topics)

```js
/**
 * @typedef {Object} Topic
 * @property {string} id                  - machine identifier e.g. "vedic_maths"
 * @property {string} displayName         - e.g. "Vedic Maths"
 * @property {boolean} enabled            - false hides the topic without removing it
 */
```

Topics are defined in a static config array in `src/lib/topics.js`. Adding a new topic
requires only appending a new object to this array — no changes to session flow, question
display, submission, or evaluation logic.

---

### Theme (frontend config shape)

```js
/**
 * @typedef {Object} Theme
 * @property {string} id                  - e.g. "dandys-world"
 * @property {string} displayName         - e.g. "Dandy's World"
 * @property {Record<string, string>} cssVars  - CSS variable name → value pairs
 */
```

Themes are defined in `src/themes/`. Switching theme calls a `setTheme(themeId)` helper that
writes `cssVars` as inline style properties on the root wrapper element. No page reload needed.

---

## Backend Data Model (Pydantic v2 Schemas)

### backend/app/schemas/questions.py

```python
from pydantic import BaseModel, Field
from typing import Literal
from uuid import UUID

ProblemType = Literal[
    "multiplication", "division", "fractions", "mixed_fractions", "squares"
]

class GenerateQuestionsRequest(BaseModel):
    topics: list[str] = Field(min_length=1, description="Selected topic names")
    age_group: Literal["9-10", "11-12"]
    question_count: int = Field(default=30, ge=1, le=100)

class QuestionSchema(BaseModel):
    id: str                         # UUID string
    topic: str
    problem_type: ProblemType
    text: str
    difficulty_tier: int = Field(ge=1, description="Ascending difficulty rank, 1 = easiest")

class GenerateQuestionsResponse(BaseModel):
    questions: list[QuestionSchema]
    fun_facts: list[str] = Field(
        description="Child-safe fun facts, one per rotation interval"
    )
```

**Validation rules:**
- `topics`: at least 1 item; all items must be non-empty strings
- `age_group`: exactly `"9-10"` or `"11-12"`
- `question_count`: 1–100 inclusive; frontend defaults to 30
- `questions`: must be non-empty; returned in ascending `difficulty_tier` order
- `fun_facts`: minimum 10 items to allow rotation without repeats in typical sessions
- `difficulty_tier`: 1 is the easiest; each question in the returned list must have a tier ≥ the previous

---

### backend/app/schemas/evaluation.py

```python
from pydantic import BaseModel, Field
from typing import Literal
from .questions import QuestionSchema

class AnswerSchema(BaseModel):
    question_id: str
    mode: Literal["sketch", "text"]
    content: str    # base64 PNG data URI (sketch) or plain text string (text)

class EvaluateAnswersRequest(BaseModel):
    questions: list[QuestionSchema]
    answers: list[AnswerSchema]

class QuestionResultSchema(BaseModel):
    question_id: str
    marks: Literal[0, 1, 2]
    feedback: str = Field(description="Short, encouraging, child-safe explanation")

class TopicScoreSchema(BaseModel):
    score: int
    max_score: int
    question_count: int

class EvaluateAnswersResponse(BaseModel):
    results: list[QuestionResultSchema]
    total_score: int
    max_score: int
    topic_breakdown: dict[str, TopicScoreSchema]
```

**Validation rules:**
- `answers`: may be empty or partial (unanswered questions receive 0 marks automatically)
- `content` for `mode="sketch"`: must be a non-empty string; service validates it is a
  valid base64 PNG data URI before passing to LLM
- `marks`: exactly 0, 1, or 2 per the spec marking scheme
- `feedback`: non-empty; must be child-safe (enforced via LLM prompt)
- `topic_breakdown` keys: must match topic names present in the `questions` list

---

## State Transitions

### Session Lifecycle

```
Initial (page load)
  └── screen: "home"
  └── all other fields: empty / null / defaults

After Start Practice clicked
  └── screen: "loading"
  └── ageGroup, selectedTopics, questionCount: set from form

After generation completes (POST /api/v1/questions/generate → 200)
  └── screen: "practice"
  └── questions: populated
  └── funFacts: populated
  └── answers: {} (empty map)

After student inputs answers (per-question, in-place)
  └── answers: progressively populated by question id

After Submit confirmed (POST /api/v1/answers/evaluate → 200)
  └── screen: "evaluating" during the call
  └── screen: "dashboard" on success
  └── evaluationResult: populated

After Try Again clicked
  └── screen: "home"
  └── questions, funFacts, answers, evaluationResult: cleared
  └── ageGroup, selectedTopics, questionCount: preserved for convenience

On AI service error (any API call fails)
  └── screen: unchanged
  └── error: set with message and retryFn
  └── ErrorBanner rendered over current screen
  └── On retry: error cleared, retryFn called
```

---

## Constraints and Business Rules

- **Mandatory problem types**: Every generated question set MUST contain at least one question
  of each type: multiplication, division, fractions, mixed_fractions, squares. This is
  enforced by the prompt template instruction and validated in `question_service.py` before
  returning the response (rejects and re-calls LLM if not satisfied).

- **Vedic Maths patterns**: When "Vedic Maths" is in `topics`, the questions allocated to
  that topic must use only the four defined patterns. Validated in `question_service.py` via
  regex pattern check on generated question text.

- **Difficulty order**: Questions in the returned `questions` array must be sorted by
  `difficulty_tier` ascending. `question_service.py` sorts the array before responding
  regardless of LLM output order.

- **Empty submission confirmation**: Handled entirely on the frontend before any API call is
  made. `PracticePage.jsx` checks if all answers are empty before calling `api.evaluate()`.

- **Unanswered questions**: Questions with no corresponding `AnswerSchema` in the evaluation
  request are treated as 0 marks by `evaluation_service.py` without sending them to the LLM.

- **Content safety**: Both prompt templates include explicit instructions that all output
  (question text, feedback, fun facts) must be child-safe, appropriate for ages 9–12, and
  free from adult themes, violence, or inappropriate language.
