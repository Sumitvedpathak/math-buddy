# UX Requirements Checklist: Math Practice Platform for Kids

**Purpose**: Developer self-check — validates the completeness, clarity, and scenario
coverage of UX requirements across all screens before writing the first JSX. Does NOT
cover accessibility (deferred).
**Created**: 2026-04-18
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)
**Scope**: Practice page + SketchCanvas (CHK001–CHK023) · Home screen, Loading screen,
Dashboard, Error states, Theme system (CHK024–CHK052)
**Depth**: Lightweight (developer self-check)
**Accessibility**: Out of scope this pass

---

## Requirement Completeness

- [x] CHK001 — Is the visual layout and hierarchy of a question card specified? (relative positioning of question number, question text, canvas/text input, and toggle control) [Completeness, Gap]
- [x] CHK002 — Are minimum canvas dimensions defined? Is there a required min-height or min-width below which canvas behaviour is unspecified? [Completeness, Gap]
- [x] CHK003 — Is the Submit button's scroll behaviour defined — is it sticky/fixed while scrolling, or only reachable by scrolling to the bottom of the page? [Completeness, Spec §FR-013]
- [x] CHK004 — Is a clear or undo affordance for the sketch canvas specified, or is the absence of one an explicit product decision? [Completeness, Gap]
- [x] CHK005 — Is visible question numbering or a question progress indicator specified anywhere in the Practice page requirements? [Completeness, Gap]
- [x] CHK006 — Are sketch stroke visual properties defined? (default colour, weight, tool options, or are all of these deferred to theme?) [Completeness, Gap]

---

## Requirement Clarity

- [x] CHK007 — Is "blank canvas" defined precisely enough to implement the empty-submission check in FR-021? (e.g., zero SVG paths, zero pixels drawn, a pixel threshold?) [Clarity, Spec §FR-021]
- [x] CHK008 — Is the visual state of the sketch/text toggle specified for each mode so a developer can implement it unambiguously? (label copy, active/inactive indicator, icon vs text) [Clarity, Spec §FR-012]
- [x] CHK009 — Is "proportionally scale existing strokes" in FR-022 defined with a specific algorithm or testable visual result, or is it left to implementation discretion? [Clarity, Spec §FR-022]
- [x] CHK010 — Is "independent" in FR-011/FR-012 explicitly scoped? Does toggling one question's mode or drawing on one canvas have zero effect on any other question's state? [Clarity, Spec §FR-011, Spec §FR-012]
- [x] CHK011 — Is the touch input model defined for the conflict between scroll gestures and draw gestures on touch devices? (e.g., dedicated draw button to activate canvas, stylus-only, two-finger scroll) [Clarity, Spec §FR-011]

---

## Scenario Coverage

- [x] CHK012 — Are requirements defined for sketch data persistence when a student toggles sketch → text → sketch on a single question? (strokes preserved, cleared, or undefined?) [Coverage, Gap]
- [x] CHK013 — Are canvas behaviour requirements specified for very small viewport widths (e.g., phones < 400px wide)? [Coverage, Edge Case, Gap]
- [x] CHK014 — Is auto-focus or UX behaviour defined when a question switches into text mode? (cursor placement, on-screen keyboard trigger) [Coverage, Gap]
- [x] CHK015 — Are requirements defined for partial submission — some questions answered and some blank — distinct from the fully-blank case covered by FR-021? [Coverage, Spec §FR-021, Gap]
- [x] CHK016 — Is the student experience defined for the moment between clicking Submit and the evaluation loading screen appearing? (instant transition, intermediate state, button disabled?) [Coverage, Gap]
- [x] CHK017 — Is the AI failure recovery flow (FR-020) specified distinctly for a failure mid-evaluation vs a failure at generation? Are there different UX requirements for each? [Coverage, Spec §FR-020]

---

## Acceptance Criteria Quality

- [x] CHK018 — Can "no measurable scroll degradation" in CA-005 be objectively verified? Is a measurable threshold (e.g., frame rate, scroll event latency) defined? [Measurability, Spec §CA-005]
- [x] CHK019 — Are the US3 acceptance scenarios sufficient to verify canvas independence across all 30 simultaneous question instances, or do they only cover a single canvas in isolation? [Measurability, Spec §US3-AC2]
- [x] CHK020 — Can "strokes MUST NOT be misaligned" in FR-022 be objectively verified without a visual regression tool? Is a tolerance or definition of "misaligned" specified? [Measurability, Spec §FR-022]

---

## Requirement Consistency

- [x] CHK021 — Is the empty-submission confirmation flow in FR-021 consistent with the evaluation rule that unanswered questions auto-score 0 in FR-015? (Does the warning message accurately reflect the scoring behaviour?) [Consistency, Spec §FR-021, Spec §FR-015]
- [x] CHK022 — Are the two loading screen appearances (during generation and during evaluation) explicitly specified to be identical, or are differences in messaging or progress semantics permitted? [Consistency, Spec §FR-005, Spec §CA-004]
- [x] CHK023 — Are the sketch/text toggle requirements in FR-012 and the per-canvas independence requirement in FR-011 stated consistently — i.e., does toggling mode count as a "state" that must remain independent, or is independence limited to drawn strokes only? [Consistency, Spec §FR-011, Spec §FR-012]

---

## Home Screen — Requirement Completeness

