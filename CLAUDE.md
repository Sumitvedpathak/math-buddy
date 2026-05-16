# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Math Buddy** is an AI-powered math practice app for children (ages 9–12). Students select topics and age groups, answer questions via sketch or typed text, and receive instant AI-marked feedback with a results dashboard. The app has **zero persistence** — all session state lives in React Context and is cleared on tab close.

**Current status**: Just completed EduSpark dark design system migration (May 2026). All 25 tasks complete. App deployed to GCP Cloud Run (frontend: `math-buddy-app`, backend: `math-buddy-api`).

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
npm run test:run        # Single run (37 tests)

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
- Screen enum: `home` | `loading` | `practice` | `evaluating` | `dashboard` | `leaderboard` | `about`
- Actions: `setAgeGroup`, `toggleTopic`, `setQuestionCount`, `startSession`, `submitAnswers`, `navigateTo`, `resetSession`
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
- 14 tests covering question generation, evaluation, and API contracts
- Run: `pytest` from `backend/`
- Tests use `httpx` for async HTTP testing and `pytest-asyncio`

### Frontend (Vitest + React Testing Library)
- 37 tests covering component rendering, user interactions, and session state
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
