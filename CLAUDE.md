# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Math Buddy** is an AI-powered math practice app for children (ages 9–12). Students select topics and age groups, answer questions via sketch or typed text, and receive instant AI-marked feedback with a results dashboard. Session state (questions, answers, results) lives in React Context and is cleared on tab close. Since the grade 7 curriculum work (Oct 2026), child **profiles, attempts and lesson progress persist in Postgres** — see "Grade 7 Curriculum Tracking" below. Postgres is optional: without `MATH_BUDDY_DATABASE_URL` the question/evaluate endpoints still work and the rest return 503.

**Current status**: EduSpark dark design system migration complete (May 2026), deployed to GCP Cloud Run (frontend: `math-buddy-app`, backend: `math-buddy-api`). Grade 7 curriculum tracking (spec: `docs/superpowers/specs/2026-10-20-grade7-curriculum-design.md`) is built on branches `feature/grade7-backend` (Phase 1) and `feature/grade7-frontend` (Phase 2) but **not yet deployed** — Cloud Run still needs a Postgres instance, `MATH_BUDDY_DATABASE_URL` / `MATH_BUDDY_ADMIN_TOKEN` secrets, and `alembic upgrade head`.

---

## Grade 7 Curriculum Tracking

- **Data**: `profiles`, `lesson_progress` (derived; best score never regresses; `completed` once best ≥ 95%, sticky), `practice_attempts` (append-only history for curriculum *and* free practice). Migrations: `cd backend && alembic upgrade head` (needs `MATH_BUDDY_DATABASE_URL`; local Postgres via `docker compose up db`).
- **Curriculum**: static `backend/app/curriculum/data/curriculum.json` (all 10 units / 58 lessons, grade 7). Edit the file + redeploy to change it.
- **Child API**: `GET /profiles/lookup` (read-only), `POST /profiles`, `GET /curriculum`, `POST /attempts`, `GET /profiles/{id}/lesson-status` (no timestamps/history by design). `POST /questions/generate` accepts optional `lesson_id` → lesson-scoped prompt, `problem_type: "lesson"`.
- **Admin API**: `/api/v1/admin/*`, header `X-Admin-Token` = `MATH_BUDDY_ADMIN_TOKEN` (generate with `python backend/scripts/generate_admin_token.py`). Any auth failure is a generic 404; hidden from `/docs`. Frontend page: `/admin/<token>` (separate route tree in `main.jsx`, never linked from the child app). This is a placeholder for real login — swap only `require_admin` in `backend/app/api/deps.py`.
- **Frontend flow**: `profile` screen first (email lookup → confirm-before-create → identity-only `localStorage` cache `mathBuddy.profile`) → grade sets `ageGroup` (6→`9-10`, 7→`11-12`) and hides the manual selector. Grade 7 also gets `CurriculumPicker` in the setup stage; lessons are a fixed 25 questions (`CURRICULUM_QUESTION_COUNT`). After evaluation the attempt is saved in the background (`saveAttemptWithRetry`: one retry, then a non-blocking banner). Free-practice attempts store `topic_id` as the sorted selected topic IDs joined with `+`.
- **Lesson read-through (theory)**: choosing a curriculum lesson opens the `lesson` screen (`LessonTheory.jsx`) first — the lesson's own textbook pages, one at a time, ending with "Let's start practice" → `startLesson`. The pages are **images cut from the source PDFs, never LLM-generated**: `uv run --with pymupdf --with pillow python backend/scripts/build_lesson_theory.py` renders the teaching part of each lesson (stops before the textbook's numbered exercises; unit 5 uses a cue-based rule via `CUE_STOP_UNITS`) into `frontend/public/lessons/<id>/<n>.jpg` and writes `theory_pages` into `curriculum.json`. The images are **git-ignored on purpose** (copyrighted textbook content) — regenerate them locally and before building the prod image. If a page image is missing the screen says so and still offers practice. Free-practice topics (Vedic Maths etc.) have no source PDF, so they have no read-through. The dashboard offers "Read the lesson again" after a below-95% attempt.

