# Feature Specification: Step-Based Answer Evaluation and Solution Walkthrough

**Feature Branch**: `002-step-based-evaluation`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "Update the answer evaluation system to score student answers based on individual solution steps rather than a single overall mark. Also add a full step-by-step model solution to every question result on the dashboard so kids can learn the correct method."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Detailed Step Breakdown for Submitted Answers (Priority: P1)

After completing a practice session and viewing the dashboard, students and parents can see exactly which solution steps were completed correctly and which were missed, helping identify specific conceptual gaps rather than just seeing an overall score.

**Why this priority**: This is the core value proposition of the feature. Without step-by-step feedback, students cannot understand which specific part of their method was incorrect, limiting their ability to improve.

**Independent Test**: Can be fully tested by submitting answers (text or sketch), viewing the dashboard, and verifying that each question shows a per-step breakdown with ✅/❌ indicators for each required step. Delivers immediate educational value by showing exactly where mistakes occurred.

**Acceptance Scenarios**:

1. **Given** a student has completed a practice session with both text and sketch answers, **When** they view the dashboard, **Then** each question displays a numbered list of required steps with clear indicators (✅ for correct, ❌ for missed/incorrect)
2. **Given** a student completed step 1 correctly but made an error in step 2, **When** viewing the dashboard, **Then** step 1 shows ✅ with the student's correct work, and step 2 shows ❌ with the incorrect attempt and the correct answer
3. **Given** a sketch answer with partially visible working, **When** the LLM cannot clearly identify a step, **Then** that step shows ❌ with a note "Step not clearly visible in sketch" and the correct solution

---

### User Story 2 - Learn from Model Solutions (Priority: P1)

After viewing step breakdowns, students can read a complete, age-appropriate walkthrough of how to solve each problem correctly, reinforcing the proper method and filling knowledge gaps.

**Why this priority**: Seeing correct steps is only half the learning — understanding the reasoning behind each step is essential for mastery. This is co-priority with P1 as both are needed for meaningful learning.

**Independent Test**: Can be tested by viewing any evaluated question on the dashboard and verifying that a complete model solution appears below the step breakdown, written in simple language suitable for 9-12 year olds. Delivers value by providing a learning resource for every question.

**Acceptance Scenarios**:

1. **Given** a question on the dashboard, **When** the student scrolls to the model solution section, **Then** they see a clearly numbered walkthrough explaining each step in simple language (e.g., "First, we multiply the numerators: 3 × 4 = 12")
2. **Given** a complex multi-step problem, **When** viewing the model solution, **Then** each step includes both the calculation/action and a brief explanation of why it's done that way
3. **Given** different age groups (9-10 vs 11-12), **When** viewing model solutions, **Then** the language complexity and terminology are appropriate for the student's age level

---

### User Story 3 - Receive Fractional Scores Reflecting Partial Credit (Priority: P2)

Students receive credit for each correct step even if the final answer is wrong, encouraging them to show their working and rewarding progress toward the solution rather than penalizing one mistake.

**Why this priority**: This motivates students to demonstrate their working and rewards partial understanding. While important for fairness and motivation, the primary learning value comes from the feedback (P1 stories).

**Independent Test**: Can be tested by submitting an answer with some correct steps and some incorrect steps, then verifying the dashboard shows a fractional score (e.g., 1.25 / 2.0) where the numerator equals 0.25 × number of correct steps. Delivers value by providing fairer, more granular scoring.

**Acceptance Scenarios**:

1. **Given** a question requiring 4 steps and the student completed 3 correctly, **When** viewing the dashboard, **Then** the score displays as "0.75 / 1.00" (3 × 0.25 = 0.75)
2. **Given** questions of varying complexity in a session, **When** viewing the overall session score, **Then** the total is the sum of all question scores (e.g., "5.25 / 8.50") and the maximum varies based on how many steps each question required
3. **Given** a simple 2-step multiplication question, **When** the student completes both steps correctly, **Then** the score shows "0.50 / 0.50" (2 × 0.25 = 0.50)

---

