# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Math Buddy** is an AI-powered math practice app for children (ages 9–12). Students select topics and age groups, answer questions via sketch or typed text, and receive instant AI-marked feedback with a results dashboard. Session state (questions, answers, results) lives in React Context and is cleared on tab close. Since the grade 7 curriculum work (Oct 2026), child **profiles, attempts and lesson progress persist in Postgres** — see "Grade 7 Curriculum Tracking" below. Postgres is optional: without `MATH_BUDDY_DATABASE_URL` the question/evaluate endpoints still work and the rest return 503.

**Current status**: EduSpark dark design system migration complete (May 2026), deployed to GCP Cloud Run (frontend: `math-buddy-app`, backend: `math-buddy-api`). Grade 7 curriculum tracking (spec: `docs/superpowers/specs/2026-10-20-grade7-curriculum-design.md`) is built on branches `feature/grade7-backend` (Phase 1) and `feature/grade7-frontend` (Phase 2) but **not yet deployed** — Cloud Run still needs a Postgres instance, `MATH_BUDDY_DATABASE_URL` / `MATH_BUDDY_ADMIN_TOKEN` secrets, and `alembic upgrade head`.

---

## Grade 7 Curriculum Tracking

- **Data**: `profiles`, `lesson_progress` (derived; best score never regresses; `completed` once best ≥ 95%, sticky), `practice_attempts` (append-only history for curriculum *and* free practice). Migrations: `cd backend && alembic upgrade head` (needs `MATH_BUDDY_DATABASE_URL`; local Postgres via `docker compose up db`).
- **Curriculum**: static `backend/app/data/curriculum.json` (all 10 units / 58 lessons, grade 7). Edit the file + redeploy to change it.
- **Child API**: `GET /profiles/lookup` (read-only), `POST /profiles`, `GET /curriculum`, `POST /attempts`, `GET /profiles/{id}/lesson-status` (no timestamps/history by design). `POST /questions/generate` accepts optional `lesson_id` → lesson-scoped prompt, `problem_type: "lesson"`.
- **Admin API**: `/api/v1/admin/*`, header `X-Admin-Token` = `MATH_BUDDY_ADMIN_TOKEN` (generate with `python backend/scripts/generate_admin_token.py`). Any auth failure is a generic 404; hidden from `/docs`. Frontend page: `/admin/<token>` (separate route tree in `main.jsx`, never linked from the child app). This is a placeholder for real login — swap only `require_admin` in `backend/app/api/deps.py`.
- **Frontend flow**: `profile` screen first (email lookup → confirm-before-create → identity-only `localStorage` cache `mathBuddy.profile`) → grade sets `ageGroup` (6→`9-10`, 7→`11-12`) and hides the manual selector. Grade 7 also gets `CurriculumPicker` in the setup stage; lessons are a fixed 25 questions (`CURRICULUM_QUESTION_COUNT`). After evaluation the attempt is saved in the background (`saveAttemptWithRetry`: one retry, then a non-blocking banner). Free-practice attempts store `topic_id` as the sorted selected topic IDs joined with `+`.
- **Lesson read-through (theory)**: choosing a curriculum lesson opens the `lesson` screen (`LessonTheory.jsx`) first — the lesson's own textbook pages, one at a time, ending with "Let's start practice" → `startLesson`. The pages are **images cut from the source PDFs, never LLM-generated**: `uv run --with pymupdf --with pillow python backend/scripts/build_lesson_theory.py` renders the teaching part of each lesson (stops before the textbook's numbered exercises; unit 5 uses a cue-based rule via `CUE_STOP_UNITS`) into `frontend/public/lessons/<id>/<n>.jpg` and writes `theory_pages` into `curriculum.json`. The images are **git-ignored on purpose** (copyrighted textbook content) — regenerate them locally and before building the prod image. If a page image is missing the screen says so and still offers practice. Free-practice topics (Vedic Maths etc.) have no source PDF, so they have no read-through. The dashboard offers "Read the lesson again" after a below-95% attempt.

---

## Quick Commands

