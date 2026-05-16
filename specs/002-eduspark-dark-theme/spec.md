# Feature Specification: EduSpark Dark Design System

**Feature Branch**: `002-eduspark-dark-theme`
**Created**: 2026-05-16
**Status**: Draft
**Input**: Apply the EduSpark dark design system (prototyped in `darktheme/eduspark-design/`) to the existing Math Buddy React app — UI layer only, no backend changes.

---

## Clarifications

### Session 2026-05-16

- Q: Should the mobile nav menu close automatically when a navigation link is tapped? → A: Yes — clicking a nav link closes the menu and navigates to the destination.
- Q: What strategy should be used to load Google Fonts (Space Grotesk, Inter, JetBrains Mono)? → A: `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html` with `font-display: swap` on the `@font-face` declarations to prevent invisible text during load.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Immersive Dark Theme Experience (Priority: P1)

A student opens Math Buddy and immediately sees a dark, vibrant interface: deep-space background, electric-violet glows, neon-lime accents, and a modern display typeface. The visual language feels premium and engaging for a 9–12 year old who loves games and technology. The header is sticky and always accessible; navigation is clear. The footer anchors the page with branding and quick links.

**Why this priority**: The design system is the foundation for every screen. Without it in place, all subsequent story implementations would need rework. This story delivers the shell — theme tokens, typography, header, and footer — that every other story depends on.

**Independent Test**: Open the app home page. The page background is deep-space dark. The header shows the Math Buddy logo mark (gradient square with "m"), the tagline "Learn · Practice · Master", navigation links (Home, Practice, Leaderboard, About), and a "Start practising" CTA button. On a narrow viewport the nav collapses to a hamburger menu. The footer shows logo, copyright, and quick links. This is testable purely from visual inspection with no practice flow needed.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** any page is viewed, **Then** the background is deep-space dark, text is near-white, and all colour tokens (primary violet, accent lime, muted surfaces) are applied consistently.
2. **Given** the home page is open, **When** the student views the header, **Then** a sticky 64 px header is present containing the logo mark, "Math Buddy" branding with "Learn · Practice · Master" sub-label, navigation links, and a "Start practising" button.
3. **Given** a viewport narrower than 768 px, **When** the header renders, **Then** the navigation links collapse and a hamburger/menu icon appears; tapping it reveals the navigation. Tapping any navigation link within the open menu navigates to that page and closes the menu.
4. **Given** the active page is one of the nav links (Home, Practice, Leaderboard, About), **When** that link renders, **Then** it receives an active pill style distinct from inactive links.
5. **Given** any page is viewed, **When** the student scrolls to the bottom, **Then** a footer is present with the logo mark, copyright text, and quick-link list (About, Practice, Leaderboard).

---

### User Story 2 — Redesigned Home Page (Priority: P1)

A student arrives at the home page and sees a bold hero section: a large headline with gradient text ("Maths that hits different"), animated glowing orbs in the background, a grid-paper texture overlay, a live-badge pill, stat counters (4 topic tracks, 100+ questions per set, 2 answer modes), and a sample question card preview on the right. Below the hero are three sections: Tracks (four topic cards), How It Works (three numbered steps), and a full-width CTA banner inviting the student to begin practising.

**Why this priority**: The home page is the first impression and the entry point. A compelling home page drives engagement and sets the expectation for the quality of the practice experience.

**Independent Test**: Navigate to the home page. All four sections (hero, tracks, how-it-works, CTA) are visible on a single scroll. The hero headline gradient renders. The animated floating orbs are present. The stat counters show correct numbers. The sample question card is visible. The "Start a practice set" and "Begin practising" buttons link to the practice page. Testable without any practice session.

**Acceptance Scenarios**:

