# Tasks: Math Practice Platform for Kids

**Input**: Design documents from `specs/001-math-practice-platform/`
**Branch**: `001-math-practice-platform`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/](contracts/)

**Tests**: Test tasks are REQUIRED by constitution (CA-003). All test tasks are marked write-tests-first — run them and confirm they FAIL before writing any implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. MVP scope = Phase 1 + Phase 2 + Phase 3 (US1 only).

## Format: `[ID] [P?] [Story?] Description — file/path`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes exact file path

---

## Phase 1: Setup

**Purpose**: Scaffold project skeleton, install dependencies, configure tooling. No application logic.

- [x] T001 Scaffold backend directory tree per plan.md project structure — `backend/app/api/v1/`, `backend/app/services/`, `backend/app/integrations/`, `backend/app/models/`, `backend/app/schemas/`, `backend/prompts/`, `backend/tests/unit/`, `backend/tests/integration/`, `backend/tests/contract/`
- [x] T002 [P] Scaffold frontend Vite + React 18 project and install all dependencies (react-sketch-canvas, tailwindcss, vitest, @testing-library/react) — `frontend/package.json`
- [x] T003 [P] Configure ruff and mypy for backend linting and type checking — `backend/pyproject.toml`
- [x] T004 [P] Configure Tailwind CSS 3 PostCSS pipeline — `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- [x] T005 [P] Configure jsconfig.json for tsc --checkJs type checking and ESLint for frontend — `frontend/jsconfig.json`, `frontend/.eslintrc.cjs`
- [x] T006 [P] Create root `docker-compose.yml` wiring backend (port 8000) and frontend (port 5173) services — `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`

**Checkpoint**: Project installs cleanly — `pip install -r backend/requirements.txt` and `cd frontend && npm install` both succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story. No user story task should begin until this phase is done.

**⚠️ CRITICAL**: Unblocks all user story phases. Complete this phase before opening any story branch.

- [x] T007 Create `backend/app/config.py` loading `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `CORS_ORIGINS` from environment via pydantic-settings `BaseSettings`
- [x] T008 [P] Create `backend/app/main.py` with FastAPI app instance, CORS middleware using `CORS_ORIGINS` from config, and v1 APIRouter mount at `/api/v1` — `backend/app/main.py`
- [x] T009 [P] Create `frontend/src/main.jsx` as React entry point with a `<div id="theme-root">` wrapper element that theme CSS variables will be applied to — `frontend/src/main.jsx`
- [x] T010 [P] Create `frontend/src/themes/dandysWorld.js` exporting a `theme` object with all CSS custom property name→value pairs for the Dandy's World palette (colours, typography, border-radius tokens) — `frontend/src/themes/dandysWorld.js`
- [x] T011 [P] Update `frontend/tailwind.config.js` to reference all brand tokens as `var(--color-*)`, `var(--font-*)` etc. so Tailwind classes consume CSS custom properties — `frontend/tailwind.config.js`
- [x] T012 [P] Create `frontend/src/components/ErrorBanner.jsx` — shared themed error message card with a retry button; accepts `message` and `onRetry` props — `frontend/src/components/ErrorBanner.jsx`
- [x] T013 [P] Create `frontend/src/context/SessionContext.jsx` as a full skeleton: define all `SessionState` fields (`screen`, `ageGroup`, `selectedTopics`, `questionCount`, `questions`, `funFacts`, `answers`, `evaluationResult`, `error`) with initial values and context provider — `frontend/src/context/SessionContext.jsx`
- [x] T070 Create `frontend/src/app/App.jsx` screen router: reads `screen` from `SessionContext` and renders — `home` → `HomeScreen`, `loading` → `LoadingScreen` (with `funFacts` from context), `practice` → `PracticePage`, `evaluating` → `LoadingScreen` (reuses shared component, satisfying CA-004 — fixes H2), `dashboard` → `Dashboard`; update `frontend/src/main.jsx` to render `<SessionProvider><App /></SessionProvider>` — `frontend/src/app/App.jsx`, `frontend/src/main.jsx` (depends on T009, T013)

