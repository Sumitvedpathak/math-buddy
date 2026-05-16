# Quickstart: EduSpark Dark Design System

**Feature**: `002-eduspark-dark-theme`  
**Date**: 2026-05-16

---

## Prerequisites

- Node.js 20+
- Existing Math Buddy frontend dependencies installed (`cd frontend && npm install`)
- No additional packages required for this feature

---

## Run the frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

---

## Visual verification checklist

After starting the dev server, confirm:

1. **Background** — Page background is deep-space dark (near-black with violet tint), not white or grey
2. **Header** — Sticky 64 px bar with gradient "m" logo mark, "Math Buddy / Learn · Practice · Master", nav links, "Start practising" button
3. **Hero headline** — Text gradient (violet → lime) on "different." in the headline
4. **Floating orbs** — Two animated blurred circles visible in hero background
5. **Grid paper** — Subtle 32 px grid lines visible in hero section
6. **Topic cards** — Four track cards with hover lift on home page
7. **Practice setup** — Three-section card layout with EduSpark card styling
8. **Leaderboard** — Accessible via "Leaderboard" nav link; podium + table render
9. **About** — Accessible via "About" nav link; principles + roadmap render
10. **Mobile** (resize to < 768 px) — Hamburger icon replaces nav links; clicking any link closes the menu

---

## Run tests

```bash
cd frontend
npm test          # watch mode
npm run test:run  # single run (CI)
```

All existing 37 tests must pass. New/updated tests for `AppHeader`, `HomeScreen`, `Dashboard` must also pass.

---

## Lint check

```bash
cd frontend
npm run lint
```

Zero ESLint errors required across all modified files.

---

## Reference design

The visual source of truth is `darktheme/eduspark-design/`. Run it locally with:

```bash
cd darktheme/eduspark-design
bun install    # or npm install
bun dev        # → http://localhost:3000
```

Compare rendered output side-by-side when validating the implementation.

---

## Key files modified by this feature

| File | Change |
|---|---|
| `frontend/index.html` | Add Google Fonts preconnect + stylesheet links |
| `frontend/src/index.css` | Replace Dandy's World CSS with EduSpark tokens + utilities |
| `frontend/tailwind.config.js` | Update token mappings to new CSS variable names |
| `frontend/src/themes/dandysWorld.js` | Rewrite `cssVars` to EduSpark token set |
| `frontend/src/app/App.jsx` | Add `leaderboard` and `about` cases to router |
| `frontend/src/components/AppHeader.jsx` | Full redesign to EduSpark SiteHeader |
| `frontend/src/components/AppFooter.jsx` | Redesign to EduSpark SiteFooter |
| `frontend/src/app/HomeScreen.jsx` | Full redesign to EduSpark hero layout |
| `frontend/src/app/PracticePage.jsx` | Redesign setup step to 3-section card layout |
| `frontend/src/components/QuestionCard.jsx` | Redesign to two-column layout |
| `frontend/src/app/Dashboard.jsx` | Redesign to split-panel score hero |
| `frontend/src/app/Leaderboard.jsx` | **New** — podium + ranked table |
| `frontend/src/app/About.jsx` | **New** — principles + roadmap |
| `frontend/src/components/LoadingScreen.jsx` | Restyle to EduSpark card pattern |
| `frontend/src/components/ErrorBanner.jsx` | Restyle to EduSpark destructive palette |
