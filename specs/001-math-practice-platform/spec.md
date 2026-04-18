# Feature Specification: Math Practice Platform for Kids

**Feature Branch**: `001-math-practice-platform`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description — AI-powered math practice website for students aged 9 and 11

---

## Clarifications

### Session 2026-04-18

- Q: The spec used "Grade 9" and "Grade 11" as selector labels but stated student ages as 9 and 11 — which is correct? → A: Students are 9 and 11 years old. Rename selectors to age-appropriate labels ("Age 9–10" and "Age 11–12"). Calibrate curriculum to primary/elementary level (~Grade 3–4 and Grade 5–6).
- Q: What happens when the AI service fails during question generation or answer evaluation? → A: Show a themed in-app error message with a retry button. Preserve the student's setup choices (topics, age group, question count) so no re-entry is needed on retry. No partial session recovery required in v1.
- Q: What happens when a student attempts to submit with all canvases blank and all text fields empty? → A: Show a themed confirmation prompt warning that unanswered questions will score 0, with a "Continue" and "Go Back" action. Submission proceeds only on explicit confirmation.
- Q: How does the sketch canvas behave if the browser window is resized mid-answer? → A: Preserve and scale existing strokes proportionally to the new canvas dimensions on resize. Strokes must not be lost or misaligned after a resize.
- Q: Should the Dandy's World theme use actual game assets or original inspired artwork? → A: Use original assets inspired by the game's colour palette, character style, and aesthetic only. No actual copyrighted game assets may be used.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Session Setup: Topic Selection and Configuration (Priority: P1)

A student arrives at the home page and sees a themed welcome screen. He selects one or more
practice topics from an extensible multi-select list (initial topics: Vedic Maths, Word
Problems, Algebra, Volumes). He enters the number of questions he wants, with a default of
30, and presses **Start Practice**.

**Why this priority**: Without session setup there is no entry point to the platform. This
story is the minimum viable starting point that gates all other stories.

**Independent Test**: A student can open the home page, select topics, accept the default
question count, and be taken to the loading screen. This standalone test delivers a confirmed
working entry flow.

**Acceptance Scenarios**:

1. **Given** the home page is open, **When** the student views the topic list, **Then** all
   available topics are shown and none are pre-selected.
2. **Given** no topic is selected, **When** the student attempts to start a session,
   **Then** a clear validation message prevents progress until at least one topic is chosen.
3. **Given** one or more topics are selected, **When** the student views the question count
   field, **Then** the default value is 30.
4. **Given** topics are selected and a question count is set, **When** the student clicks
   **Start Practice**, **Then** the session proceeds to question generation.
5. **Given** the topic list, **When** a new topic is added to the system data, **Then** it
   appears in the selection UI without any changes to the selection or session flow.

---

### User Story 2 — AI Question Generation with Loading Experience (Priority: P1)

After the student starts a session, the platform calls the AI service to generate all
questions for the session in a single request. While generation is in progress, the student
sees an animated progress bar and one fun fact or trivia item at a time, rotating through a
curated pool. Facts are unknown and genuinely interesting for 9–11 year-old boys and do not
repeat within the same session. Once all questions are ready, the practice page loads.

**Why this priority**: Question generation is the prerequisite for the entire practice flow.
The loading experience determines whether students disengage or stay present.

**Independent Test**: Starting a session triggers generation; the loading screen with progress
bar and non-repeating facts is visible throughout, and the practice page appears after
generation completes.

**Acceptance Scenarios**:

1. **Given** the student has clicked Start Practice, **When** question generation is in
   progress, **Then** an animated progress bar and a fun fact are visible.
2. **Given** the loading screen is shown, **When** each fact rotation interval elapses,
   **Then** a different fact is shown and no fact repeats within the same session.
3. **Given** the loading screen is shown, **When** all questions have been generated,
   **Then** the practice page renders automatically without a manual action from the student.