**Checkpoint**: `uvicorn backend.app.main:app --reload` starts with no errors. `cd frontend && npm run dev` starts with no errors. Theme wrapper div is present in the DOM. `App.jsx` renders `HomeScreen` on initial load.

---

## Phase 3: User Story 1 — Session Setup (Priority: P1) 🎯 MVP

**Goal**: Student can open the home page, choose an age group, select one or more topics, accept or change the question count, and click Start Practice to advance to the loading screen. Topic list is extensible with no code changes to session flow.

**Independent Test**: Open the app, select "Vedic Maths", leave question count at 30, click Start Practice — the screen transitions to `loading`. Attempting to click Start Practice with no topic selected shows a validation message. Fully testable before question generation is implemented by mocking the API call to resolve immediately.

### Tests for User Story 1 (write first — confirm they FAIL) ⚠️

- [x] T014 [P] [US1] Write Vitest unit test: `TopicSelector` renders all topics from config, shows none pre-selected, emits selection change — `frontend/src/components/TopicSelector.test.jsx`
- [x] T015 [P] [US1] Write Vitest unit test: `AgeGroupSelector` toggles between "Age 9–10" and "Age 11–12", emits selected value — `frontend/src/components/AgeGroupSelector.test.jsx`
- [x] T016 [P] [US1] Write Vitest unit test: `HomeScreen` Start Practice button is disabled when no topic is selected; enabled and calls `onStart` when at least one topic is selected — `frontend/src/app/HomeScreen.test.jsx`

### Implementation for User Story 1

- [x] T017 [P] [US1] Create `frontend/src/lib/topics.js` exporting a static `TOPICS` array of `Topic` objects (`id`, `displayName`, `enabled`) for: Vedic Maths, Word Problems, Algebra, Volumes — `frontend/src/lib/topics.js`
- [x] T018 [P] [US1] Create `frontend/src/components/AgeGroupSelector.jsx` — two-button toggle between "Age 9–10" and "Age 11–12"; accepts `value` and `onChange` props — `frontend/src/components/AgeGroupSelector.jsx`
- [x] T019 [US1] Create `frontend/src/components/TopicSelector.jsx` — multi-select card grid driven by `TOPICS` from `topics.js`; accepts `selected` array and `onToggle` prop — `frontend/src/components/TopicSelector.jsx` (depends on T017)
- [x] T020 [US1] Update `frontend/src/context/SessionContext.jsx` to add `ageGroup`, `selectedTopics`, `questionCount` state fields and `setAgeGroup`, `toggleTopic`, `setQuestionCount` action dispatchers — `frontend/src/context/SessionContext.jsx`
- [x] T021 [US1] Create `frontend/src/app/HomeScreen.jsx` composing `AgeGroupSelector`, `TopicSelector`, question count number input (default 30), and "Start Practice" button; button disabled if `selectedTopics` is empty; on click dispatches `startSession` action to `SessionContext` — `frontend/src/app/HomeScreen.jsx` (depends on T018, T019, T020)

**Checkpoint**: `HomeScreen` renders in isolation. Topic validation works. Clicking Start Practice with a topic selected transitions `screen` to `"loading"` in context. Tests T014–T016 all pass.

---

## Phase 4: User Story 2 — AI Question Generation + Loading Experience (Priority: P1)

**Goal**: Clicking Start Practice triggers a single backend call that returns all questions and fun facts. A loading screen with animated progress bar and non-repeating rotating fun facts is shown throughout. When complete, the practice page renders automatically.

**Independent Test**: With the backend running and `OPENROUTER_API_KEY` set, click Start Practice → loading screen appears with progress bar and a fun fact → after generation completes, screen transitions to `"practice"` and `questions` is populated in context. Can be tested with a mocked `api.js` returning a fixture response.

### Tests for User Story 2 (write first — confirm they FAIL) ⚠️