1. **Given** the home page loads, **When** the hero section renders, **Then** a gradient headline, animated background glows, grid-paper texture, live-badge pill, and a sample question card preview are all visible.
2. **Given** the hero section, **When** the student views the stat block, **Then** three counters are shown: "4 Topic tracks", "100+ Questions / set", "2 Answer modes".
3. **Given** the home page, **When** the student views the Tracks section, **Then** four topic cards are shown (Vedic Maths, Word Problems, Algebra, Volumes & Shapes), each with a number badge, title, description, and a hover arrow interaction.
4. **Given** the home page, **When** the student views the How It Works section, **Then** three numbered steps are shown: "Configure your set", "Solve your way", "Review, then refine".
5. **Given** the home page, **When** the student clicks "Start a practice set" or "Begin practising", **Then** they are taken to the practice setup screen.

---

### User Story 3 — Redesigned Practice Setup Screen (Priority: P1)

The practice setup screen presents three configuration steps in a single stacked card: Age Group selection (two radio-style buttons), Topic selection (four checkbox-style cards with symbol, title, and description), and Question Count (stepper with +/- controls and quick-set buttons for 5/10/20/30). Below the card, a status line shows the current selection summary, and a "Start practice" button advances to loading. Validation prevents advancing with no topic selected.

**Why this priority**: The setup screen is the gateway to every practice session. It must be clear, fast to complete, and visually consistent with the new design system.

**Independent Test**: Navigate to Practice. Select "Age 11–12", select "Vedic Maths" and "Algebra", set count to 20. The status line reads "Ready: 20 questions across 2 topics." The "Start practice" button is enabled. Deselect all topics — the button becomes disabled and a validation message appears. Fully testable without triggering question generation.

**Acceptance Scenarios**:

1. **Given** the practice screen loads, **When** the setup stage is shown, **Then** three labelled sections (01 Age group, 02 Topics, 03 Number of questions) are visible inside a single rounded card.
2. **Given** the age group section, **When** the student selects an option, **Then** the selected card shows a highlighted border and filled radio dot; the previously active option deactivates.
3. **Given** the topics section, **When** the student selects one or more topics, **Then** each selected topic card shows a highlighted border and a checked checkbox; the status line reflects the count.
4. **Given** no topics are selected, **When** the student clicks "Start practice", **Then** the button is disabled (or a validation message appears) and no transition occurs.
5. **Given** the question count section, **When** the student uses the +/− stepper or quick-set buttons, **Then** the count updates immediately within the allowed range (1–100).

---

### User Story 4 — Redesigned Question Cards and Practice Flow (Priority: P2)

Each question on the practice page uses a two-column card layout: the left column shows the question prompt, and the right column shows the answer area (sketch or text, toggled per question). The session header shows total question count and a progress bar tracking answered questions. The Submit button is sticky at the bottom of the viewport.

**Why this priority**: The question card is the core interaction surface. Its redesign directly affects the quality of the practice experience, but it depends on the setup screen (US3) being wired.

**Independent Test**: Start a session with any topic. All question cards render in the two-column layout. Drawing on a sketch canvas works. Switching to text mode works. The progress bar advances as questions are answered. The sticky submit button is always visible.

**Acceptance Scenarios**:

1. **Given** a practice session is active, **When** a question card renders, **Then** the left column shows the question number badge, topic label, and question text; the right column shows the mode toggle and answer area.
2. **Given** a question card in sketch mode, **When** the student draws, **Then** strokes appear on the canvas; switching to text mode and back restores the sketch.
3. **Given** any answer state, **When** the progress bar is visible, **Then** it reflects the ratio of answered questions to total questions and updates in real time.
4. **Given** the student scrolls through a long question list, **When** they look at the bottom of the viewport, **Then** the Submit button remains visible without blocking question content.

---

### User Story 5 — Redesigned Results Dashboard (Priority: P2)

After evaluation, the results dashboard shows a split-panel score hero: the left panel (primary-coloured) displays the raw score fraction, percentage, and an encouraging message; the right panel shows a per-topic breakdown with mini progress bars. Below the hero, a full question review list shows each question with its prompt, the student's answer, the correct answer, and a "Correct"/"Review" badge. A "Start a new set" button returns to setup.

**Why this priority**: The dashboard closes the learning loop. A clear, beautiful results screen motivates the student to try again.