4. **Given** a question set, **When** questions are evaluated after generation, **Then**
   every session includes questions of type: multiplication, division, fractions, mixed
   fractions, and squares regardless of the topics selected.
5. **Given** question generation runs, **When** questions are produced, **Then** difficulty
   increases progressively from the first question to the last — verifiable by comparing
   expected grade-level complexity of sequential questions.

---

### User Story 3 — Answering Questions on the Practice Page (Priority: P1)

All generated questions appear on a single scrollable page. Each question shows the question
text alongside an independent freehand sketch canvas. The student can draw his working on the
canvas using a mouse or touch input. A per-question toggle lets him switch to a text/keyboard
input field instead. Both modes are independently available for each question and the choice
persists per question until submission.

**Why this priority**: The practice page is the core interaction surface. Freehand sketch
input is the primary differentiating feature of the platform.

**Independent Test**: After loading, the student can view all questions, draw on canvases,
and switch individual questions to text mode. This can be validated without submitting.

**Acceptance Scenarios**:

1. **Given** question generation is complete, **When** the practice page loads, **Then** all
   questions are visible on a single scrollable page.
2. **Given** a question, **When** the student draws on its canvas, **Then** the freehand
   input is captured independently from all other question canvases.
3. **Given** a question in sketch mode, **When** the student activates the toggle,
   **Then** the canvas is replaced by a text input field for that question only.
4. **Given** a question in text mode, **When** the student activates the toggle again,
   **Then** the sketch canvas is restored for that question.
5. **Given** a touch device, **When** the student draws on the canvas, **Then** touch input
   is captured accurately as freehand strokes.
6. **Given** Vedic Maths is among the selected topics, **When** those questions are
   displayed, **Then** all Vedic Maths questions strictly follow one of the four defined
   patterns (Teen × Teen, Teen × Reverse Teen, Reverse Teen × Teen,
   Reverse Teen × Reverse Teen) and all four patterns are represented.

---

### User Story 4 — Submission and AI Evaluation (Priority: P2)

At the bottom of the practice page a **Submit** button is available. On submission, all
answers — sketch canvases captured as images and typed text where applicable — are sent to
the AI service for evaluation. The same loading screen (progress bar + rotating fun facts)
is shown while evaluation runs. When evaluation is complete, the results dashboard is
displayed.

**Why this priority**: Submission and evaluation complete the core learning loop. Without it
the practice session has no feedback.

**Independent Test**: After answering at least one question, the student can press Submit,
see the loading screen, and reach the results dashboard.

**Acceptance Scenarios**:

1. **Given** the student is on the practice page, **When** he scrolls to the bottom,
   **Then** the Submit button is visible.
2. **Given** the student clicks Submit, **When** answers include sketch canvases,
   **Then** each canvas is captured as an image and included in the AI evaluation request.
3. **Given** submission is in progress, **When** evaluation is running, **Then** the same
   animated progress bar and rotating fun facts experience is shown.
4. **Given** evaluation completes, **When** marks are returned, **Then** each question
   receives a score of 0, 1, or 2:
   - 2 marks: correct answer AND correct method/working shown
   - 1 mark: correct answer only, or correct method without final answer
   - 0 marks: incorrect or no attempt
5. **Given** a mix of sketch and text answers, **When** evaluation runs, **Then** the AI
   correctly identifies and evaluates both types per question.

---

### User Story 5 — Performance Dashboard (Priority: P2)

After evaluation, a results dashboard is displayed. It shows the score and marks for each
question, the overall score and percentage, a topic-by-topic breakdown, and themed
encouraging feedback appropriate for the student's age.

**Why this priority**: The dashboard closes the learning loop and provides the motivation to
attempt another session.

**Independent Test**: After a full session is submitted and evaluated, the dashboard loads
and shows per-question marks, totals, and a topic breakdown. This can be validated end-to-end.

**Acceptance Scenarios**:

1. **Given** evaluation is complete, **When** the dashboard loads, **Then** every question
   is listed with its mark (0, 1, or 2) and a brief AI-generated explanation.