- [x] T022 [P] [US2] Write pytest contract test: `POST /api/v1/questions/generate` response body matches `GenerateQuestionsResponse` JSON schema; all required fields present; `questions` non-empty; `fun_facts` has ≥ 10 items — `backend/tests/contract/test_api_contracts.py`
- [x] T023 [P] [US2] Write pytest unit test: `question_service` raises `ValueError` when parsed LLM response is missing any of the 5 mandatory problem types — `backend/tests/unit/test_question_service.py`
- [x] T024 [P] [US2] Write pytest unit test: `question_service` raises `ValueError` when a Vedic Maths question does not match any of the four valid regex patterns — `backend/tests/unit/test_question_service.py`
- [x] T025 [P] [US2] Write pytest unit test: `question_service` returns questions sorted by `difficulty_tier` ascending regardless of input order — `backend/tests/unit/test_question_service.py`
- [x] T026 [P] [US2] Write pytest integration test: `POST /api/v1/questions/generate` with mocked `openrouter.py` returns 200 with a valid `GenerateQuestionsResponse`; returns 503 when OpenRouter mock raises an exception — `backend/tests/integration/test_api_endpoints.py`
- [x] T027 [P] [US2] Write Vitest unit test: `LoadingScreen` displays the first fun fact on mount, advances to the next fact on each rotation interval, never repeats a fact within one set — `frontend/src/components/LoadingScreen.test.jsx`

### Implementation for User Story 2

- [x] T028 [P] [US2] Create `backend/app/schemas/questions.py` with `ProblemType` Literal, `GenerateQuestionsRequest`, `QuestionSchema`, and `GenerateQuestionsResponse` Pydantic v2 models exactly as specified in `data-model.md` — `backend/app/schemas/questions.py`
- [x] T029 [P] [US2] Create `backend/prompts/generate_questions.txt` Jinja2 template: variables `{{ topics }}`, `{{ age_group }}`, `{{ question_count }}`, `{{ facts_count }}`; instructions for 5 mandatory types, ascending difficulty, Vedic patterns with Teen/ReverseTeen definitions, age-group curriculum calibration (Grade 3–4 / Grade 5–6), child-safe output, fun facts count and no-repeat rule, JSON-only output with full schema — `backend/prompts/generate_questions.txt`
- [x] T030 [P] [US2] Create `backend/prompts/fun_facts.txt` Jinja2 template: variables `{{ topics }}`, `{{ age_group }}`, `{{ facts_count }}`; instructions for child-safe, surprising, age-appropriate facts for boys 9–12; topics: science, animals, space, sports, history, technology; no adult content; JSON array output — `backend/prompts/fun_facts.txt`
- [x] T031 [US2] Create `backend/app/integrations/openrouter.py` async wrapper: accepts `prompt` string, calls OpenRouter API with `OPENROUTER_MODEL`, `response_format={"type":"json_object"}`, 30s timeout; raises `LLMServiceError` on API error or timeout — `backend/app/integrations/openrouter.py` (depends on T007)
- [x] T032 [US2] Create `backend/app/services/question_service.py`: render `generate_questions.txt` with Jinja2, call `openrouter.py`, parse JSON into `GenerateQuestionsResponse`, validate all 5 problem types present (retry up to 2x on failure), validate Vedic patterns by regex when applicable, sort questions by `difficulty_tier` ascending — `backend/app/services/question_service.py` (depends on T028, T029, T030, T031)
- [x] T033 [US2] Create `backend/app/api/v1/questions.py` route handler for `POST /api/v1/questions/generate`; returns 503 with detail message when `LLMServiceError` is raised after retries; register route on v1 router in `backend/app/main.py` — `backend/app/api/v1/questions.py` (depends on T032)
- [x] T034 [P] [US2] Add `generateQuestions(topics, ageGroup, questionCount)` async function to `frontend/src/lib/api.js` calling `POST /api/v1/questions/generate` — `frontend/src/lib/api.js`
- [x] T035 [US2] Create `frontend/src/components/LoadingScreen.jsx`: Tailwind animated indeterminate progress bar; cycles through `funFacts` array with `setInterval` (no repeats per cycle); accepts `funFacts` prop — `frontend/src/components/LoadingScreen.jsx` (depends on T010, T011)
- [x] T036 [US2] Update `frontend/src/context/SessionContext.jsx` with `startSession` action: transition `screen` to `"loading"`, call `api.generateQuestions`, on success store `questions` and `funFacts` and transition to `"practice"`, on failure set `error` with `retryFn` preserving `ageGroup`/`selectedTopics`/`questionCount` — `frontend/src/context/SessionContext.jsx` (depends on T034, T035)