---

## Parent sign-in (in progress, branch `feature/account-google-signin`)

Spec: `docs/superpowers/specs/2026-11-15-parent-signin-device-linking-design.md`. Built one step at a time in `backend/app/account/`.
- **Step 1 (done):** `POST /auth/google {id_token, accepted_terms_version?}` checks the Google ID token (`google-auth`, audience = `MATH_BUDDY_GOOGLE_CLIENT_IDS`, `email_verified` required), finds the parent by Google `sub` or creates one (first time needs `accepted_terms_version` = `MATH_BUDDY_TERMS_VERSION`, else `409 consent_required`), and returns a 15-minute JWT (`MATH_BUDDY_JWT_SECRET`). `GET /me` with `Authorization: Bearer`. Tables `parents`, `auth_identities` (migration `0003`). Tests fake `google.oauth2.id_token.verify_oauth2_token`.
- **Step 2 (done):** table `auth_sessions` (one row per signed-in device, migration `0004`). Sign-in also starts a session: web gets the refresh token in cookie `mb_refresh` (HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth), `client:"native"` gets it in the body. `POST /auth/refresh` rotates it (current/prev/older hashes: prev within 30 s = `409 refresh_race`, prev later = lost reply accepted, older = theft, session revoked); idle expiry 60 days (parent), pushed forward on every refresh. `POST /auth/logout` revokes, always 204. Cookie requests also need `X-Requested-With: mathbuddy` and an `Origin` in `CORS_ORIGINS` (else 403). Access tokens carry `sid`.
- **Frontend for steps 1-2 (done):** page `/parent` (`src/app/parent/ParentApp.jsx`, its own route tree in `main.jsx` like `/admin`), linked from the profile screen. `GoogleButton.jsx` loads Google Identity Services directly (client ID from `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local`). `src/lib/auth.js` owns tokens: access token in memory only, one shared refresh per tab (retries once on 409), `authFetch` refreshes and retries once on 401. Needs the Vite `/api` proxy (same origin) for the cookie; production needs the nginx proxy (deploy step).
- **Next:** 3 children, 4 link codes, 5 devices, 6 lock down existing endpoints (ships with the frontend).

## Writing Coach (temporary; grade 7 son only)