2. **Given** the dashboard, **When** the student views it, **Then** the overall score and
   percentage are prominently shown.
3. **Given** questions spanning multiple topics, **When** the breakdown is displayed,
   **Then** score and question count are shown per topic.
4. **Given** any score, **When** feedback is displayed, **Then** it is encouraging,
   age-appropriate, and visually consistent with the active theme.
5. **Given** the dashboard, **When** the student wants another session, **Then** a clear
   action returns him to the home page.

---

### Edge Cases

- When question generation or answer evaluation fails due to an AI service error or network
  issue, the platform shows a themed in-app error message with a retry button. The student's
  session setup (topics, age group, question count) is preserved so no re-entry is required.
- When a student clicks Submit with no answers provided (all canvases blank, all text fields
  empty), the platform shows a themed confirmation prompt warning that unanswered questions
  will score 0 marks. The student can confirm to proceed or go back to answer more questions.
- When the browser window is resized while a student has strokes on a canvas, existing strokes
  are preserved and scaled proportionally to the new canvas dimensions. No strokes are lost
  or misaligned as a result of a resize.
- How does the platform handle a question count that cannot be evenly divided across the five
  mandatory problem types and the selected topics?
- What if a student closes the browser mid-session — is any state recoverable?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an extensible multi-select topic list on the home page
  supporting at least: Vedic Maths, Word Problems, Algebra, Volumes.
- **FR-002**: System MUST prevent session start if no topic is selected, with a clear
  validation message.
- **FR-003**: System MUST default the question count input to 30 and allow the student to
  change it before starting.
- **FR-004**: System MUST generate all questions for a session in a single AI service call
  before the practice page is shown.
- **FR-005**: System MUST display an animated progress bar and rotating non-repeating
  fun facts during question generation and during answer evaluation.
- **FR-006**: System MUST include questions of all five mandatory problem types
  (multiplication, division, fractions, mixed fractions, squares) in every session,
  distributed across the question set regardless of topics selected.
- **FR-007**: System MUST display an age group selector on the home page alongside topic
  selection. The selector MUST offer two options: "Age 9–10" and "Age 11–12" (final UI label
  copy may be themed to match the active visual theme). The selected age group is passed to
  the AI service to calibrate question difficulty and content to primary/elementary school
  level (~Grade 3–4 for "Age 9–10", ~Grade 5–6 for "Age 11–12"). No persistence across
  sessions is required in v1.
- **FR-008**: System MUST increase question difficulty progressively from the first to the
  last question in every session.
- **FR-009**: When Vedic Maths is a selected topic, the Vedic Maths questions allocated to
  that topic MUST draw from the full set of 23 defined problem patterns (see prompt
  `generate_questions.txt` PATTERN LIST). Patterns include: four-digit additions/subtractions;
  the four Teen/Reverse-Teen multiplication patterns (Teen × Teen, Teen × Reverse Teen,
  Reverse Teen × Teen, Reverse Teen × Reverse Teen); 2-digit × 1-digit, 2×2, 3×2
  multiplications; 2-digit ÷ single-digit and 3-digit ÷ Teen divisions; special multipliers
  (×11, ×111, ×999, ×99, ×9999); single/double/triple digit squares; integer + mixed fraction;
  and 2/3/4 mixed-fraction additions. The LLM MUST cycle through all patterns before
  repeating any, to avoid repetitive question sets. All four Teen/Reverse-Teen patterns MUST
  appear at least once when there are ≥ 4 Vedic Maths questions in the session.
- **FR-010**: System MUST display all questions on a single scrollable page.
- **FR-011**: Each question MUST have an independent freehand sketch canvas supporting
  mouse and touch input.
- **FR-012**: Each question MUST have a toggle to switch between sketch mode and
  text/keyboard input mode independently per question.
