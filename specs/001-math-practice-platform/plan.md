# Implementation Plan: Math Practice Platform for Kids

**Branch**: `001-math-practice-platform` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-math-practice-platform/spec.md`

## Summary

An AI-powered math practice web application for children aged 9–11. Students select topics
and an age group on the home screen, then a single LLM call (Gemini 2.0 Flash via OpenRouter)
generates all questions for the session together with a batch of fun facts. Students answer
on a single scrollable page using per-question freehand sketch canvases or a text toggle.
On submission, all answers are sent to the LLM for evaluation and a results dashboard shows
per-question marks, totals, topic breakdown, and encouraging themed feedback. All session state
lives in React Context — no database, no persistence. The Dandy's World-inspired visual theme
is applied via CSS custom properties, switchable at runtime without a page reload.

## Technical Context

**Language/Version**: Python 3.11 (backend); JavaScript ES2022 + JSX (frontend, React 18 + Vite 5)
**Primary Dependencies**: FastAPI 0.110+, pydantic v2, openrouter Python library, Jinja2; React 18, Vite 5, Tailwind CSS 3, react-sketch-canvas 6.2.0
**Storage**: None — all session state in React Context; cleared on browser tab close
**Testing**: pytest + httpx TestClient (backend); Vitest + React Testing Library (frontend)
**Target Platform**: Modern web browsers — Chrome 120+, Safari 17+, Firefox 121+, Edge 120+; touch-capable devices for sketch input
**Project Type**: Full-stack web application (FastAPI backend + React/Vite frontend)
**Performance Goals**: Practice page renders 30 independent canvas elements without scroll jank; theme switch applies in <100ms; loading screen remains interactive during any LLM call duration
**Constraints**: Zero DB persistence; single LLM call per phase (generation/facts combined, evaluation); API key in .env only; all LLM output must be child-safe (ages 9–12)
**Scale/Scope**: Single-user in-browser sessions; 2 backend API endpoints; ~30 questions per session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Code quality | ✅ PASS (documented exception) | Backend: ruff + mypy enforced in CI. Frontend: ESLint + JSDoc annotations with tsc --checkJs. **Exception**: user explicitly chose `.jsx` over `.tsx` — JSDoc + tsc --checkJs satisfies the spirit of CA-001's type-check requirement. Owner: developer. Review at v2. |
| Layering | ✅ PASS | Routes in `backend/app/api/v1/`; business logic in `backend/app/services/`; OpenRouter wrapper in `backend/app/integrations/openrouter.py`; schemas in `backend/app/schemas/`. Frontend: all API access via `src/lib/api.js` — no `fetch()` in components or context. |
| Testing | ✅ PASS | Unit: question type distribution, Vedic pattern validation, difficulty ordering. Integration: full round-trip for both endpoints. Contract: JSON schema assertions for both API responses. Frontend: QuestionCard toggle, LoadingScreen fact rotation, submission confirmation prompt. |
| UX consistency | ✅ PASS | `LoadingScreen.jsx` is the single shared component for both loading phases. `ErrorBanner.jsx` is the single shared error state component. WCAG 2.2 AA required. |
| Performance | ✅ PASS | 30 canvas budget stated. CSS variable theme swap <100ms. Indeterminate Tailwind animation for loading. LLM calls are async; UI thread never blocked. |

**Documented exceptions:**

- Frontend uses `.jsx` (plain JS + JSDoc) instead of `.tsx`. Rationale: user-specified tech
  stack. Mitigation: `tsc --checkJs` in CI. Expiry: v2 planning.

## Project Structure

### Documentation (this feature)

```text
specs/001-math-practice-platform/
├── plan.md                       # This file
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   ├── generate-questions.md     # Phase 1 output
│   └── evaluate-answers.md       # Phase 1 output
└── tasks.md                      # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
project-root/
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app, router registration, CORS middleware
│   │   ├── config.py                    # loads OPENROUTER_API_KEY, OPENROUTER_MODEL from .env
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── questions.py         # POST /api/v1/questions/generate
│   │   │       └── evaluate.py          # POST /api/v1/answers/evaluate
│   │   ├── services/
│   │   │   ├── question_service.py      # question generation + fun facts business logic
│   │   │   └── evaluation_service.py    # answer evaluation business logic
│   │   ├── integrations/
│   │   │   └── openrouter.py            # OpenRouter API wrapper — all LLM calls isolated here
│   │   ├── models/                      # empty in v1 — no ORM models needed
│   │   └── schemas/
│   │       ├── questions.py             # GenerateQuestionsRequest / GenerateQuestionsResponse
│   │       └── evaluation.py            # EvaluateAnswersRequest / EvaluateAnswersResponse
│   ├── prompts/
│   │   ├── generate_questions.txt       # Jinja2 template: question generation prompt
│   │   ├── evaluate_answers.txt         # Jinja2 template: answer evaluation prompt
│   │   └── fun_facts.txt               # Jinja2 template: fun facts generation prompt
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_question_service.py
│   │   │   └── test_evaluation_service.py
│   │   ├── integration/
│   │   │   └── test_api_endpoints.py
│   │   └── contract/
│   │       └── test_api_contracts.py
│   ├── .env                             # OPENROUTER_API_KEY, OPENROUTER_MODEL
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx                  # screen router + theme applier + AnimatedBackground mount
│   │   │   ├── HomeScreen.jsx           # age group + topic select + question count (92%/70% card)
│   │   │   ├── PracticePage.jsx         # questions — 2-col desktop layout (question left, answer right)
│   │   │   └── Dashboard.jsx            # results after evaluation
│   │   ├── components/
│   │   │   ├── AppHeader.jsx            # fixed 64px nav bar; hamburger on mobile (z-40)
│   │   │   ├── AppFooter.jsx            # 3-col footer: logo+tagline, quick links, social icons
│   │   │   ├── AnimatedBackground.jsx   # fixed floating SVG shapes (stars/plus/ring/bolt) — 12 shapes
│   │   │   ├── TopicSelector.jsx        # gradient cards with emoji + description + glow on select
│   │   │   ├── AgeGroupSelector.jsx     # two styled cards: 👦 Age 9–10 / 🧑 Age 11–12
│   │   │   ├── QuestionCard.jsx         # header strip + 2-col body (md+); stacked on mobile
│   │   │   ├── SketchCanvas.jsx         # wraps react-sketch-canvas + resize handling; aspect-[5/2]
│   │   │   ├── FractionText.jsx         # parses "a/b" in strings → stacked fraction SVG-style spans
│   │   │   ├── LoadingScreen.jsx        # shared: animated progress bar + rotating facts + corner chars
│   │   │   ├── ErrorBanner.jsx          # fixed centred modal; backdrop-blur dark overlay
│   │   │   └── ScoreCard.jsx            # per-question result with marks and feedback
│   │   ├── context/
│   │   │   └── SessionContext.jsx       # all session state — flat shape; goHome action; fallback facts seeded on start
│   │   ├── lib/
│   │   │   ├── api.js                   # all fetch() calls to FastAPI — never call directly from components
│   │   │   └── topics.js                # TOPICS array with id, displayName, emoji, description, gradient, glow
│   │   ├── assets/
│   │   │   ├── character-left.svg       # decorative purple robot (home/loading screen corners)
│   │   │   └── character-right.svg      # decorative blue wizard/hat (home/loading screen corners)
│   │   ├── themes/
│   │   │   └── dandysWorld.js           # dark vibrant palette tokens: #0f0a1e bg, yellow/violet/cyan/green accents
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── jsconfig.json                    # enables tsc --checkJs for JSDoc type checking
│   └── package.json
└── docker-compose.yml
```

**Structure Decision**: Full-stack web application. Backend follows constitution layer
conventions strictly with a dedicated `integrations/` layer isolating all LLM calls. Frontend
API access is centralised in `src/lib/api.js`. No database or storage layer in v1.