**Independent Test**: Complete a session. The split-panel score hero renders correctly. Each question appears in the review list with correct/incorrect badge. "Start a new set" returns to setup. Testable end-to-end.

**Acceptance Scenarios**:

1. **Given** evaluation completes, **When** the dashboard renders, **Then** a left panel shows the score as "X / N" in large type, percentage, and a contextual message; a right panel shows a per-topic bar breakdown.
2. **Given** the dashboard, **When** the question review list is scrolled, **Then** every question shows its prompt, a "Correct" (green) or "Review" (red) badge, the student's answer, and the correct answer.
3. **Given** any score, **When** the contextual message renders, **Then** it is encouraging and age-appropriate (four tiers: 100%, ≥70%, ≥40%, <40%).
4. **Given** the dashboard, **When** the student clicks "Start a new set", **Then** the screen returns to the practice setup stage.

---

### User Story 6 — Leaderboard Page (Priority: P3)

A new Leaderboard page shows this week's top performers. The top 3 appear on a podium (rank 2 left, rank 1 centre elevated, rank 3 right), each card showing name, level, sets completed, accuracy, and streak. Below the podium, a full ranked table lists all entries with the same columns plus a rank number.

**Why this priority**: The leaderboard is a motivational feature. It is independent of the core practice flow and can be added without affecting other screens.

**Independent Test**: Navigate to /leaderboard (or the Leaderboard nav link). The podium renders with three cards. The table renders with all entries. No backend integration required — static data is sufficient for this spec.

**Acceptance Scenarios**:

1. **Given** the leaderboard page loads, **When** the podium renders, **Then** rank 1 is in the centre (slightly elevated), rank 2 is on the left, rank 3 is on the right.
2. **Given** the podium, **When** each card renders, **Then** it shows the learner's name, level, sets completed, accuracy percentage, and streak count.
3. **Given** the full ranked table, **When** it renders, **Then** all entries are listed with rank, name, level, sets, accuracy, and streak columns.

---

### User Story 7 — About Page (Priority: P3)

A new About page articulates the platform's principles and roadmap. Four principles are listed in the left column (Working over answers, Kindness in feedback, Quiet by design, Built to grow). A roadmap in the right column shows current and upcoming tracks (Maths 9–12 now, Maths 13–16 Q2, Science Q3, Teacher dashboards Q4). A CTA block at the bottom links to practice.

**Why this priority**: The About page is informational and independent. It adds credibility but does not affect the practice flow.

**Independent Test**: Navigate to /about (or the About nav link). Both columns render with correct content. The CTA links to the practice page.

**Acceptance Scenarios**:

1. **Given** the about page loads, **When** the principles section renders, **Then** four principles are listed, each with a bold title and a descriptive sentence.
2. **Given** the about page, **When** the roadmap renders, **Then** four roadmap entries show with their timeline labels and availability badges.
3. **Given** the CTA block, **When** the student clicks "Start practising", **Then** they are taken to the practice setup screen.

---

### Edge Cases