- **FR-013**: System MUST provide a Submit button at the bottom of the practice page.
- **FR-014**: On submission, system MUST capture all sketch canvases as images and
  collect all typed text answers, then send them to the AI service for evaluation.
- **FR-015**: AI evaluation MUST score each question 0, 1, or 2 marks per the defined
  marking scheme (2: correct answer + correct method, 1: partial, 0: incorrect).
- **FR-016**: Results dashboard MUST display per-question marks, overall score, percentage,
  topic breakdown, and encouraging age-appropriate themed feedback.
- **FR-017**: The platform MUST ship with a "Dandy's World" default visual theme using a
  **dark vibrant palette**: deep-space background (`#0f0a1e`), electric-purple surfaces,
  yellow-gold primary, sky-blue secondary, violet accent, neon-green accent. Theme tokens
  are delivered via CSS custom properties on a `#theme-root` wrapper. Original artwork
  (corner character SVGs, floating background shapes) must be inspired by the game's
  aesthetic without reproducing any copyrighted assets.
- **FR-018**: The theme system MUST support switching between themes without a full page
  reload.
- **FR-019**: Adding a new practice topic MUST require no changes to the core session
  flow, question display, or submission logic.
- **FR-020**: When the AI service call fails (generation or evaluation), the system MUST
  display a themed in-app error message with a retry action. The student's session setup
  (selected topics, age group, question count) MUST be preserved so the retry requires no
  re-entry of choices. No partial question sets or partial evaluation results may be shown.
- **FR-021**: When a student activates Submit and all questions are unanswered (all canvases
  blank and all text fields empty), the system MUST display a themed confirmation prompt
  stating that unanswered questions will receive 0 marks, with a "Continue" action to proceed
  and a "Go Back" action to return to the practice page. Submission MUST NOT proceed without
  explicit confirmation from the student.
- **FR-022**: Each sketch canvas MUST preserve and proportionally scale existing strokes when
  the browser window is resized. Strokes MUST NOT be lost, cleared, or misaligned as a result
  of any viewport resize event during a session.
- **FR-023**: Fraction notation in all question text MUST be rendered as stacked fractions
  (numerator over a horizontal bar, denominator below) rather than inline slash notation
  (e.g. ½ not 1/2). This applies everywhere question text is displayed: the practice page
  and the results dashboard.
- **FR-024**: The application MUST include a persistent site-wide header (fixed, 64 px tall,
  `z-index: 40`) containing the Math Buddy logo and primary navigation links (Home, Practice,
  Leaderboard, About). On mobile, navigation collapses into a hamburger menu. A site-wide
  footer MUST also be present on all screens, containing branding, quick links, and social
  placeholder icons.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 (Code Quality)**: Backend Python code must pass ruff linting and mypy type
  checks; frontend code must pass ESLint and TypeScript type checks. All PR submissions
  must pass CI gates for both.
- **CA-002 (Architecture Boundaries)**: AI service wrapper lives in
  `backend/app/integrations/`; session and question business logic in
  `backend/app/services/`; HTTP route handlers in `backend/app/api/v1/`; models in
  `backend/app/models/`; schemas in `backend/app/schemas/`. Frontend API calls go through
  `src/lib/api/` — no direct fetch calls in components.
- **CA-003 (Testing)**: Unit tests required for question generation logic (type
  distribution, difficulty ordering, Vedic Maths pattern enforcement); integration tests
  for the end-to-end session flow; contract tests for the AI evaluation API.
- **CA-004 (UX Consistency)**: Loading screen pattern (progress bar + fun facts) must use
  a shared component reused for both generation and evaluation phases. All error states
  and validation messages must use shared UI feedback components. WCAG 2.2 AA compliance
  required for keyboard navigation and colour contrast.
- **CA-005 (Performance)**: Theme switching must complete without a full page reload.
  Question page must support at least 30 independent canvas elements without measurable
  scroll degradation. Loading screen must remain responsive during AI service calls of
  any duration.

### Key Entities *(include if feature involves data)*

