---
name: project-overview
description: Math Buddy app overview — tech stack, structure, current state, and completed EduSpark dark design system migration
metadata:
  type: project
---

Math Buddy is an AI-powered math practice web app (ages 9–12) built with FastAPI backend + React/Vite frontend.

**Backend**: Python/FastAPI at `backend/app/`, LLM via OpenRouter (Gemini 2.0 Flash), prompts as Jinja2 `.txt` files in `backend/prompts/`.

**Frontend**: React 18 + Vite JSX (not TSX), Tailwind CSS 3 + CSS custom properties, react-sketch-canvas. State in `SessionContext.jsx`. API calls centralised in `src/lib/api.js`.

**Current screens**: HomeScreen (landing) → PracticePage (setup stage → LoadingScreen → questions) → Dashboard. Also: Leaderboard, About. Navigation via `navigateTo()` in SessionContext.

**EduSpark dark design system (COMPLETED 2026-05-16)**:
- CSS: oklch color space, Space Grotesk display font, Inter body, JetBrains Mono — all defined in `src/index.css` `:root`
- Key tokens: `--background` (deep space), `--primary` (electric violet), `--accent` (neon lime)
- Custom utilities in `@layer utilities`: `.bg-hero-glow`, `.grid-paper`, `.text-gradient-primary`, `.ring-soft`, `.ring-soft-lg`, `.glow-primary`, `.glow-accent`, `.noise-overlay`, `.animate-float-slow`
- `src/themes/dandysWorld.js` exports the EduSpark token set (renamed from Dandy's World)
- `SessionContext` has `navigateTo(screen)` action for screen changes without state reset
- App screen enum includes: `'home'|'loading'|'practice'|'evaluating'|'dashboard'|'leaderboard'|'about'`
- PracticePage: shows setup (3-section card) when `questions.length === 0`, answering stage otherwise
- 57 tests pass; 2 pre-existing lint errors in untouched files (ErrorBoundary.jsx, ScoreCard.test.jsx)

**Why:** User wanted the EduSpark dark design system applied to modernise the app's visual identity.

**How to apply:** When modifying UI, use oklch tokens via Tailwind classes (bg-primary, text-ink, bg-surface-elevated, etc). No backend changes needed for UI work.