**Checkpoint**: Backend unit tests T023–T025 pass. Backend integration test T026 passes. Frontend: `LoadingScreen` shows facts without repeats (T027 passes). Full manual flow: Start Practice → loading screen with facts → practice screen populated with questions.

---

## Phase 5: User Story 3 — Answering Questions on the Practice Page (Priority: P1)

**Goal**: All generated questions appear on a single scrollable page. Each question has an independent freehand sketch canvas. A per-question toggle switches to text input. Strokes survive browser window resize.

**Independent Test**: Load the practice page with 30 fixture questions. Draw on canvases for questions 1, 5, and 30. Toggle question 10 to text mode and type an answer. Resize the browser window — strokes on questions 1, 5, 30 must be preserved and correctly positioned. Toggle question 10 back to sketch. All other questions are unaffected throughout. Testable without backend submission.

### Tests for User Story 3 (write first — confirm they FAIL) ⚠️

- [x] T037 [P] [US3] Write Vitest unit test: `SketchCanvas` exports paths before resize, receives new width, restores paths via `loadPaths` after resize — `frontend/src/components/SketchCanvas.test.jsx`
- [x] T038 [P] [US3] Write Vitest unit test: `QuestionCard` in sketch mode renders `SketchCanvas`; toggling to text mode renders `<textarea>`; canvas and textarea state are independent between two separate `QuestionCard` instances — `frontend/src/components/QuestionCard.test.jsx`
- [x] T039 [P] [US3] Write Vitest unit test: `PracticePage` renders exactly the number of `QuestionCard` components that matches the `questions` array length; Submit button is present in the document — `frontend/src/app/PracticePage.test.jsx`

### Implementation for User Story 3

- [x] T040 [US3] Create `frontend/src/components/SketchCanvas.jsx`: wraps `ReactSketchCanvas`; attaches `ResizeObserver` to container div; on width change > 4px threshold, calls `exportPaths()`, updates width state, then calls `loadPaths(savedPaths)` in a `useEffect`; exposes `canvasRef` via `forwardRef` — `frontend/src/components/SketchCanvas.jsx`
- [x] T041 [US3] Create `frontend/src/components/QuestionCard.jsx`: renders question number, question text, sketch/text toggle button, and either `SketchCanvas` (default) or `<textarea>` per-question mode state; calls `onAnswerChange(questionId, mode, content)` on any change — `frontend/src/components/QuestionCard.jsx` (depends on T040)
- [x] T042 [US3] Update `frontend/src/context/SessionContext.jsx` with `answers` state (Record keyed by questionId) and `setAnswer(questionId, mode, content)` action — `frontend/src/context/SessionContext.jsx`
- [x] T043 [US3] Create `frontend/src/app/PracticePage.jsx`: renders all `questions` from context as `QuestionCard` list on a single scrollable page; Submit button fixed/visible at bottom; wires `setAnswer` from context to each `QuestionCard`'s `onAnswerChange` prop — `frontend/src/app/PracticePage.jsx` (depends on T041, T042)

**Checkpoint**: Tests T037–T039 all pass. Manual: 30 question cards render, sketch and text modes work independently per card, strokes survive window resize.

---

## Phase 6: User Story 4 — Submission and AI Evaluation (Priority: P2)

**Goal**: Clicking Submit captures all sketch canvases as base64 PNG images and typed text, sends them to the AI evaluator, shows the loading screen during evaluation, and transitions to the dashboard on completion. Empty submission shows a themed confirmation prompt. AI errors are recoverable.

**Independent Test**: With all 30 questions answered (mix of sketch and text), click Submit — the loading screen appears, then the dashboard renders with per-question marks and feedback. With all answers blank, click Submit — confirmation prompt appears; clicking Go Back returns to practice; clicking Continue proceeds to evaluation (all auto-scored 0). Testable with mocked `api.js`.