- **Session**: selected topics, grade level, question count, generated questions, evaluation
  state (pending / complete), total score.
- **Question**: index, topic, problem type (multiplication / division / fractions /
  mixed fractions / squares), question text, difficulty rank, associated answer, marks
  awarded, AI-generated explanation.
- **Answer**: question index, input mode (sketch / text), sketch image data,
  typed text, marks awarded.
- **Topic**: identifier, display name, enabled flag (supports future addition without
  schema changes).
- **Fun Fact**: text content, used-in-session flag.
- **Theme**: identifier, display name, visual token set (colour palette, typography, original
  inspired character assets — no copyrighted third-party artwork).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can complete the full flow — topic selection, session start,
  question generation, answer input for all questions, submission, and results viewing —
  in a single uninterrupted journey without encountering any dead ends or unhandled errors.
- **SC-002**: Every session delivered to a student contains exactly the five mandatory
  problem types (multiplication, division, fractions, mixed fractions, squares), verifiable
  by automated testing on 100% of generated question sets.
- **SC-003**: All Vedic Maths questions in every session draw from the full 23-pattern set,
  with no pattern repeated before all others have been used — verifiable by checking pattern
  distribution across multiple sessions.
- **SC-004**: Difficulty progression is objectively measurable: the median difficulty rank
  of the last 25% of questions is higher than the median difficulty rank of the first 25%.
- **SC-005**: The loading experience (progress bar + non-repeating facts) remains visible
  and responsive throughout the entire duration of any AI service call, regardless of
  call duration.
- **SC-006**: Theme switching is achievable by the user without a page reload and takes
  effect on all visible UI elements within one interaction.
- **SC-007**: Adding a new topic to the data layer results in that topic appearing in the
  selection UI and being available for question generation without changes to the session
  start, question display, submission, or evaluation flows.
- **SC-008**: Sketch canvas input works correctly on both mouse and touch-capable devices,
  with no loss of freehand stroke fidelity.
- **SC-009**: Per-question marks awarded by the AI evaluation match the defined marking
  scheme (2 / 1 / 0) and include an explanation visible to the student on the dashboard.
- **SC-010**: Results dashboard displays accurate overall score, percentage, and a
  per-topic score breakdown after every evaluation.

---

## Assumptions

- Students are boys aged 9 and 11. For the purpose of calibrating problem complexity and
  difficulty, questions are pitched at age 10 (for the "Age 9–10" group) and age 12 (for the
  "Age 11–12" group) to provide a slight stretch above the student's current level.
- No user accounts, login, or persistent session history are required in v1; session data
  is lost when the browser session ends.
- Fun facts are LLM-generated as part of the single question-generation call (batched in
  the same JSON response). A fallback pool of static facts is seeded immediately on session
  start so the loading screen is never blank if the LLM call is slow to respond.
- The platform targets modern browsers with HTML Canvas support; no compatibility polyfills
  for legacy browsers are in scope.
- A single active theme is displayed at a time; theme preference is not persisted across
  browser sessions in v1.
- The LLM provider and API key management are backend infrastructure decisions outside the
  scope of this specification.
- The "Age 9–10" group corresponds to approximately Grade 3–4, and the "Age 11–12" group
  corresponds to approximately Grade 5–6. Both groups use a blended curriculum drawing from
  the Canadian provincial mathematics curriculum and the Indian NCERT mathematics syllabus
  at the appropriate primary/elementary level. Content and difficulty calibration will favour
  whichever curriculum approach produces better learning outcomes for the topic and problem
  type in question — the AI prompt will reference both curricula and select the most
  pedagogically effective framing.
- The five mandatory problem types (multiplication, division, fractions, mixed fractions,
  squares) are distributed as evenly as possible across the question count; remainders are
  distributed to earlier problem types.
- Vedic Maths questions are a subset of the full question set when that topic is selected;
  they satisfy both the Vedic Maths topic requirement and the mandatory problem type
  requirement if the problem type matches.
