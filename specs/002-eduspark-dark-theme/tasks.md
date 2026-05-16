# Tasks: EduSpark Dark Design System

**Input**: Design documents from `specs/002-eduspark-dark-theme/`
**Branch**: `002-eduspark-dark-theme`
**Prerequisites**: [plan.md](plan.md) Â· [spec.md](spec.md) Â· [research.md](research.md) Â· [data-model.md](data-model.md) Â· [quickstart.md](quickstart.md)

**Tests**: Required by constitution (CA-003). New render tests for AppHeader, HomeScreen, Dashboard, Leaderboard, and About. All 37 existing tests must continue to pass.

**Organization**: Tasks are grouped by user story (7 stories) to enable independent implementation and testing. Phases 1â€“2 are blocking prerequisites. Phases 3â€“9 map to user stories. Phase 10 is polish.

## Format: `[ID] [P?] [Story?] Description â€” file/path`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to (US1â€“US7)
- Every task includes exact file path

---

## Phase 1: Setup â€” CSS & Build Foundation

**Purpose**: Replace all design tokens, typography, and Tailwind mappings. These tasks BLOCK everything else â€” no component work can begin until the token layer is stable.

- [x] T001 Replace all CSS custom properties in `frontend/src/index.css` with EduSpark oklch token set from `data-model.md` DesignToken catalogue; add `@layer base` resets (border-color, font, color-scheme: dark); add all 14 EduSpark `@layer utilities` classes (`.bg-hero-glow`, `.grid-paper`, `.bg-gradient-primary`, `.bg-gradient-accent`, `.text-gradient-primary`, `.ring-soft`, `.ring-soft-lg`, `.glow-primary`, `.glow-accent`, `.noise-overlay`, `.animate-float-slow`, `.animate-shimmer`, `.animate-pulse-glow`, `.font-display`, `.font-mono`); add keyframes for `float-slow`, `shimmer`, `pulse-glow` â€” `frontend/src/index.css`
- [x] T002 Update `frontend/tailwind.config.js` to map all EduSpark CSS variables to Tailwind tokens: colors (background, foreground, card, primary, secondary, muted, accent, destructive, success, border, input, ring, surface, surface-elevated, ink, ink-soft), fontFamily (display, sans, mono; keep heading/body as legacy aliases), borderRadius (sm, md, lg, xl, 2xl, 3xl; keep card/button as legacy aliases); add `loader` keyframe animation for loading bar â€” `frontend/tailwind.config.js`
- [x] T003 [P] Add Google Fonts preconnect and stylesheet links to `frontend/index.html`: `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">` â€” `frontend/index.html`
- [x] T004 [P] Rewrite `cssVars` object in `frontend/src/themes/dandysWorld.js` to export all 29 EduSpark tokens using the new naming convention (`--background` not `--color-background`); remove unused `characterAsset` and `bgTileAsset` fields; keep `setTheme()` function signature and behaviour unchanged â€” `frontend/src/themes/dandysWorld.js`

**Checkpoint**: `npm run dev` starts. The app background is deep-space dark (`oklch(0.13 0.02 270)`). Browser DevTools shows `--background` on the `html` element. `npm run lint` passes. `npm run test:run` â€” all 37 existing tests pass (some may need minor import-path fixes if token names changed in test fixtures, but no test logic changes).

---

## Phase 2: Foundational â€” Context & Router Extension

**Purpose**: Extend `SessionContext` with a `navigateTo` action and extend `App.jsx` to route to the two new screens. MUST be complete before any new page or nav component is built.