- [x] CHK024 — Is the layout and visual hierarchy of the home page fully specified? (relative positioning of topic selector, age group selector, question count field, and Start Practice button) [Completeness, Gap]
- [x] CHK025 — Are the validation message requirements for the no-topic-selected case fully defined? (message copy, position on screen, visual styling consistent with ErrorBanner or a separate pattern?) [Completeness, Spec §FR-002, Gap]
- [x] CHK026 — Are min/max bounds for the question count input defined? Is behaviour specified for inputs of 0, negative numbers, or non-integer values? [Completeness, Spec §FR-003, Gap]
- [x] CHK027 — Is the initial state of the home page on first load fully specified? (all topics unselected, question count = 30 — which age group, if any, is pre-selected by default?) [Completeness, Spec §FR-003, Spec §FR-007, Gap]

---

## Home Screen — Requirement Clarity

- [x] CHK028 — Is the "extensible multi-select topic list" (FR-001) specified clearly enough to implement? (checkboxes, chips, custom control? how many topics are visible before overflow or scrolling?) [Clarity, Spec §FR-001]
- [x] CHK029 — Is the age group selector's interaction model specified? (toggle, radio group, dropdown? visual indicator of the active selection) [Clarity, Spec §FR-007]
- [x] CHK030 — Is the "Start Practice" button label confirmed as final copy, or is it a themeable string subject to the active visual theme? [Clarity, Spec §FR-007, Gap]

---

## Home Screen — Scenario Coverage

- [x] CHK031 — Are requirements defined for submitting an out-of-range question count (0, negative, or above a reasonable maximum)? [Coverage, Edge Case, Gap]
- [x] CHK032 — Are requirements defined for the retry state — which field values are visually restored and in what UI state when a failed session returns the student to the home screen? [Coverage, Spec §FR-020]

---

## Loading Screen — Requirement Completeness

- [x] CHK033 — Is the progress bar behaviour fully specified? (determinate vs indeterminate, whether it completes to 100% when data arrives, visual start and end states) [Completeness, Spec §FR-005, Gap]
- [x] CHK034 — Is the fun fact rotation interval defined? (how long each fact is displayed before the next one appears) [Completeness, Spec §FR-005, Gap]
- [x] CHK035 — Is the transition from the loading screen to the next screen specified? (instant cut, fade, scroll-in? who is responsible for triggering it?) [Completeness, Gap]

---

## Loading Screen — Requirement Clarity

- [x] CHK036 — Is "non-repeating within the same session" (FR-005) scoped precisely enough? (two loading phases exist per session — generation and evaluation — do facts repeat across both phases, or only within each phase?) [Clarity, Spec §FR-005]
- [x] CHK037 — Are "fun facts" and "trivia items" the same entity in the spec, or are there separate content requirements for each? (US2 uses both terms without distinguishing them) [Ambiguity, Spec §US2]

---

## Loading Screen — Scenario Coverage

- [x] CHK038 — Are requirements defined for when the AI service responds in under one second? (does the progress bar complete a minimum animation before the transition occurs?) [Coverage, Edge Case, Gap]
- [x] CHK039 — Are requirements defined for what the loading screen displays if the fun fact pool is exhausted before generation or evaluation completes? [Coverage, Edge Case, Gap]

---

## Dashboard — Requirement Completeness

- [x] CHK040 — Is the layout and visual hierarchy of the dashboard specified? (relative positioning of overall score, per-question list, topic breakdown, feedback message, and Try Again action) [Completeness, Gap]
- [x] CHK041 — Is the per-question display on the dashboard fully specified? (which of these are required: question text, student's answer, correct answer, AI explanation, mark awarded?) [Completeness, Spec §FR-016, Gap]
- [x] CHK042 — Is the "return to home" action fully specified? (button label, position on page, whether it clears all session state before navigating) [Completeness, Spec §US5, Gap]
- [x] CHK043 — Are the requirements for "encouraging age-appropriate themed feedback" (FR-016) specific enough to implement? (one message per session, per score band, or AI-generated per individual result?) [Completeness, Clarity, Spec §FR-016, Gap]

---

## Dashboard — Requirement Clarity

- [x] CHK044 — Is "prominently shown" (US5-AC2) defined with measurable visual criteria for the overall score and percentage display? [Measurability, Spec §US5, Spec §FR-016]
- [x] CHK045 — Is the topic breakdown display specified precisely enough to implement? (raw score, percentage, question count, or attempted count per topic — which fields are required?) [Clarity, Spec §FR-016]

---

## Dashboard — Scenario Coverage

- [x] CHK046 — Are requirements defined for a student who scores 0 on all questions — is there a distinct feedback message or visual treatment, or does the same feedback path apply? [Coverage, Edge Case, Gap]
- [x] CHK047 — Are requirements defined for a single-topic session — is the topic breakdown section still shown when there is only one topic to display? [Coverage, Edge Case, Gap]

---

## Cross-Cutting: Error States

- [x] CHK048 — Is the ErrorBanner's placement and visual design specified? (top of screen, inline, modal? does it carry a dismiss action separate from the retry button?) [Completeness, Spec §FR-020, Gap]
- [x] CHK049 — Is the retry action behaviour specified consistently for both failure modes? (generation failure retries question generation; evaluation failure retries evaluation — or does either scenario redirect to the home screen?) [Consistency, Spec §FR-020]

---

## Cross-Cutting: Theme System

- [x] CHK050 — Are requirements for which UI elements must update on a theme switch specified? (canvas stroke colour, card backgrounds, character artwork, button styles — which are in scope?) [Completeness, Spec §FR-018, Gap]
- [x] CHK051 — Is "without a full page reload" the complete UX specification for theme switching, or are transition animation requirements also needed? [Completeness, Spec §FR-018, Spec §CA-005]
- [x] CHK052 — Is the default theme state on first load specified? (Dandy's World always the default, or is the theme user-selectable before starting a session?) [Completeness, Spec §FR-017, Gap]