### Tests for User Story 4 (write first — confirm they FAIL) ⚠️

- [x] T044 [P] [US4] Write pytest contract test: `POST /api/v1/answers/evaluate` response body matches `EvaluateAnswersResponse` JSON schema; `results` has one entry per question; `total_score` ≤ `max_score` — `backend/tests/contract/test_api_contracts.py`
- [x] T045 [P] [US4] Write pytest unit test: `evaluation_service` assigns `marks=0` and a default feedback message to questions with no matching `AnswerSchema` entry, without calling the LLM — `backend/tests/unit/test_evaluation_service.py`
- [x] T046 [P] [US4] Write pytest unit test: `evaluation_service` rejects a malformed base64 URI (not starting with `data:image/png;base64,`) and treats it as unanswered (marks=0) — `backend/tests/unit/test_evaluation_service.py`
- [x] T047 [P] [US4] Write pytest unit test: `evaluation_service` computes `topic_breakdown` correctly from `questions` and `results` arrays without deriving it from LLM output — `backend/tests/unit/test_evaluation_service.py`
- [x] T048 [P] [US4] Write pytest integration test: `POST /api/v1/answers/evaluate` with mocked OpenRouter returns 200 with valid `EvaluateAnswersResponse`; partial answers list (some questions unanswered) returns correct auto-zero entries — `backend/tests/integration/test_api_endpoints.py`
- [x] T049 [P] [US4] Write Vitest unit test: `PracticePage` Submit button, when all answers are empty, shows a themed confirmation dialog with "Continue" and "Go Back" actions — `frontend/src/app/PracticePage.test.jsx`
- [x] T050 [P] [US4] Write Vitest unit test: clicking "Continue" in the empty-submission dialog calls `onSubmit`; clicking "Go Back" dismisses the dialog and returns focus to the practice page — `frontend/src/app/PracticePage.test.jsx`

### Implementation for User Story 4

- [x] T051 [P] [US4] Create `backend/app/schemas/evaluation.py` with `AnswerSchema`, `EvaluateAnswersRequest`, `QuestionResultSchema`, `TopicScoreSchema`, `EvaluateAnswersResponse` Pydantic v2 models exactly as specified in `data-model.md` — `backend/app/schemas/evaluation.py`
- [x] T052 [P] [US4] Create `backend/prompts/evaluate_answers.txt` Jinja2 template: variables `{{ question_text }}`, `{{ answer_mode }}`, `{{ answer_content }}`, `{{ age_group }}`; instructions for 0/1/2 marking scheme, sketch vision handling, text answer handling, 1–2 sentence encouraging child-safe feedback, JSON-only output `{"marks": 0|1|2, "feedback": "..."}` — `backend/prompts/evaluate_answers.txt`
- [x] T053 [US4] Create `backend/app/services/evaluation_service.py`: separate unanswered questions (auto mark=0); validate base64 PNG URIs; run `asyncio.gather` for concurrent per-question LLM calls using `openrouter.py`; parse each result into `QuestionResultSchema`; compute `topic_breakdown` server-side; assemble `EvaluateAnswersResponse` — `backend/app/services/evaluation_service.py` (depends on T031, T051, T052)
- [x] T054 [US4] Create `backend/app/api/v1/evaluate.py` route handler for `POST /api/v1/answers/evaluate`; returns 503 with detail message on `LLMServiceError`; register on v1 router in `backend/app/main.py` — `backend/app/api/v1/evaluate.py` (depends on T053)
- [x] T055 [P] [US4] Add `evaluateAnswers(questions, answers)` async function to `frontend/src/lib/api.js` calling `POST /api/v1/answers/evaluate` — `frontend/src/lib/api.js`
- [x] T056 [US4] Add themed empty-submission confirmation dialog to `frontend/src/app/PracticePage.jsx`: triggered when Submit is clicked and all answers are empty; "Continue" proceeds; "Go Back" dismisses — `frontend/src/app/PracticePage.jsx` (depends on T043)
- [x] T071 [US4] Update `frontend/src/app/PracticePage.jsx` Submit handler to batch-export all sketch-mode canvases to base64 PNG data URIs via `canvasRef.current.exportImage('png')` for each sketch-mode `QuestionCard` immediately before the evaluate API call; collect exported data URIs and use them as the `content` field for each corresponding sketch `AnswerSchema` entry passed to `api.evaluateAnswers` — `frontend/src/app/PracticePage.jsx` (depends on T043, T056)
- [x] T057 [US4] Update `frontend/src/context/SessionContext.jsx` with `submitAnswers` action: transition `screen` to `"evaluating"`, call `api.evaluateAnswers` with the batch-exported answers from T071, on success store `evaluationResult` and transition to `"dashboard"`, on failure set `error` with `retryFn` that preserves all session setup state — `frontend/src/context/SessionContext.jsx` (depends on T055, T071)