### User Story 4 - Receive Encouraging, Personalized Feedback (Priority: P3)

After viewing their results, students see a short, positive message tailored to their performance, keeping them motivated and engaged with the learning process.

**Why this priority**: While motivational messages enhance the user experience, the core learning value comes from the detailed feedback and model solutions. This is a nice-to-have that improves engagement.

**Independent Test**: Can be tested by completing sessions with varying success rates and verifying that the dashboard displays different encouraging messages based on the score ratio (e.g., high scores get "Excellent work!", partial credit gets "Good start! Review the steps you missed and try again"). Delivers value by maintaining student motivation.

**Acceptance Scenarios**:

1. **Given** a question where the student scored 100% (all steps correct), **When** viewing the dashboard, **Then** an encouraging message like "Perfect! You got every step right! 🌟" appears
2. **Given** a question where the student scored 50-75%, **When** viewing the dashboard, **Then** a supportive message like "Good progress! Check the steps you missed and keep practicing 💪" appears
3. **Given** a question where the student scored below 50%, **When** viewing the dashboard, **Then** a growth-focused message like "Keep going! Review the model solution and try a similar problem 📚" appears

---

### Edge Cases

- What happens when a student's sketch is completely illegible and no steps can be identified? (System awards 0/total, notes "Unable to read handwriting clearly", encourages trying text input or clearer sketch)
- How does the system handle a correct final answer but missing or incorrect intermediate steps? (Awards marks only for clearly demonstrated correct steps, not for the final answer alone)
- What if the student uses a valid alternative solution method with different steps? (LLM must recognize multiple valid approaches and award marks if the student's steps are logically sound, even if different from the expected method)
- How does the system determine required steps for a novel or unusual question type? (LLM analyzes question complexity and age appropriateness to define reasonable steps — if uncertain, defaults to broader steps to avoid over-penalization)
- What happens when there's ambiguity in text answers (e.g., "2+3=5" on one line vs. separate lines)? (LLM interprets the student's intent based on mathematical logic and awards marks for correct working regardless of formatting)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST break down every answer into discrete required steps appropriate for the question type and student age group (9-10 or 11-12)
- **FR-002**: System MUST award exactly 0.25 marks for each correctly completed step identified in the student's answer
- **FR-003**: System MUST calculate total question score as the sum of all step scores (number of correct steps × 0.25)
- **FR-004**: System MUST allow variable maximum scores per question based on the number of required steps (no fixed maximum)
- **FR-005**: System MUST evaluate sketch answers by analyzing the uploaded image and identifying visible working steps
- **FR-006**: System MUST evaluate text answers by parsing the written working and mapping each line/expression to required steps
- **FR-007**: Dashboard MUST display for each question: original question, total score (e.g., 1.25 / 2.0), per-step breakdown with ✅/❌ indicators
- **FR-008**: Dashboard MUST show the student's attempt at each step where visible/identifiable
- **FR-009**: Dashboard MUST show the correct value or expression for each required step
- **FR-010**: Dashboard MUST display a complete model solution for every question, written in simple language appropriate for 9-12 year olds
- **FR-011**: System MUST provide encouraging feedback messages personalized to the score ratio for each question
- **FR-012**: System MUST calculate overall session score as the sum of all question scores
- **FR-013**: Dashboard summary MUST reflect the new fractional total score with variable maximum based on total steps across all questions
- **FR-014**: System MUST recognize and credit valid alternative solution methods, not just a single expected approach
- **FR-015**: Local development environment MUST support full testing of step-based evaluation before cloud deployment

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 (Code Quality)**: All modified backend evaluation logic (`backend/app/services/evaluation.py`), API route handlers (`backend/app/api/v1/answers.py`), and frontend dashboard components (`frontend/src/app/Dashboard.jsx`, `frontend/src/components/QuestionResult.jsx`) MUST pass existing linting and type checks (Pylance, ESLint) without new errors
- **CA-002 (Architecture Boundaries)**: Evaluation step logic belongs in `backend/app/services/evaluation.py`, LLM prompt construction in a new `backend/app/services/llm_prompts.py` module, API schema updates in `backend/app/schemas/`, and frontend visualization in a new `frontend/src/components/StepBreakdown.jsx` component following existing patterns
- **CA-003 (Testing)**: MUST include unit tests for step scoring logic (`backend/tests/test_services/test_evaluation.py`), integration tests for the evaluation API endpoint (`backend/tests/test_api/test_answers.py`), and frontend component tests for the step breakdown display (`frontend/src/components/StepBreakdown.test.jsx`)
- **CA-004 (UX Consistency)**: Step breakdown and model solution sections MUST follow existing dashboard card styling (Tailwind classes from design system), loading states MUST show skeleton placeholders matching existing question cards, and error states MUST use the existing `ErrorBanner` component pattern
- **CA-005 (Performance)**: Step-based evaluation prompt to OpenRouter MUST complete within 10 seconds for typical multi-question sessions, dashboard MUST render step breakdowns without layout shift, and total bundle size increase MUST not exceed 15KB after compression