- [x] T005 Add `navigateTo(screen)` action to `frontend/src/context/SessionContext.jsx`: update the `AppScreen` typedef to include `"leaderboard"` and `"about"`; add `navigateTo = useCallback((screen) => setState(s => ({ ...s, screen })), [])` to the actions object â€” IMPORTANT: this must NOT reset any session state (questions, answers, evaluationResult must be preserved so the student can check the leaderboard mid-session and return to their dashboard) â€” `frontend/src/context/SessionContext.jsx`
- [x] T006 Add `Leaderboard` and `About` screen cases to the `renderScreen()` switch in `frontend/src/app/App.jsx`; import `Leaderboard` from `./Leaderboard` and `About` from `./About` (stubs are fine if the pages don't exist yet â€” create minimal placeholder components returning `<div>Leaderboard</div>` / `<div>About</div>` as temporary stubs) â€” `frontend/src/app/App.jsx`

**Checkpoint**: Navigating to `screen: 'leaderboard'` and `screen: 'about'` in SessionContext renders the stub components without errors. `npm run test:run` still passes.

---

## Phase 3: User Story 1 â€” Dark Theme Shell (Header & Footer) (Priority: P1)

**Goal**: Every page of the app shows the EduSpark sticky header (logo mark, branding, nav links with active state, CTA button, hamburger on mobile) and footer (logo, copyright, quick links). The design system token layer from Phase 1 is visible in the header's gradient logo mark and primary-gradient CTA button.

**Independent Test**: Open the app. The header is 64 px tall and sticky. It shows a gradient "m" logo square that rotates slightly on hover, "Math Buddy" with "Learn Â· Practice Â· Master" accent sub-label, navigation links (Home, Practice, Leaderboard, About), and a "Start practising" button with primary gradient. The footer shows the logo mark, copyright text, and quick links. Resize to 375 px â€” hamburger icon replaces nav links; tapping it reveals the menu; tapping any link closes the menu.

### Tests for User Story 1

- [x] T007 [P] [US1] Write Vitest render test for `AppHeader.jsx`: assert all four nav link labels (Home, Practice, Leaderboard, About) are present; assert "Start practising" button renders; assert hamburger button has `aria-label`; assert hamburger is not visible at desktop viewport (mock `window.innerWidth = 1280`) â€” `frontend/src/components/AppHeader.test.jsx`

### Implementation for User Story 1

- [x] T008 [US1] Rewrite `frontend/src/components/AppHeader.jsx` to match the EduSpark SiteHeader design:
  - Sticky `<header>` element, 64 px tall (`h-16`), `z-40`, `border-b border-border bg-background/70 backdrop-blur-xl`
  - Logo mark: `<div>` with `bg-gradient-primary` background, "m" text in `font-display`, rotates 6Â° on hover (`group-hover:rotate-6 transition-transform`)  
  - Branding: "Math Buddy" in `font-display font-semibold text-ink` + "Learn Â· Practice Â· Master" in `text-accent text-[10px] uppercase tracking-[0.18em]`
  - Nav links: consume `navigateTo` from `useSession()`; active state uses `bg-surface-elevated font-medium text-ink` pill; inactive uses `text-ink-soft hover:text-ink hover:bg-surface-elevated`; active detection: `state.screen === link.screen`
  - "Start practising" CTA: `bg-gradient-primary rounded-full glow-primary`, calls `navigateTo('practice')`
  - Mobile hamburger: `useState(false)` for `menuOpen`; hamburger button with `aria-label` and `aria-expanded`; mobile nav `<div>` shown/hidden with Tailwind `hidden md:block` pattern; each mobile nav link calls `handleNav(screen)` which calls `navigateTo(screen)` AND `setMenuOpen(false)`; `useEffect` closes menu when viewport â‰¥ 768 px on resize
  - `frontend/src/components/AppHeader.jsx`

- [x] T009 [P] [US1] Rewrite `frontend/src/components/AppFooter.jsx` to match EduSpark SiteFooter:
  - `<footer>` with `border-t border-border mt-24`
  - Logo mark (small, 28 px), "Â© {year} Math Buddy. Built for curious minds." in `text-ink-soft`
  - Quick links: About, Practice, Leaderboard â€” each calls `navigateTo(screen)` via `useSession()`
  - `frontend/src/components/AppFooter.jsx`

**Checkpoint**: Header and footer render on every screen. Active nav link highlights correctly when switching screens. Hamburger menu works on mobile viewport. `T007` test passes. `npm run lint` passes.

---

## Phase 4: User Story 2 â€” Redesigned Home Page (Priority: P1)

**Goal**: The home page presents four sections: (1) Hero with gradient headline, animated orbs, grid-paper background, live-badge pill, stat counters, and sample question card preview; (2) Tracks with four topic cards; (3) How It Works with three numbered steps; (4) CTA banner.

**Independent Test**: Navigate to the home screen. All four sections are visible on a single scroll at 1280 px viewport. The gradient headline renders. Two animated floating orbs are in the background. The stat block shows "4 Topic tracks", "100+ Questions / set", "2 Answer modes". The "Start a practice set" and "Begin practising" buttons call `navigateTo('practice')`.

### Tests for User Story 2

- [x] T010 [P] [US2] Update `frontend/src/app/HomeScreen.test.jsx`: assert hero section renders with headline text "Maths that hits"; assert "Start a practice set" button is present; assert four track cards render (Vedic Maths, Word Problems, Algebra, Volumes); assert three numbered steps render (01, 02, 03); assert "Begin practising" CTA renders â€” `frontend/src/app/HomeScreen.test.jsx`

### Implementation for User Story 2

- [x] T011 [US2] Rewrite `frontend/src/app/HomeScreen.jsx` to match the EduSpark home page layout:
  - **Hero section** (`<section className="relative overflow-hidden">`):
    - `<div className="absolute inset-0 bg-hero-glow pointer-events-none">` background glow
    - `<div className="absolute inset-0 grid-paper opacity-40 pointer-events-none">` grid texture
    - Two animated orbs: `<div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-float-slow">` and a second with `bg-accent/20` at bottom-left with `animationDelay: '2s'`
    - Left column (lg:col-span-7): Live-badge pill with pulsing dot, headline (`font-display text-5xl md:text-7xl`) with `<span className="text-gradient-primary">different.</span>`, body copy, two CTA buttons ("Start a practice set" â†’ `navigateTo('practice')`, "How it works" â†’ scrolls to method section), stat block (3 items: `dl` grid)
    - Right column (lg:col-span-5): Sample question card (`bg-card/80 backdrop-blur-xl ring-soft-lg noise-overlay`) showing a Vedic Maths example prompt and working
  - **Tracks section** (`<section className="border-t border-border bg-surface/40">`):
    - Section header with accent mono label `/ Tracks`, headline "Four foundations."
    - Four topic cards in `grid sm:grid-cols-2 lg:grid-cols-4`: Vedic Maths, Word Problems, Algebra, Volumes & Shapes â€” each with number badge, hover-lift class (`hover:-translate-y-1 transition-all`), rotating arrow on hover, gradient blob background
  - **How It Works section** (`<section>`):
    - Two-column layout: left column with `/Method` label and gradient headline; right column with `<ol>` of three steps (01 Configure, 02 Solve, 03 Review) in `grid-cols-[auto_1fr]` cards
  - **CTA banner** (`<section>`):
    - Full-width `bg-gradient-primary` rounded-3xl panel with grid-paper overlay, noise-overlay, accent orb, headline "Ready when you are.", "Begin practising" button â†’ `navigateTo('practice')` using `bg-accent text-accent-foreground glow-accent`
  - Remove `AnimatedBackground` import from `App.jsx` if it was only used by the old `HomeScreen` (verify first â€” if used elsewhere, keep it)
  - `frontend/src/app/HomeScreen.jsx`

**Checkpoint**: Home page renders all four sections. CTA buttons navigate to practice. `T010` test passes. `npm run lint` passes.

---

## Phase 5: User Story 3 â€” Redesigned Practice Setup Screen (Priority: P1)

**Goal**: The practice screen setup stage shows three numbered sections (Age Group, Topics, Question Count) inside a single rounded card with EduSpark styling. The status line and "Start practice" button are below the card. Validation (no topics selected) still works.

**Independent Test**: Navigate to Practice. Three labelled sections render inside a `bg-card ring-soft rounded-2xl` card. Age Group section shows two radio-style option cards. Topics section shows four checkbox-style cards with symbol, title, description. Question Count shows stepper + quick-set buttons. Selecting topics and clicking "Start practice" triggers the API call as before.

### Implementation for User Story 3

- [x] T012 [US3] Redesign the setup stage markup in `frontend/src/app/PracticePage.jsx` (the `stage === 'setup'` branch only):
  - Wrapping card: `<div className="rounded-2xl bg-card ring-soft overflow-hidden">`
  - `Section` helper component (inline): renders a `border-b border-border last:border-b-0 p-6 md:p-8` block with section number (font-mono text-xs text-primary), title (font-display), and optional hint text
  - **Section 01 â€” Age group**: `grid sm:grid-cols-2 gap-3`; each option is a `<button>` with `text-left rounded-xl border p-5`; active state: `border-primary bg-primary/5 ring-2 ring-primary/20`; inactive: `border-border bg-surface hover:border-ink/20`; contains title in `font-display text-lg` and subtitle in `text-sm text-ink-soft`; radio dot indicator (filled circle when active)
  - **Section 02 â€” Topics**: `grid sm:grid-cols-2 lg:grid-cols-4 gap-3`; each topic `<button>` with active `border-primary bg-primary/5 ring-2 ring-primary/20`; contains symbol in `font-display text-2xl text-primary`, title, description, checkbox indicator; validation message in `text-xs text-destructive` when no topic selected
  - **Section 03 â€” Question count**: inline stepper with `âˆ’` / `+` buttons + `<input type="number">`; quick-set buttons for [5, 10, 20, 30] using `bg-ink text-background` when active
  - Status line + "Start practice" button below card: status `text-sm text-ink-soft`; button `bg-primary text-primary-foreground rounded-md ring-soft-lg disabled:opacity-40`
  - Do NOT change loading, answering, or review stage logic â€” only the setup JSX
  - `frontend/src/app/PracticePage.jsx`

**Checkpoint**: Practice setup renders with new card layout. Validation still prevents starting with no topics. All `PracticePage.test.jsx` existing tests pass. `npm run lint` passes.

---

## Phase 6: User Story 4 â€” Redesigned Question Cards (Priority: P2)

**Goal**: Each question on the practice page uses a two-column card layout: question content on the left, answer area on the right. The session header shows a progress bar. The sticky Submit button is visible at the bottom.

**Independent Test**: Start a session. All question cards render in the two-column layout (question left, sketch/text toggle + canvas right). Drawing works. The progress bar advances. The sticky Submit button is always in view.

### Implementation for User Story 4

- [x] T013 [US4] Rewrite `frontend/src/components/QuestionCard.jsx` to match the EduSpark two-column card design:
  - Outer: `<article className="rounded-2xl bg-card ring-soft overflow-hidden">`
  - Card header: `<header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">` with question number badge (`h-7 w-7 rounded-full bg-primary text-primary-foreground font-mono text-xs`), topic label (`font-mono text-xs uppercase tracking-wider text-ink-soft`), position counter (`text-xs text-muted-foreground font-mono`)
  - Body: `<div className="grid md:grid-cols-2 gap-0">` â€” left column has question prompt (`font-display text-xl text-ink`), right column has mode toggle buttons + sketch/text area on `bg-surface-elevated/50` background
  - Mode toggle buttons: `ModeBtn` with active `bg-primary text-primary-foreground` / inactive `bg-muted text-ink-soft`
  - Sketch mode: `SketchCanvas` component (unchanged â€” keep all existing sketch/eraser/clear logic); canvas wrapped in `bg-white` with `rounded-lg border border-border`
  - Text mode: `<textarea>` with `border border-border bg-surface rounded-lg focus:ring-2 focus:ring-primary/30`
  - On mobile (< md) columns stack vertically â€” handled by `md:grid-cols-2` grid
  - Keep all existing prop interface (`question`, `answer`, `onAnswerChange`, etc.) unchanged so `PracticePage.jsx` requires no changes
  - `frontend/src/components/QuestionCard.jsx`

- [x] T014 [P] [US4] Update the Answering stage header in `frontend/src/app/PracticePage.jsx` (the `stage === 'answering'` branch): add session header with `font-display text-4xl` question count, body copy "Sketch or type your answer", and progress bar (`h-1 w-full rounded-full bg-muted` track with `bg-primary` fill width calculated from `answeredCount/totalCount * 100`); sticky Submit button: `<div className="sticky bottom-6 mt-10 z-30">` containing `bg-success text-success-foreground rounded-md ring-soft-lg w-full` button â€” `frontend/src/app/PracticePage.jsx`

**Checkpoint**: Question cards render in two columns on desktop. Progress bar animates. Sticky submit visible. `SketchCanvas.test.jsx` and `QuestionCard.test.jsx` all pass. `npm run lint` passes.

---

## Phase 7: User Story 5 â€” Redesigned Results Dashboard (Priority: P2)

**Goal**: The results dashboard shows a split-panel score hero (left: primary-coloured panel with raw score + contextual message; right: per-topic breakdown). Below, a full question review list shows each question with correct/incorrect badge, student answer, and correct answer.

**Independent Test**: Complete a session. The split-panel hero renders with primary background on the left. Score fraction displays in large `font-display text-7xl`. Per-topic bars render on the right. The review list shows every question with a badge. "Start a new set" returns to setup.

### Tests for User Story 5

- [x] T015 [P] [US5] Update `frontend/src/app/Dashboard.test.jsx`: assert score hero renders (look for the score fraction element); assert per-topic section header renders; assert at least one review card renders; assert "Start a new set" button is present â€” `frontend/src/app/Dashboard.test.jsx`

### Implementation for User Story 5

- [x] T016 [US5] Rewrite `frontend/src/app/Dashboard.jsx` to match the EduSpark review layout:
  - **Score hero**: `<section className="rounded-3xl overflow-hidden ring-soft-lg bg-card">` with `<div className="grid md:grid-cols-[1.2fr_1fr]">`
    - Left panel: `bg-primary text-primary-foreground relative overflow-hidden` with `grid-paper opacity-[0.08]` overlay; large score fraction `font-display text-7xl md:text-8xl`; percentage `text-lg`; contextual message (four tiers: 100% "Flawless. That's mastery.", â‰¥70% "Strong work.", â‰¥40% "Good effort.", <40% "Keep practising.")
    - Right panel: `/ By topic` mono label, per-topic `<ul>` with topic name, score fraction, `h-1.5` progress bar
    - "Start a new set" button: `bg-ink text-background rounded-md hover:opacity-90`; calls `resetSession()` from `useSession()`
  - **Review list**: `<section className="mt-12">` with heading "Question review"; `<div className="space-y-3">` containing one `<article className="rounded-xl bg-card ring-soft p-6">` per question
    - Each card: question index + prompt text; "Correct" (green, `bg-success/15 text-success`) or "Review" (red, `bg-destructive/10 text-destructive`) badge `rounded-full px-3 py-1 text-xs`; encouragement/feedback text in `text-sm text-ink-soft`; two columns â€” "Your answer" box (`bg-surface-elevated border border-border`) and "Correct answer" box (`bg-success/5 border border-success/30`)
  - Use existing `evaluationResult` from `useSession()` state â€” do NOT change data shape
  - `frontend/src/app/Dashboard.jsx`

**Checkpoint**: Dashboard renders both panels. Correct/Review badges show. Review list renders all questions. `T015` test passes. `npm run lint` passes.

---

## Phase 8: User Story 6 â€” Leaderboard Page (Priority: P3)

**Goal**: A new Leaderboard page accessible via the header nav shows a top-3 podium and a full ranked table. Uses static mock data.

**Independent Test**: Click "Leaderboard" in the header nav. The podium renders (rank 2 left, rank 1 centre elevated, rank 3 right). The table renders all 8 mock entries with rank, name, level, sets, accuracy, streak. No errors in console.

### Tests for User Story 6

- [x] T017 [P] [US6] Write Vitest render test for `Leaderboard.jsx`: assert podium section renders; assert rank 1 entry's name appears (e.g., "Aarav S."); assert the full table header columns render (Rank, Learner, Level, Sets, Accuracy, Streak) â€” `frontend/src/app/Leaderboard.test.jsx`

### Implementation for User Story 6

- [x] T018 [US6] Create `frontend/src/app/Leaderboard.jsx` with the EduSpark leaderboard layout:
  - Static `RANKS` array: 8 entries, each with `{ rank, name, level, sets, accuracy, streak }` â€” use the same mock data from `darktheme/eduspark-design/src/routes/leaderboard.tsx`
  - Page header: `/ Leaderboard` mono label, headline "This week's most consistent.", subtitle copy
  - **Podium** (`<div className="grid sm:grid-cols-3 gap-4 mb-10">`): order is [rank2, rank1, rank3]; rank 1 card gets `sm:-mt-4` to appear elevated; each card is `rounded-2xl bg-card ring-soft p-6`; medal badge: rank 1 uses `bg-accent text-accent-foreground`, rank 2 uses `bg-muted text-ink`, rank 3 uses `bg-secondary text-ink-soft`; each card shows name, level, and a 3-col stats grid (Sets, Accuracy %, Streak)
  - **Ranked table** (`<div className="rounded-2xl bg-card ring-soft overflow-hidden">`): `grid grid-cols-[60px_1fr_140px_100px_100px_80px]` layout; header row with `bg-surface-elevated text-[10px] uppercase tracking-wider text-muted-foreground`; data rows with `hover:bg-surface-elevated transition-colors`; rank in `font-mono text-ink-soft`, name in `font-display font-semibold`, accuracy and streak right-aligned
  - Replace the temporary stub created in T006
  - `frontend/src/app/Leaderboard.jsx`

**Checkpoint**: Leaderboard nav link works. Podium renders with correct medal colours. Table shows all 8 entries. `T017` test passes. `npm run lint` passes.

---

## Phase 9: User Story 7 â€” About Page (Priority: P3)

**Goal**: A new About page shows four principles and a roadmap with four timeline entries, plus a CTA linking to practice.

**Independent Test**: Click "About" in the header nav. Both columns render. Four principles listed. Four roadmap entries with timeline labels. "Start practising" CTA links to practice screen.

### Tests for User Story 7

- [x] T019 [P] [US7] Write Vitest render test for `About.jsx`: assert heading renders; assert principle "Working over answers." is present; assert roadmap entry "Maths Â· ages 9â€“12" is present; assert "Start practising" CTA button renders â€” `frontend/src/app/About.test.jsx`

### Implementation for User Story 7

- [x] T020 [US7] Create `frontend/src/app/About.jsx` with the EduSpark about page layout:
  - `/ About` mono label, large headline ("We're building the practice studio we wished we had.")
  - Intro paragraph
  - Two-column section (`md:grid-cols-2`):
    - **Principles** (left): four `<li>` items: "Working over answers.", "Kindness in feedback.", "Quiet by design.", "Built to grow." â€” each with bold title (`font-display text-base`) and description sentence
    - **What's next** (right): four roadmap `<li>` cards (`rounded-lg border border-border bg-card px-4 py-3`), each with timeline label in `font-mono text-xs text-primary` and title in `font-display`; availability badge: "available" uses `bg-success/15 text-success`, others use `bg-muted text-ink-soft`; roadmap: `{ Now, Maths Â· ages 9â€“12, available }`, `{ Q2, Maths Â· ages 13â€“16, in progress }`, `{ Q3, Science & physics tracks, planned }`, `{ Q4, Teacher dashboards, planned }`
  - CTA block: `rounded-2xl bg-primary text-primary-foreground p-10`; headline "Try it for yourself."; "Start practising â†’" button (`bg-accent text-accent-foreground`) calls `navigateTo('practice')`
  - Replace the temporary stub created in T006
  - `frontend/src/app/About.jsx`

**Checkpoint**: About nav link works. Principles and roadmap render. CTA navigates to practice. `T019` test passes. `npm run lint` passes.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Verify shared components auto-inherit new design tokens; fix any remaining visual gaps; accessibility audit; final lint and test run.

- [x] T021 [P] Verify `frontend/src/components/LoadingScreen.jsx` correctly inherits EduSpark token colours without additional class changes; if the progress bar or fun facts card still uses old hardcoded colours, update to use `bg-primary`, `bg-card ring-soft`, `text-primary font-mono`, `text-ink` etc.; keep all existing logic (progress animation, fact rotation) unchanged â€” `frontend/src/components/LoadingScreen.jsx`
- [x] T022 [P] Verify `frontend/src/components/ErrorBanner.jsx` uses EduSpark destructive palette (`bg-destructive/10 border border-destructive/30 text-destructive`) and primary/accent colours for the retry button; keep all existing logic unchanged â€” `frontend/src/components/ErrorBanner.jsx`
- [x] T023 [P] Verify `frontend/src/app/App.jsx` no longer needs the `AnimatedBackground` component (the new `HomeScreen` provides its own background effects); if `AnimatedBackground` is now unused, remove the import to keep the component tree clean â€” `frontend/src/app/App.jsx`, `frontend/src/components/AnimatedBackground.jsx`
- [x] T024 Run full test suite and lint: `npm run test:run && npm run lint` from `frontend/`; fix any failing tests or lint errors introduced by the redesign (expected: minor import updates in tests that reference old CSS class names); document passing count in this task's completion note
- [x] T025 [P] Update `memory/project_overview.md` to reflect the completed EduSpark design migration and the new screen values in SessionContext â€” `memory/project_overview.md`

**Final Checkpoint** (from quickstart.md):
1. `npm run dev` â†’ background is deep-space dark, header sticky with gradient logo
2. All four home page sections visible on one scroll
3. Practice setup renders three-section card
4. Question cards render two-column layout
5. Dashboard renders split-panel score hero
6. Leaderboard accessible via nav â€” podium + table render
7. About accessible via nav â€” principles + roadmap render
8. Hamburger menu works at 375 px; auto-closes on link tap
9. `npm run test:run` â€” all tests pass
10. `npm run lint` â€” zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies â€” start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 â€” BLOCKS Phases 3â€“10
- **Phase 3 (US1 â€” Header/Footer)**: Depends on Phase 2; blocks Phases 4â€“9 (nav links in header must work before testing page routing)
- **Phase 4 (US2 â€” Home Page)**: Depends on Phase 3 (header present)
- **Phase 5 (US3 â€” Practice Setup)**: Depends on Phase 3; independent of Phase 4
- **Phase 6 (US4 â€” Question Cards)**: Depends on Phase 5 (setup must be styled first)
- **Phase 7 (US5 â€” Dashboard)**: Depends on Phase 6 (need a complete session to reach dashboard)
- **Phase 8 (US6 â€” Leaderboard)**: Depends on Phase 2; fully independent of Phases 4â€“7
- **Phase 9 (US7 â€” About)**: Depends on Phase 2; fully independent of Phases 4â€“8
- **Phase 10 (Polish)**: Depends on all phases complete

### Parallel Opportunities Within Each Phase

- Phase 1: T003 and T004 can run in parallel (different files)
- Phase 3: T009 (footer) can run in parallel with T007+T008 (header + test)
- Phases 8 and 9 (Leaderboard and About) can run in parallel after Phase 2
- Phase 10: T021, T022, T023, T025 all fully parallel

---

## Implementation Strategy

### MVP First (Phase 1â€“3 only)

1. Complete Phase 1: CSS tokens + Tailwind + fonts + dandysWorld.js
2. Complete Phase 2: SessionContext extension + App.jsx router stubs
3. Complete Phase 3: AppHeader + AppFooter
4. **STOP and VALIDATE**: All pages have the dark theme shell. Header nav works.

### Incremental Delivery

1. Phases 1â€“3 â†’ Dark shell visible on all pages (MVP)
2. Phase 4 â†’ New home page with hero and tracks
3. Phase 5 â†’ Styled practice setup
4. Phases 6â€“7 â†’ Redesigned practice flow + dashboard
5. Phases 8â€“9 â†’ New Leaderboard and About pages
6. Phase 10 â†’ Polish + passing test suite

### Parallel Team Strategy

With two developers after Phase 3:
- **Dev A**: Phases 4 â†’ 5 â†’ 6 â†’ 7 (home + practice flow)
- **Dev B**: Phases 8 + 9 in parallel (Leaderboard + About)

---

## Notes

- All `[P]` tasks touch different files â€” safe to run concurrently
- Do NOT modify any files under `backend/` â€” this is a UI-only migration
- Do NOT change `SessionContext` data shapes, action signatures, or `api.js` calls
- Keep `SketchCanvas.jsx` entirely unchanged â€” it has its own test coverage
- The `darktheme/eduspark-design/` directory is READ-ONLY reference â€” do not modify it
- After T001 completes, the Tailwind `font-display` and `font-mono` classes become available globally â€” later tasks can use them without additional setup
- When old CSS class names (e.g., `font-heading`, `text-primary`) are still used in existing components during migration, they remain valid via the legacy alias entries in `tailwind.config.js` â€” remove them gradually as each component is redesigned