- When the viewport is resized between mobile and desktop widths, the header hamburger menu and desktop nav switch correctly without a page reload.
- When the student navigates between pages using the header nav, the active link style updates to reflect the current page.
- When the student returns to the home page after completing a session, the hero CTA still routes correctly to the practice setup (not a mid-session state).
- When a topic card in the setup screen is toggled rapidly, the selection state remains consistent with no visual glitch.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST use a dark vibrant colour palette applied via CSS custom properties: deep-space background, electric-violet primary, neon-lime accent, muted dark surfaces, near-white foreground. All palette values MUST use the oklch colour space as defined in the EduSpark reference design.
- **FR-002**: The application MUST load Space Grotesk (display headings), Inter (body text), and JetBrains Mono (monospace/labels) via `<link rel="preconnect">` + `<link rel="stylesheet">` tags with `&display=swap` in `index.html`, preventing invisible text during font load. Font assignments MUST be exposed as Tailwind theme tokens (`font-display`, `font-sans`, `font-mono`).
- **FR-003**: The CSS layer MUST define the following custom utility classes: `.bg-hero-glow`, `.grid-paper`, `.text-gradient-primary`, `.glow-primary`, `.glow-accent`, `.ring-soft`, `.ring-soft-lg`, `.noise-overlay`, `.animate-float-slow`, `.animate-shimmer`, `.animate-pulse-glow`.
- **FR-004**: The header MUST be a sticky element 64 px tall with `z-index: 40`, containing: a gradient logo mark that rotates 6° on hover, "Math Buddy" with "Learn · Practice · Master" sub-label in accent colour, navigation links (Home, Practice, Leaderboard, About) with active-pill highlighting, and a "Start practising" CTA button with primary gradient and glow.
- **FR-005**: On viewports narrower than 768 px, the header navigation MUST collapse and a hamburger/menu control MUST be shown; activating it reveals the navigation links. Tapping any navigation link within the open menu MUST navigate to the target page AND close the menu automatically.
- **FR-006**: The footer MUST appear on all pages, containing the logo mark, copyright text, and quick links to About, Practice, and Leaderboard.
- **FR-007**: The home page MUST include four sections: (1) Hero — headline with `.text-gradient-primary`, live-badge pill, animated floating orbs, `.grid-paper` background overlay, stat counters, and a sample question card preview; (2) Tracks — four topic cards with hover lift and arrow interaction; (3) How It Works — three numbered steps; (4) CTA banner — full-width gradient panel with "Begin practising" link.
- **FR-008**: The practice setup screen MUST present three labelled sections (Age Group, Topics, Number of questions) inside a single rounded card, styled with the EduSpark card pattern (`.ring-soft` or `.ring-soft-lg`, `bg-card`, rounded-2xl).
- **FR-009**: The question card MUST use a two-column layout on medium+ viewports: question content on the left, answer area (sketch/text toggle) on the right. On narrow viewports the columns stack vertically.
- **FR-010**: The results dashboard MUST use a split-panel layout: primary-coloured left panel with score and contextual message, white-surfaced right panel with per-topic progress bars. Below the hero, a question review list renders each question with correct/incorrect badge, student answer, and correct answer.
- **FR-011**: A Leaderboard page MUST be added showing a top-3 podium (rank 2 left, rank 1 centre elevated, rank 3 right) and a full ranked table. Static mock data is acceptable for v1.
- **FR-012**: An About page MUST be added showing a principles list (4 items) and a roadmap table (4 entries with timeline labels and status badges).
- **FR-013**: The Leaderboard and About pages MUST be wired into the header navigation and the App screen router so they are reachable via navigation links.
- **FR-014**: All existing backend API contracts, `SessionContext` state shape, and business logic (question generation, evaluation, scoring) MUST remain unchanged. Only the UI layer is modified.
- **FR-015**: The loading screen (progress bar + rotating fun facts) and the error banner MUST be restyled to match the EduSpark dark palette and card patterns, reusing the existing shared components.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 (Code Quality)**: All modified frontend JSX files MUST pass ESLint with the project's existing ESLint config. No new `tsc --checkJs` errors may be introduced. The `dandysWorld.js` theme file MUST be updated to export the new EduSpark token set (keeping the same export shape so no consumer code breaks).
- **CA-002 (Architecture Boundaries)**: All new pages (`Leaderboard.jsx`, `About.jsx`) MUST live under `frontend/src/app/`. No API calls or fetch logic may be added to these pages. Navigation wiring is in `App.jsx` and `AppHeader.jsx` only.
- **CA-003 (Testing)**: Vitest snapshot or render tests MUST be added or updated for: `AppHeader.jsx` (confirms nav links present, active state), `HomeScreen.jsx` (confirms four sections render), `Dashboard.jsx` (confirms score hero and review list render). Existing passing tests MUST NOT be broken.
- **CA-004 (UX Consistency)**: Loading and error states MUST continue to use the shared `LoadingScreen` and `ErrorBanner` components. The new design tokens MUST be applied globally so these components are automatically restyled. WCAG 2.2 AA colour contrast MUST be met for all text/background combinations in the new palette.
- **CA-005 (Performance)**: Theme token application MUST complete without a full page reload (CSS custom property swap). The home page hero animations (floating orbs, grid paper) MUST use GPU-composited CSS properties (`transform`, `opacity`) only, with no layout-triggering repaints. The app MUST continue to support 30 independent canvas elements on the practice page without measurable scroll degradation.

