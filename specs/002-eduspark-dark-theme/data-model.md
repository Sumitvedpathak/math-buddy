# Data Model: EduSpark Dark Design System

**Feature**: `002-eduspark-dark-theme`  
**Date**: 2026-05-16

---

## DesignToken

Represents one CSS custom property in the EduSpark palette. Stored as a JS key–value pair in `dandysWorld.js` `cssVars`; applied via `setTheme()` to `#theme-root` inline styles.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | CSS custom property name, e.g. `--background` |
| `value` | `string` | CSS value, e.g. `oklch(0.13 0.02 270)` |

**Token catalogue (`:root` layer)**:

| Token | Value | Role |
|---|---|---|
| `--radius` | `0.875rem` | Base border-radius unit |
| `--background` | `oklch(0.13 0.02 270)` | Page background (deep space) |
| `--foreground` | `oklch(0.97 0.01 90)` | Default text colour |
| `--ink` | `oklch(0.98 0.008 90)` | Heading / strong text |
| `--ink-soft` | `oklch(0.74 0.02 270)` | Secondary text |
| `--surface` | `oklch(0.17 0.025 270)` | Card / panel background |
| `--surface-elevated` | `oklch(0.21 0.03 275)` | Elevated surface (header rows) |
| `--card` | `oklch(0.17 0.025 270)` | Card background |
| `--card-foreground` | `oklch(0.97 0.01 90)` | Card text |
| `--primary` | `oklch(0.7 0.24 295)` | Electric violet — CTAs, active states |
| `--primary-foreground` | `oklch(0.13 0.02 270)` | Text on primary |
| `--secondary` | `oklch(0.24 0.04 280)` | Secondary button surface |
| `--secondary-foreground` | `oklch(0.97 0.01 90)` | Text on secondary |
| `--muted` | `oklch(0.22 0.025 275)` | Muted surface |
| `--muted-foreground` | `oklch(0.68 0.02 275)` | Muted text / labels |
| `--accent` | `oklch(0.88 0.22 130)` | Neon lime — highlight accents |
| `--accent-foreground` | `oklch(0.16 0.04 270)` | Text on accent |
| `--destructive` | `oklch(0.68 0.24 18)` | Error / destructive |
| `--destructive-foreground` | `oklch(0.98 0.01 90)` | Text on destructive |
| `--success` | `oklch(0.82 0.2 155)` | Success / correct |
| `--success-foreground` | `oklch(0.13 0.02 270)` | Text on success |
| `--border` | `oklch(1 0 0 / 9%)` | Subtle border |
| `--input` | `oklch(1 0 0 / 12%)` | Input field background |
| `--ring` | `oklch(0.7 0.24 295)` | Focus ring colour |
| `--font-display` | `"Space Grotesk", ui-sans-serif, system-ui, sans-serif` | Display / heading font |
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, sans-serif` | Body font |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` | Monospace / label font |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Small radius |
| `--radius-md` | `calc(var(--radius) - 2px)` | Medium radius |
| `--radius-lg` | `var(--radius)` | Large radius |
| `--radius-xl` | `calc(var(--radius) + 4px)` | XL radius |
| `--radius-2xl` | `calc(var(--radius) + 8px)` | 2XL radius |
| `--radius-3xl` | `calc(var(--radius) + 12px)` | 3XL radius |
| `--gradient-hero` | (multi-layer radial gradient) | Hero background glow |
| `--gradient-primary` | `linear-gradient(135deg, oklch(0.7 0.24 295), oklch(0.7 0.22 330))` | Primary gradient |
| `--gradient-accent` | `linear-gradient(135deg, oklch(0.88 0.22 130), oklch(0.82 0.2 175))` | Accent gradient |
| `--glow-primary` | (box-shadow composite) | Primary element glow |
| `--glow-accent` | (box-shadow composite) | Accent element glow |

---

## Screen (extended)

The `screen` field in `SessionContext` is a string enum. Two new values are added:

| Value | Description | Component |
|---|---|---|
| `'home'` | Home / landing page | `HomeScreen.jsx` |
| `'loading'` | Question generation loading | `LoadingScreen.jsx` |
| `'practice'` | Active practice session | `PracticePage.jsx` |
| `'evaluating'` | Answer evaluation loading | `LoadingScreen.jsx` |
| `'dashboard'` | Results dashboard | `Dashboard.jsx` |
| `'leaderboard'` | **New** — leaderboard page | `Leaderboard.jsx` |
| `'about'` | **New** — about page | `About.jsx` |

---

## NavigationLink

Used in `AppHeader.jsx` to render the nav link list. Replaces the previous implicit set of links.

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Display text, e.g. `"Home"` |
| `screen` | `Screen` | Target screen value to dispatch to SessionContext |
| `exact` | `boolean` | If true, active only on exact screen match (used for Home) |

**Nav link catalogue**:

| label | screen | exact |
|---|---|---|
| Home | `'home'` | `true` |
| Practice | `'practice'` | `false` |
| Leaderboard | `'leaderboard'` | `false` |
| About | `'about'` | `false` |

---

## LeaderboardEntry (static mock)

| Field | Type | Description |
|---|---|---|
| `rank` | `number` | Position (1–N) |
| `name` | `string` | Learner display name |
| `level` | `string` | "Junior Explorer" or "Senior Champion" |
| `sets` | `number` | Completed practice sets |
| `accuracy` | `number` | Accuracy percentage (0–100) |
| `streak` | `number` | Current day streak |

---

## Custom Utility Classes (CSS API)

These classes form the visual design API consumed by JSX components:

| Class | CSS effect |
|---|---|
| `.bg-hero-glow` | Multi-layer radial gradient hero background |
| `.grid-paper` | Subtle 32 px grid lines overlay |
| `.bg-gradient-primary` | Primary violet linear gradient background |
| `.bg-gradient-accent` | Accent lime linear gradient background |
| `.text-gradient-primary` | Violet→lime gradient clipped to text |
| `.ring-soft` | Subtle box-shadow + 1 px border glow |
| `.ring-soft-lg` | Elevated box-shadow + purple tint glow |
| `.glow-primary` | Electric violet glow ring + shadow |
| `.glow-accent` | Neon lime glow ring + shadow |
| `.noise-overlay` | Fractal noise texture via `::before` SVG |
| `.animate-float-slow` | Gentle Y-axis floating animation (6 s) |
| `.animate-shimmer` | Horizontal shimmer sweep (2.5 s) |
| `.animate-pulse-glow` | Expanding ring pulse (2.4 s) |
| `.font-display` | Apply Space Grotesk display font |
| `.font-mono` | Apply JetBrains Mono |