**Checkpoint**: Backend unit tests T045–T047 pass. Backend integration test T048 passes. Frontend: empty-submission prompt works (T049–T050 pass). Manual full flow: Submit with answers → loading screen → dashboard renders.

---

## Phase 7: User Story 5 — Performance Dashboard (Priority: P2)

**Goal**: After evaluation, a results dashboard shows per-question marks and feedback, overall score and percentage, a topic-by-topic breakdown, and a Try Again button that returns the student to the home screen.

**Independent Test**: Inject a fixture `evaluationResult` into `SessionContext`. Dashboard renders all question results with correct marks and feedback, correct total and percentage, correct topic breakdown. Clicking Try Again clears results, preserves age group and topics, transitions screen to `"home"`. Testable independently from all backend work.

### Tests for User Story 5 (write first — confirm they FAIL) ⚠️

- [x] T058 [P] [US5] Write Vitest unit test: `ScoreCard` renders question text, marks badge (0, 1, or 2), and feedback string correctly for each marks value — `frontend/src/components/ScoreCard.test.jsx`
- [x] T059 [P] [US5] Write Vitest unit test: `Dashboard` renders total score, percentage, one `ScoreCard` per question result, topic breakdown with score/question count per topic, and a Try Again button — `frontend/src/app/Dashboard.test.jsx`
- [x] T060 [P] [US5] Write Vitest unit test: clicking Try Again dispatches reset action — `evaluationResult`, `questions`, `funFacts`, `answers` cleared; `ageGroup`/`selectedTopics`/`questionCount` preserved; `screen` transitions to `"home"` — `frontend/src/app/Dashboard.test.jsx`

### Implementation for User Story 5

- [x] T061 [US5] Create `frontend/src/components/ScoreCard.jsx`: displays question text, marks badge (0/1/2 with themed colours), and AI feedback paragraph in themed card style — `frontend/src/components/ScoreCard.jsx` (depends on T010, T011)
- [x] T062 [US5] Create `frontend/src/app/Dashboard.jsx`: displays total score and percentage prominently, renders a `ScoreCard` for each entry in `evaluationResult.results`, renders topic breakdown table from `evaluationResult.topicBreakdown`, and a "Try Again" button — `frontend/src/app/Dashboard.jsx` (depends on T061)
- [x] T063 [US5] Update `frontend/src/context/SessionContext.jsx` to add `resetSession` action: clear `questions`, `funFacts`, `answers`, `evaluationResult`, `error`; preserve `ageGroup`, `selectedTopics`, `questionCount`; set `screen` to `"home"` — `frontend/src/context/SessionContext.jsx`

**Checkpoint**: Tests T058–T060 all pass. Manual: full session completes end-to-end — home → loading → practice → evaluating → dashboard → Try Again → home.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: CI gates, environment setup, theme validation, and final end-to-end verification.