### Backend (Python/FastAPI)
```bash
cd backend

# Setup once
python -m venv .venv
.venv\Scripts\activate  # Windows: or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env    # Fill in OPENROUTER_API_KEY

# Develop
uvicorn app.main:app --reload --port 8000

# Test
pytest                           # Run all tests
pytest tests/unit/ -v           # Verbose unit tests
pytest tests/integration/ -v    # Integration tests
```

### Frontend (React/Vite)
```bash
cd frontend

# Setup once
npm install

# Develop
npm run dev              # Start dev server at http://localhost:5173

# Test
npm test                # Watch mode
npm run test:run        # Single run (114 tests)

# Quality
npm run lint            # ESLint
npm run type-check      # TypeScript check
npm run build           # Production build → dist/
```

### Full Stack (Docker)
```bash
# From project root
docker-compose up --build

# Backend at http://localhost:8000/docs
# Frontend at http://localhost:5173
```

---

## Architecture

### Backend (FastAPI + OpenRouter)

**Key pattern**: All API logic flows through two endpoints, both using OpenRouter's Gemini 2.0 Flash:

1. **`POST /api/v1/questions/generate`** — Jinja2 prompt template in `backend/prompts/generate_questions.txt` creates a batch of questions + fun facts in one LLM call
2. **`POST /api/v1/answers/evaluate`** — Vision-based evaluation: sketch data URIs extracted from canvas and sent as image content to the LLM so handwritten working is read directly

**File organization**:
- `app/main.py` — FastAPI app setup, CORS middleware, router mounting
- `app/config.py` — pydantic-settings for environment variables (OPENROUTER_API_KEY, OPENROUTER_MODEL, CORS_ORIGINS)
- `app/api/v1/` — endpoint handlers (questions.py, evaluate.py)
- `app/services/` — business logic (question_service.py, evaluation_service.py)
- `app/integrations/openrouter.py` — isolated LLM call function (`call_llm(prompt, images?)`)
- `app/schemas/` — Pydantic request/response models
- `backend/prompts/` — Jinja2 templates (never inline strings)

**Important**: All LLM calls go through `backend/app/integrations/openrouter.py`. This is the single source of truth for model invocation.

### Frontend (React 18 + Tailwind CSS 3)

**State management**: Single React Context (`SessionContext`) with flat shape — no Redux, no Zustand:
- Screen enum: `profile` | `home` | `loading` | `practice` | `evaluating` | `dashboard` | `leaderboard` | `about`
- Actions: `setAgeGroup`, `toggleTopic`, `setQuestionCount`, `startSession`, `startLesson`, `submitAnswers`, `navigateTo`, `resetSession`, `findProfile`, `registerProfile`, `enterProfile`, `switchProfile`
- Session data: questions, answers, evaluation result — all preserved across screens until reset

**No raw `fetch()` in components** — all API calls go through `frontend/src/lib/api.js` (generateQuestions, evaluateAnswers).

**Design system** (EduSpark dark theme):
- CSS tokens in `frontend/src/index.css` — oklch color palette, 29 custom properties
- Tailwind config maps all tokens to utility classes
- Typography: Space Grotesk (display), Inter (body), JetBrains Mono (mono)
- Custom utilities: `.bg-hero-glow`, `.grid-paper`, `.ring-soft`, `.glow-primary`, `.animate-float-slow`, etc.
- All pages styled via token inheritance — no hardcoded colors

**Component hierarchy**:
- `App.jsx` — screen router (home → loading → practice → evaluating → dashboard + leaderboard/about)
- `HomeScreen.jsx` — setup form (age group, topics, question count)
- `PracticePage.jsx` — question cards + sketch/text toggle + progress bar + sticky submit
- `Dashboard.jsx` — split-panel score hero + per-topic breakdown + question review
- `Leaderboard.jsx` — podium (top 3) + ranked table (8 entries, static mock data)
- `About.jsx` — principles + roadmap + CTA
- `AppHeader.jsx` — sticky header with gradient logo, nav links, hamburger menu (mobile)
- `AppFooter.jsx` — footer with quick links
- `QuestionCard.jsx` — two-column layout (question left, sketch/text right)
- `SketchCanvas.jsx` — wraps react-sketch-canvas (unchanged, has own test coverage)
- `LoadingScreen.jsx` — animated progress bar + rotating fun facts
- `ErrorBanner.jsx` — error message + retry action