Written-answer practice for Language and History, marked against the Ontario achievement chart. **Photos are never stored**: the browser compresses/strips EXIF, the Reader agent reads them in memory, only the verbatim transcript (original + confirmed + word diff) and the review are saved.
- **Backend**: `backend/app/writing_coach/` (self-contained). Three agents in `agents.py` (Generator, Reader, Reviewer): Jinja2 prompts in `writing_coach/prompts/`, pydantic schemas, one retry with a repair note. Per-agent models via env `WC_GENERATOR_MODEL`, `WC_READER_MODEL` (must accept images), `WC_REVIEWER_MODEL` (fall back to `MATH_BUDDY_OPENROUTER_MODEL`). Reader temp 0, Reviewer 0.1. `call_llm_with_usage` in `core/llm.py` adds per-call model/temperature + token counts (token counts are logged, never content).
- **Model answer**: not written by the Generator. `POST /wc/sessions/{id}/model-answer` writes it the first time he opens the section (after the draft review), with the Reviewer's model and its own prompt `model_answer.txt` (the rubric's Level 4, stored History facts or the Language practice text, placeholders for school questions), then saves it in `item.model_answer`. Older sessions keep the one already saved. A separate call from marking, so it does not affect marks.
- **Facts**: History questions are written ONLY from `writing_coach/data/history_strand_{a,b}.json` (**drafts, need parent review**). Language types in `language_types.json`.
- **API**: all under `/api/v1/wc/`. Student routes need header `X-Profile-Id` (a grade 7 profile). Parent routes `/api/v1/wc/parent/*` use the admin token (`X-Admin-Token`); the UI is a "Writing Coach" panel on `/admin/<token>` (list of tests + levels, the three-criteria trend, and settings: strand, focus week).
- **Tables** (`wc_settings`, `wc_sessions`, `wc_submissions`, `wc_reviews`, migration `0002`). Levels: `levels.py` (1- to 4+, percent bands; the Reviewer's level wins, percent is clamped into its band). A correction may fix misread words but not add content (`transcript.py`).
- **Marking** uses the teacher's rubric (`resources/Written Responses Rubric.pdf`, wording copied into `writing_coach/data/rubric.json`). The Reviewer scores Understanding, Evidence and Communication (level, percent, note, nextStep) and says `hasSpecificEvidence`. The app, not the model, works out `overall` in `Review`: the plain average of the three percents, mapped to a level. Rules from the parent's brief, not the PDF, are constants in `writing_coach/rubric.py`: no quote or specific evidence caps Evidence at 2- and overall at 2+ (`capApplied` only if that changed a mark), and the 5-7 sentence target. Sentence count and repeated openers (3+ sentences starting the same way) are counted by the app (`sentence_stats`), and model answers are checked in sentences (4-8 allowed). R/A/C/E/Extend colours are coaching only. Stored reviews from before the rubric have `scores`/`conventions` instead of `criteria`: they keep their overall level and old report layout, count in error tracking, and are left out of the criteria trends. The `rubric_override` column is unused (removal is covered by `alembic downgrade 0001`).
- **Writing errors** (inside `criteria.communication`): up to 10 (original, correction, type, category, rule). Errors not found verbatim in the transcript, or on a word the Reader marked `[?]` (ambiguous capital), are dropped. The Reader copies spelling/capitals exactly; at the confirm step he may fix only misread words: capital-only changes are refused (422) and one-word spelling-like fixes are flagged `suspect` in the stored diff (shown to the parent). A COPS edit pass (`EditPass.jsx`) comes before the photo. Personal error tracker: errors grouped by `category` over his latest 5 reviewed drafts, top recurring 3 on the reminder; the rewrite report checks each draft error (`check_fixed_errors`: fixed / still_there / rewritten). Parent panel: draft marks per criterion for his latest 10 drafts with the lowest marked, common errors, corrections list (`GET /wc/parent/progress`).
- **Deploy note for the rubric change**: deploy backend and frontend together. The previous frontend cannot display a review in the new format.
- **Frontend**: `frontend/src/writing-coach/`, screen `writingCoach`, opened from a small link on the grade 7 setup screen (`PracticePage`). A practice is finished once its results are shown, whether or not he rewrites it: nothing has to be saved, and opening Writing Coach then shows the start page (results stay in My results). Only pending work resumes, via localStorage `mathBuddy.wc.activeSession` or the Continue list: no answer yet, an answer not yet marked, or a rewrite he chose to write (`mathBuddy.wc.rewriting`). The model answer is a section closed by default (`ModelAnswer.jsx`) on the report and in My results. The `next_time` and `model_move` columns are unused.
- **Remove later**: delete `app/writing_coach` (its tables are in `app/writing_coach/models.py`), `src/writing-coach`, `tests/writing_coach`; `alembic downgrade 0001`; remove the router include in `app/main.py` and the `app.writing_coach.models` import in `alembic/env.py`, the `writingCoach` case in `App.jsx`/typedef, the link in `PracticePage`, and the panel in `AdminApp`.
- **Calibration** (real model, costs cents): `WC_CALIBRATE=1 pytest tests/writing_coach/test_calibration.py -s`. 2026-11-02 (old marking): Haiku-class Reviewer scored sample L2/L3/L4 answers 50/68/75, Sonnet-class 54/74/88, so use a Sonnet-class Reviewer. 2026-11-03 (teacher's rubric, Sonnet-class, one run): samples 63/80/87, so the L3 sample landed on the edge of Level 4; model answers marked 84 (History) and 85 (Language).

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
npm run test:run        # Single run (195 tests)

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

### Backend (FastAPI + OpenRouter): feature layout

The backend is organised **by feature** (decided 2026-11-16). Each feature folder holds its own routes, logic, request/response shapes and tables, so a problem with one feature is fixed in one folder:

```
backend/app/
  main.py            app setup, middleware, and one include_router line per feature
  core/              shared plumbing
    config.py          settings from env (pydantic-settings)
    db.py              async engine/session, shared SQLAlchemy Base, JsonType, utcnow
    deps.py            SessionDep, require_admin, require_signed_in (Bearer access token)
    llm.py             ALL LLM calls (call_llm, call_llm_with_usage, LLMServiceError)
    logging_config.py
  account/           /auth/google, /auth/refresh, /auth/logout, GET /me  (parent sign-in; router, service, tokens, schemas, models: Parent, AuthIdentity, AuthSession)
  profiles/          GET /profiles/lookup, POST /profiles          (router, service, schemas, models: Profile)
  curriculum/        GET /curriculum                               (router, service, schemas, data/curriculum.json)
  practice/          POST /questions/generate, POST /answers/evaluate
                     (router, question_service, evaluation_service, schemas, prompts/*.txt)
  results/           POST /attempts, GET /profiles/{id}/lesson-status
                     (router, service, schemas, models: LessonProgress, PracticeAttempt)
  admin/             /admin/*  (router, schemas)
  writing_coach/     /wc/*     (router, agents, schemas, models: Wc*, prompts/, data/)
```

Inside a feature: `router.py` handles HTTP only (URL, request shape, status codes); `service.py` does the work and raises plain Python errors; `schemas.py` holds Pydantic shapes; `models.py` holds tables. A new feature gets its own folder and one line in `main.py`. Alembic's `env.py` imports every `models.py` so migrations see all tables.

**Important**: All LLM calls go through `backend/app/core/llm.py` (LangChain `ChatOpenAI` pointed at OpenRouter). Prompt templates are Jinja2 `.txt` files in the feature's `prompts/` folder, never inline strings.

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
- 222 tests (217 pass, 3 skipped, 2 known failures) covering question generation, evaluation, API contracts, profiles, attempts/mastery, admin auth. Two tests in `tests/unit/test_question_service.py` (`test_missing_mandatory_type_raises`, `test_invalid_vedic_pattern_raises`) fail on `main` already: they expect `LLMServiceError`, but `generate_questions` does not raise for these cases (test and code disagree; not fixed yet). DB tests run on in-memory SQLite (`aiosqlite`); Postgres itself is untested in CI.
- Run: `pytest` from `backend/`
- Tests use `httpx` for async HTTP testing and `pytest-asyncio`

### Frontend (Vitest + React Testing Library)
- 195 tests covering component rendering, user interactions, session state, the profile flow, lesson picker, mastery messaging and the admin page
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
| `backend/app/main.py` | App setup + one router per feature |
| `backend/app/core/llm.py` | All LLM calls (single source of truth) |
| `backend/app/<feature>/prompts/*.txt` | Jinja2 prompt templates (never inline) |
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
1. Pick the feature folder it belongs to (`backend/app/<feature>/`), or create a new one and add one `include_router` line in `main.py`
2. Add Pydantic shapes in `<feature>/schemas.py`, tables in `<feature>/models.py` (and import that file in `alembic/env.py` if new)
3. Put the logic in `<feature>/service.py`; keep `<feature>/router.py` to HTTP in/out only
4. Call `call_llm()` from `backend/app/core/llm.py` if LLM-dependent, with a Jinja2 template in `<feature>/prompts/`
5. Add the client call in `frontend/src/lib/api.js`
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