- [x] T064 [P] Create `backend/.env.example` with `OPENROUTER_API_KEY=` (blank placeholder), `OPENROUTER_MODEL=google/gemini-2.0-flash`, `CORS_ORIGINS=http://localhost:5173` — `backend/.env.example`
- [x] T065 [P] Write Vitest unit test: `setTheme` helper applies all `dandysWorld.js` CSS variable entries as inline style properties on `#theme-root`; no page reload triggered — `frontend/src/themes/dandysWorld.test.js`
- [x] T066 [P] Write Vitest unit test: `ErrorBanner` renders `message` prop text and calls `onRetry` callback when retry button is clicked — `frontend/src/components/ErrorBanner.test.jsx`
- [x] T067 [P] Add CI workflow: backend stage runs `ruff check backend/` and `mypy backend/` and `pytest`; frontend stage runs `npm run lint`, `npm run type-check`, and `npm run test:run` — `.github/workflows/ci.yml`
- [x] T072 [P] Create original Dandy's World-inspired SVG artwork assets required by FR-017: at minimum one themed character silhouette (`character.svg`) and one repeating background tile (`bg-tile.svg`); store in `frontend/src/assets/`; add asset import paths to `frontend/src/themes/dandysWorld.js` theme token object so components can reference them — `frontend/src/assets/character.svg`, `frontend/src/assets/bg-tile.svg`, `frontend/src/themes/dandysWorld.js` (no copyrighted game assets; original design only)
- [x] T068 Implement `setTheme(themeKey)` helper in `frontend/src/themes/dandysWorld.js` that writes CSS variable entries as `style` properties on `document.getElementById('theme-root')` — `frontend/src/themes/dandysWorld.js`
- [x] T069 Run the quickstart.md validation checklist end-to-end: both services start, full session flow completes, all checklist items pass — `specs/001-math-practice-platform/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational)  ← BLOCKS all stories
        ├─► Phase 3 (US1 — P1)
        ├─► Phase 4 (US2 — P1)  ← depends on Phase 3 context work
        ├─► Phase 5 (US3 — P1)  ← depends on Phase 4 context work
        ├─► Phase 6 (US4 — P2)  ← depends on Phase 5 context work
        └─► Phase 7 (US5 — P2)  ← depends on Phase 6 context work
              └─► Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends on | Reason |
|-------|-----------|--------|
| US1 (Phase 3) | Phase 2 | Needs `SessionContext` skeleton |
| US2 (Phase 4) | Phase 3 US1 | `startSession` action is initiated from `HomeScreen` |
| US3 (Phase 5) | Phase 4 US2 | Practice page renders questions produced by US2 flow |
| US4 (Phase 6) | Phase 3 US3 | Submission captures canvas data built in US3 |
| US5 (Phase 7) | Phase 6 US4 | Dashboard displays `evaluationResult` populated by US4 |

### Within Each User Story

1. Write tests → confirm they FAIL
2. Models / schemas
3. Prompt templates
4. Services / integrations
5. Route handlers / API functions
6. Components
7. Context state wired to components
8. Tests now pass

### Parallel Opportunities Per Story

**Phase 3 (US1)**: T014, T015, T016 (tests) + T017, T018 (config + component) all in parallel  
**Phase 4 (US2)**: T022–T027 (all tests) in parallel; T028, T029, T030 in parallel; T034 in parallel with T031  
**Phase 5 (US3)**: T037, T038, T039 (tests) in parallel  
**Phase 6 (US4)**: T044–T050 (all tests) in parallel; T051, T052 in parallel; T055 in parallel with T053  
**Phase 7 (US5)**: T058, T059, T060 (tests) in parallel; T061 and T062 after tests pass  
**Phase 8**: T064, T065, T066, T067 all in parallel  

---

## Implementation Strategy

**MVP Scope** (deliver first):  
Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) = T001–T021  
Result: Working home page with topic selection, age group, question count, and screen transition to loading. Fully interactive, independently demonstrable.

**Full P1 Delivery**:  
Add Phase 4 (US2) + Phase 5 (US3) = T022–T043  
Result: Complete core loop — setup, question generation with loading screen, full practice page with sketch canvases. Three of five user stories working end-to-end.

**Full Delivery**:  
Add Phase 6 (US4) + Phase 7 (US5) + Phase 8 (Polish) = T044–T072  
Result: Complete platform — submit answers, AI evaluation, results dashboard, CI gates, Docker Compose, theme system validated. (T070–T072 added to resolve analysis findings C2, H1, H2, H3.)
