# Quickstart: Math Practice Platform for Kids

**Feature**: [plan.md](plan.md)
**Date**: 2026-04-18

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20 LTS+ | [nodejs.org](https://nodejs.org) |
| Docker Desktop | 4.x+ | [docker.com](https://docker.com) — optional, for Docker Compose path |
| Git | any | — |

An OpenRouter API key is required. Get one at [openrouter.ai](https://openrouter.ai).

---

## Environment Setup

### 1. Clone and enter the project

```bash
git clone <repo-url>
cd math-buddy
```

### 2. Create the backend `.env` file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your values:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash
CORS_ORIGINS=http://localhost:5173
```

> The model name is configurable — swap `OPENROUTER_MODEL` to use a different model without
> touching any application code.

---

## Option A: Docker Compose (recommended)

Starts both backend and frontend with a single command.

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend (FastAPI) | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

Stop: `docker-compose down`

---

## Option B: Local Development (no Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

FastAPI will be available at http://localhost:8000  
Interactive API docs: http://localhost:8000/docs

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite dev server starts at http://localhost:5173

---

## Running Tests

### Backend

```bash
cd backend
pytest                          # all tests
pytest tests/unit/              # unit tests only
pytest tests/integration/       # integration tests
pytest tests/contract/          # contract tests
```

> Integration and contract tests make real HTTP calls to the FastAPI TestClient (no live
> network required — the OpenRouter integration is mocked in tests).

### Frontend

```bash
cd frontend
npm test                        # run Vitest in watch mode
npm run test:run                # run once (CI mode)
npm run type-check              # tsc --checkJs via jsconfig.json
```

### Lint and type checks

```bash
# Backend
ruff check backend/
mypy backend/

# Frontend
cd frontend
npm run lint                    # ESLint
npm run type-check              # tsc --checkJs
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/.env` | API key and model configuration |
| `backend/prompts/generate_questions.txt` | Jinja2 template for question generation — edit prompts here |
| `backend/prompts/evaluate_answers.txt` | Jinja2 template for answer evaluation |
| `backend/prompts/fun_facts.txt` | Jinja2 template for fun facts |
| `frontend/src/themes/dandysWorld.js` | Dandy's World CSS variable tokens |
| `frontend/src/lib/api.js` | All frontend→backend API calls |
| `frontend/src/context/SessionContext.jsx` | All session state |
| `frontend/tailwind.config.js` | Tailwind config — reads CSS variables for theme colours |

---

## Validation Checklist

Run through this after first setup to confirm everything works end-to-end:

- [ ] Frontend loads at http://localhost:5173 and displays the themed home screen
- [ ] Clicking Start Practice without selecting a topic shows a validation message
- [ ] Selecting topics, choosing an age group, and clicking Start Practice triggers the
      loading screen (progress bar + rotating fun facts)
- [ ] After generation completes, all questions appear on a single scrollable page
- [ ] Each question has a sketch canvas that accepts mouse/touch drawing
- [ ] The sketch/text toggle switches each question independently
- [ ] Scrolling to the bottom reveals the Submit button
- [ ] Clicking Submit with all answers blank shows the confirmation prompt
- [ ] Confirming submission triggers the evaluation loading screen
- [ ] After evaluation, the results dashboard shows per-question marks, total, and topic
      breakdown
- [ ] Clicking Try Again returns to the home screen

---

## Troubleshooting

**Backend returns 503 on question generation**  
→ Check that `OPENROUTER_API_KEY` is set correctly in `backend/.env`  
→ Verify the model name in `OPENROUTER_MODEL` is available on your OpenRouter account  
→ Check OpenRouter status at https://openrouter.ai

**Frontend can't reach backend (network error)**  
→ Confirm `CORS_ORIGINS=http://localhost:5173` is set in `backend/.env`  
→ Confirm the backend is running on port 8000  
→ Check browser console for the actual error URL

**Sketch canvas strokes lost after window resize**  
→ Confirm `SketchCanvas.jsx` has the `ResizeObserver` export/load path logic in place  
→ Check browser DevTools for `ResizeObserver` errors