**Key pattern**: Fallback facts seeded immediately from `fallbackFacts.js` (15 hardcoded) when loading starts; LLM-generated facts replace them when API responds.

---

## State Shapes

### SessionContext State
```javascript
{
  screen: 'home' | 'loading' | 'practice' | 'evaluating' | 'dashboard' | 'leaderboard' | 'about',
  ageGroup: '9-10' | '11-12',
  selectedTopics: string[],        // topic IDs
  questionCount: number,
  questions: Question[],           // from API
  funFacts: string[],
  answers: Record<questionId, { questionId, mode: 'sketch'|'text', content }>,
  evaluationResult: EvaluationResult | null,
  error: { message: string, retryFn: () => void } | null
}
```

### API Request/Response
**Generate Questions**:
```json
// Request
{ "age_group": "9-10", "topics": ["Multiplication"], "question_count": 5 }
// Response
{ "questions": [...], "fun_facts": [...] }
```

**Evaluate Answers**:
```json
// Request
{ "questions": [...], "answers": [...] }
// Response
{ "evaluation": [...], "total_score": 18, "max_score": 20 }
```

---

## Environment Variables

### Backend (`.env`)
```
OPENROUTER_API_KEY=sk-or-v1-...     # Required; get from openrouter.ai
OPENROUTER_MODEL=google/gemini-2.0-flash-001
CORS_ORIGINS=http://localhost:5173,https://math-buddy-app-670264226001.us-central1.run.app
LOG_LEVEL=INFO
LOG_FORMAT=json                     # For Cloud Logging
```

**Important**: The model ID must be `google/gemini-2.0-flash-001`, not `google/gemini-2.0-flash` (invalid on OpenRouter).

### Frontend (Vite)
- `VITE_API_URL` — set at build time, no `.env` file needed locally (vite.config.js proxies `/api` to `http://localhost:8000` in dev mode)

---

## GCP Cloud Run Deployment

**Current URLs**:
- Frontend: https://math-buddy-app-670264226001.us-central1.run.app
- Backend API: https://math-buddy-api-k7zpvj56bq-uc.a.run.app

**Deployment steps** (from `deploy-gcp.md`):
1. Build backend Docker image, push to Artifact Registry, deploy as Cloud Function
2. Build frontend with `VITE_API_URL=$BACKEND_URL`, push, deploy
3. Update backend CORS_ORIGINS env var to include frontend URL

**Key**: Frontend build requires `VITE_API_URL` as a Docker build arg. See `frontend/Dockerfile.prod` and `frontend/nginx.conf` for production setup (two-stage build, Nginx serving static files).

---

## Testing

### Backend (pytest)
- 60 tests covering question generation, evaluation, API contracts, profiles, attempts/mastery, admin auth. Two tests in `tests/unit/test_question_service.py` (`test_missing_mandatory_type_raises`, `test_invalid_vedic_pattern_raises`) fail on `main` already — they patch `openrouter.call_llm` but the service imports from `langchainrouter`. DB tests run on in-memory SQLite (`aiosqlite`); Postgres itself is untested in CI.
- Run: `pytest` from `backend/`
- Tests use `httpx` for async HTTP testing and `pytest-asyncio`

### Frontend (Vitest + React Testing Library)
- 114 tests covering component rendering, user interactions, session state, the profile flow, lesson picker, mastery messaging and the admin page
- Run: `npm run test:run` from `frontend/`
- No snapshot tests — use targeted queries (`getByRole`, `getByText`) to avoid brittle churn
- All new tests required for redesigned components (AppHeader, HomeScreen, Dashboard, Leaderboard, About)

**Key pattern**: Tests import from SessionContext mock or use `render()` + `screen.getByRole()` to assert UI behavior without implementation details.

---

## Recent Changes (EduSpark Migration, May 2026)

All 25 tasks in `specs/002-eduspark-dark-theme/tasks.md` are complete:

1. **CSS tokens** — oklch color palette, 29 custom properties in `index.css`
2. **Tailwind mapping** — full token-to-utility class mapping in `tailwind.config.js`
3. **Google Fonts** — Space Grotesk, Inter, JetBrains Mono loaded in `index.html`
4. **SessionContext extended** — `navigateTo()` action added; `leaderboard` and `about` screens added
5. **AppHeader/AppFooter redesigned** — gradient logo, hamburger menu, nav links with active state
6. **All screens redesigned** — HomeScreen (hero/tracks/method/CTA), PracticePage (setup card), Dashboard (split-panel), QuestionCard (two-column)
7. **Leaderboard & About** — new pages with static mock data and CTAs
8. **Tests updated** — all 37 tests passing; new tests for redesigned components

**Navigation links status**:
- Home, About — enabled
- Practice, Leaderboard — disabled (opacity-50, non-clickable)

---

## Key Files to Know

| File | Purpose |
|---|---|
| `backend/app/integrations/openrouter.py` | All LLM calls (single source of truth) |
| `backend/prompts/*.txt` | Jinja2 prompt templates (never inline) |
| `frontend/src/context/SessionContext.jsx` | Entire session state + actions |
| `frontend/src/lib/api.js` | API client (no fetch in components) |
| `frontend/src/index.css` | CSS tokens + EduSpark utilities |
| `frontend/tailwind.config.js` | Token-to-utility mapping |
| `frontend/src/themes/dandysWorld.js` | CSS variable token export |
| `.specify/constitution.md` | Engineering standards & constraints |
| `specs/002-eduspark-dark-theme/` | Design system spec, tasks, research |
| `deploy-gcp.md` | Cloud Run deployment guide |

---

## Common Patterns

### Adding a new API endpoint
1. Add Pydantic models in `backend/app/schemas/`
2. Create handler in `backend/app/api/v1/`
3. Call `call_llm()` from `backend/app/integrations/openrouter.py` if LLM-dependent
4. Add Jinja2 template in `backend/prompts/` if needed
5. Add React hook + `api.js` client in frontend
6. Call from `SessionContext` action, not directly from components

### Adding a new React screen
1. Create new file in `frontend/src/app/`
2. Add to `AppScreen` typedef in `SessionContext.jsx`
3. Add case to `renderScreen()` switch in `App.jsx`
4. Add `navigateTo()` calls where needed (AppHeader, CTAs)
5. Use `useSession()` hook to read state and dispatch actions
6. Apply EduSpark tokens via Tailwind classes (no hardcoded colors)
7. Write render tests in `*.test.jsx` file

### Styling with EduSpark tokens
- Never use hardcoded colors: use `bg-primary`, `text-accent`, `border-border`, etc.
- Layout foundations: `rounded-2xl`, `ring-soft`, `backdrop-blur-xl`
- Animations: `.animate-float-slow`, `.animate-shimmer`, `.animate-pulse-glow`
- Gradients: `bg-gradient-primary`, `text-gradient-primary`
- Shadows: `.glow-primary`, `.ring-soft-lg`

---

## Development Notes

- **No async/await delays in tests** — Vitest runs in jsdom; use mock functions + `waitFor()`
- **Prompt templates are final** — don't edit inline strings; create `.txt` files and use Jinja2
- **CORS_ORIGINS in env** — set as a comma-separated list for multiple origins (GCP Cloud Run)
- **Mobile-first Tailwind** — all breakpoints are `md:` and above; default styles apply to mobile
- **Accessibility** — all interactive elements have labels; hamburger menu has `aria-expanded` and `aria-label`; 15:1+ contrast ratio required
- **No package upgrades without review** — Tailwind v3 and all versions locked in `package.json`; coordinate with the team before upgrading anything

---

## Resources

- `specs/002-eduspark-dark-theme/plan.md` — Design system architecture & decisions
- `specs/002-eduspark-dark-theme/data-model.md` — Token catalogue, screen enum, data shapes
- `README.md` — User-facing feature overview
- `deploy-gcp.md` — Cloud Run deployment walkthrough
- `backend/.env.example` — Environment variable template
