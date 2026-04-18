# Math Buddy

An AI-powered math practice web app for children aged 9–12. Students pick topics and an age group, answer questions using freehand sketches or typed text, and receive instant AI-marked feedback with a themed results dashboard.

> **Theme**: Dandy's World — applied via CSS custom properties, switchable at runtime without a page reload.

---

## Features

- **AI-generated questions** — a single LLM call (Gemini 2.0 Flash via OpenRouter) creates all session questions plus a batch of fun facts
- **Sketch or text answers** — per-question freehand canvas (react-sketch-canvas) with a text toggle
- **Vision-based evaluation** — sketch images are sent as multimodal vision content to the LLM so handwritten working is read and scored correctly
- **Results dashboard** — per-question marks, totals, topic breakdown, and encouraging feedback
- **Zero persistence** — all session state lives in React Context; cleared on tab close
- **Dandy's World theme** — full CSS variable token set applied to a `#theme-root` wrapper

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.11 |
| Backend framework | FastAPI 0.110+ / Pydantic v2 |
| LLM integration | OpenRouter → `google/gemini-2.0-flash-001` via `openai` SDK |
| Prompt templates | Jinja2 `.txt` files in `backend/prompts/` |
| Frontend framework | React 18 + Vite 5 (JSX, not TSX) |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Sketch canvas | react-sketch-canvas 6.2.0 |
| State management | React Context (flat shape, no persistence) |
| Backend tests | pytest + httpx + pytest-asyncio |
| Frontend tests | Vitest + React Testing Library |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Containers | Docker + docker-compose |

---

## Project Structure

```
math-buddy/
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app, CORS middleware, router mount
│   │   ├── config.py                    # pydantic-settings: OPENROUTER_API_KEY, OPENROUTER_MODEL
│   │   ├── api/v1/
│   │   │   ├── questions.py             # POST /api/v1/questions/generate
│   │   │   └── evaluate.py              # POST /api/v1/answers/evaluate
│   │   ├── services/
│   │   │   ├── question_service.py      # question generation + fun facts logic
│   │   │   └── evaluation_service.py    # answer evaluation; extracts sketch images for vision
│   │   ├── integrations/
│   │   │   └── openrouter.py            # call_llm(prompt, images?) — all LLM calls isolated here
│   │   └── schemas/
│   │       ├── questions.py             # GenerateQuestionsRequest / Response
│   │       └── evaluation.py            # EvaluateAnswersRequest / Response
│   ├── prompts/
│   │   ├── generate_questions.txt       # Jinja2: question generation
│   │   ├── evaluate_answers.txt         # Jinja2: evaluation (references attached sketch images)
│   │   └── fun_facts.txt               # Jinja2: fun facts generation
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── contract/
│   ├── .env                             # OPENROUTER_API_KEY, OPENROUTER_MODEL (not committed)
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx                  # screen router
│   │   │   ├── HomeScreen.jsx           # age group + topic select + question count
│   │   │   ├── PracticePage.jsx         # all questions on one scrollable page
│   │   │   └── Dashboard.jsx            # results after evaluation
│   │   ├── components/
│   │   │   ├── QuestionCard.jsx         # question text + sketch/text toggle
│   │   │   ├── SketchCanvas.jsx         # wraps react-sketch-canvas
│   │   │   ├── LoadingScreen.jsx        # animated progress bar + rotating fun facts
│   │   │   ├── ErrorBanner.jsx          # themed error message + retry action
│   │   │   └── ScoreCard.jsx            # per-question result with marks and feedback
│   │   ├── context/
│   │   │   └── SessionContext.jsx       # all session state (flat shape: { state, ...actions })
│   │   ├── lib/
│   │   │   ├── api.js                   # generateQuestions() + evaluateAnswers() — no fetch in components
│   │   │   ├── topics.js                # TOPICS array
│   │   │   └── fallbackFacts.js         # 15 hardcoded facts shown instantly on loading screen
│   │   └── themes/
│   │       └── dandysWorld.js           # CSS variable tokens + setTheme() helper
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── specs/001-math-practice-platform/    # Spec Kit artefacts (spec, plan, tasks, contracts)
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- An [OpenRouter](https://openrouter.ai) API key with access to `google/gemini-2.0-flash-001`

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

# Copy and fill in your API key
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Docker (full stack)

```bash
docker-compose up --build
```

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Description | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | *(required)* |
| `OPENROUTER_MODEL` | Model ID to use | `google/gemini-2.0-flash-001` |

> **Note**: The model ID must be `google/gemini-2.0-flash-001` — not `google/gemini-2.0-flash` (that ID is invalid on OpenRouter).

---

## API Endpoints

### `POST /api/v1/questions/generate`

Generates a set of math questions and fun facts for a session.

**Request body:**
```json
{
  "age_group": "9-10",
  "topics": ["Multiplication", "Division"],
  "question_count": 5
}
```

### `POST /api/v1/answers/evaluate`

Evaluates submitted answers (text or sketch). Sketch answers are sent to the LLM as vision images.

**Request body:**
```json
{
  "questions": [{ "id": "q1", "topic": "Algebra", "problem_type": "division", "text": "144 ÷ 12", "difficulty_tier": 1 }],
  "answers": [{ "question_id": "q1", "mode": "text", "content": "12" }]
}
```

---

## Running Tests

### Backend (14 tests)

```bash
cd backend
pytest
```

### Frontend (37 tests)

```bash
cd frontend
npm test
```

---

## Architecture Notes

- **LLM calls are isolated** — all calls go through `backend/app/integrations/openrouter.py`. The `call_llm(prompt, images?)` function builds plain text or multimodal (vision) messages depending on whether sketch images are provided.
- **Vision evaluation** — sketch data URIs are extracted in `evaluation_service.py` and passed as `image_url` content to the LLM so handwritten working is read directly, not described as text.
- **No raw `fetch()` in components** — all API access goes through `frontend/src/lib/api.js`.
- **Fun facts seed immediately** — 15 fallback facts from `fallbackFacts.js` are shown the moment the loading screen appears; LLM-generated facts replace them when the API responds.
- **Prompt templates** — stored as Jinja2 `.txt` files in `backend/prompts/`, never inline strings.

---

## Engineering Standards

This repository follows a constitution-first workflow in `.specify/memory/constitution.md`.

- Code quality checks are mandatory: `ruff` + `mypy` (backend), ESLint + `tsc --checkJs` (frontend)
- Automated tests required before merge: unit, integration, and contract
- All API access centralised — no `fetch()` calls in components or context
- All LLM output must be child-safe (ages 9–12)
- UX consistency enforced via shared `LoadingScreen` and `ErrorBanner` components
- WCAG 2.2 AA accessibility required