### Key Entities

- **EvaluationStep**: Represents a single required step in a solution, including step number, description, whether student completed it correctly (boolean), student's attempt (text/expression or null if not visible), correct value/expression, and marks awarded (0 or 0.25)
- **StepBasedScore**: Represents the score for a single question, including question ID, total marks earned (sum of step marks), maximum possible marks (number of steps × 0.25), list of EvaluationSteps, and score ratio (earned/max) for personalized feedback
- **ModelSolution**: Represents the complete walkthrough for a question, including question ID, list of numbered solution steps (each with description and explanation), age-appropriate language level indicator, and optional diagram/visual hint if applicable
- **SessionEvaluation**: Represents the overall session results, including session ID, list of StepBasedScores for all questions, total session score (sum of all question scores), total maximum score (sum of all question max scores), and evaluation timestamp

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students and parents can view a complete step-by-step breakdown for every submitted answer within 3 seconds of loading the dashboard
- **SC-002**: System correctly identifies and scores individual steps in at least 90% of typical math problems for the target age groups (multiplication, division, fractions, decimals, word problems)
- **SC-003**: Model solutions are comprehensible to 9-12 year old students, verified by readability scores (Flesch-Kincaid Grade Level 4-6) and parent/teacher feedback
- **SC-004**: Students who review step breakdowns and model solutions show measurable improvement (at least 15% higher scores) on similar subsequent problems within the same session or next session
- **SC-005**: Sketch answer step identification accuracy is at least 75% for clear handwriting (as measured by comparison with expert human evaluation of the same sketches)
- **SC-006**: System handles sessions with up to 10 questions containing 30+ total steps with evaluation completing in under 15 seconds
- **SC-007**: Dashboard renders step breakdowns without layout shift or flicker, maintaining 60 FPS during scroll
- **SC-008**: At least 80% of students/parents find the step-by-step feedback "helpful" or "very helpful" in post-session surveys

## Assumptions

- Students will submit answers with at least some visible working (either in sketches or text); completely blank answers receive 0/total with guidance to show working
- The existing OpenRouter LLM integration (Gemini 2.5 Flash Lite) has sufficient reasoning capability to accurately break down problems into steps and evaluate student working
- The current answer schema already captures both text and image data needed for evaluation; if not, schema updates are in scope
- Step complexity will align with standard curriculum expectations for ages 9-12 (UK primary school years 5-7 or equivalent)
- Model solution language targets reading comprehension at grade 4-6 level (ages 9-12), using short sentences and familiar vocabulary
- Parents/teachers reviewing the dashboard understand fractional scoring (e.g., 1.25/2.0) without additional UI explanation beyond tooltips
- The existing dashboard infrastructure can accommodate additional content (step breakdowns, model solutions) without major refactoring
- Local testing with representative question types and answer samples is sufficient before cloud deployment; full production load testing is out of scope for this feature
- The LLM's step evaluation is the source of truth; no manual override mechanism is required in v1
- Performance targets assume typical GCP Cloud Run scaling behavior observed in existing deployment