### Key Entities

- **DesignToken**: A CSS custom property name–value pair representing one visual attribute (colour, radius, font, shadow, gradient). All tokens are defined on `:root` via `index.css`; the `dandysWorld.js` module exports the same set as a JS object for programmatic theme switching.
- **Page**: A top-level screen reachable via navigation (`HomeScreen`, `PracticePage`, `Dashboard`, `Leaderboard`, `About`). Each page maps to one entry in `App.jsx`'s screen router and one nav link in `AppHeader.jsx`.
- **NavigationLink**: An entry in the header nav with a `label`, a `screen` target (for the context-based router), and an `active` state driven by the current `screen` in `SessionContext`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every page of the application (Home, Practice, Dashboard, Leaderboard, About) renders with the dark EduSpark palette — verifiable by visual inspection and by confirming the CSS custom property `--background` resolves to the deep-space dark value on `#theme-root`.
- **SC-002**: The header is present and sticky on all pages, contains all four navigation links, and correctly highlights the active link — verifiable by navigating between pages.
- **SC-003**: The home page renders all four sections (hero, tracks, how-it-works, CTA) in a single scroll with no broken layout — verifiable by visual inspection at 1280 px and 375 px viewport widths.
- **SC-004**: On a 375 px viewport, the header hamburger menu is visible and functional, replacing the desktop nav — verifiable by viewport-width testing.
- **SC-005**: A complete practice flow (setup → loading → answering → dashboard) completes without any JavaScript error in the browser console — verifiable by running a full session in a browser.
- **SC-006**: All Vitest tests (existing 37 + new/updated) pass after the design migration — verifiable by `npm test`.
- **SC-007**: ESLint reports zero errors on all modified files — verifiable by `npm run lint`.
- **SC-008**: The Leaderboard and About pages are reachable via header navigation links and render their content correctly — verifiable by clicking each nav link.
- **SC-009**: No backend code, API schema, or `SessionContext` data shape is changed — verifiable by `git diff backend/` showing no modifications and existing backend tests still passing.
- **SC-010**: WCAG 2.2 AA colour contrast is met for all body text, heading text, and interactive element labels against their respective backgrounds in the dark palette — verifiable by a browser accessibility audit.

---

## Assumptions

- The EduSpark design in `darktheme/eduspark-design/` is the authoritative visual reference. Any design detail not explicitly overridden in this spec should be implemented exactly as shown in that prototype.
- The existing React Context-based router (`screen` field in `SessionContext`) will be extended to handle `"leaderboard"` and `"about"` screen values so the new pages are reachable without introducing a routing library.
- Static mock data (hardcoded arrays) is sufficient for the Leaderboard in v1; no backend endpoint for leaderboard scores is in scope.
- The About page content (principles and roadmap) is static and does not require a CMS or backend.
- The `dandysWorld.js` theme file will be renamed or repurposed to export the EduSpark token set under the same export interface, so no consumer code (e.g., `setTheme()` call in `main.jsx`) needs to change.
- Google Fonts (Space Grotesk, Inter, JetBrains Mono) are loaded via `<link rel="preconnect">` + `<link rel="stylesheet" href="...&display=swap">` in `index.html`. No self-hosting or font subsetting is required for v1.
- The hamburger mobile menu will use a simple React state toggle (open/closed) with no animation library dependency.
- Existing Vitest tests that test component rendering may need snapshot updates after the visual redesign; those updates are expected and not considered regressions.
- WCAG 2.2 AA contrast compliance will be validated using browser DevTools accessibility audit; no automated CI contrast check is required for v1.
