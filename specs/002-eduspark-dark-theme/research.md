# Research: EduSpark Dark Design System Migration

**Feature**: `002-eduspark-dark-theme`  
**Date**: 2026-05-16  
**Phase**: 0 — Technical decisions resolved before implementation

---

## Decision 1: Tailwind CSS version strategy

**Decision**: Stay on Tailwind CSS v3 (`^3.4.14`). Do NOT upgrade to v4.

**Rationale**: The EduSpark prototype (`darktheme/eduspark-design/`) uses Tailwind v4 syntax (`@import "tailwindcss"`, `@theme inline`, `@source`, `@custom-variant`). However, the existing app is pinned to v3. All design goals are achievable in v3:
- CSS custom properties go on `:root` in `index.css` (identical in both versions)
- Custom utility classes go in `@layer utilities { }` (identical in both versions)
- Token-to-Tailwind-class mapping goes in `tailwind.config.js` `theme.extend` (v3 approach)
- `color-mix()` and `oklch()` are CSS features, not Tailwind-version dependent

**Alternatives considered**:
- Upgrade to v4: Would require rewriting `tailwind.config.js` to use `@theme` directives, removing `postcss.config.js`, updating every Tailwind class that changed between v3 and v4 — excessive blast radius for a UI reskin.

---

## Decision 2: oklch / color-mix() browser compatibility

**Decision**: Use `oklch()` for all design tokens and `color-mix(in oklab, ...)` for derived surface colours, matching the EduSpark reference exactly.

**Rationale**: Browser support for `oklch()` is Chrome 111+ (Mar 2023), Firefox 113+ (May 2023), Safari 15.4+ (Mar 2022). `color-mix()` is Chrome 111+, Firefox 113+, Safari 16.2+ (Sep 2022). The spec assumes "modern browsers with HTML Canvas support" — these thresholds are well within that assumption. No polyfill is needed.

**Alternatives considered**:
- Hex/HSL fallbacks: Would lose perceptual uniformity of the oklch palette. Not needed.

---

## Decision 3: CSS custom property naming convention

**Decision**: Adopt the EduSpark naming convention (`--background`, `--foreground`, `--primary`, `--accent`, `--card`, `--surface`, `--surface-elevated`, `--ink`, `--ink-soft`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--success`, `--destructive`, `--radius`) on `:root` in `index.css`. The Tailwind config maps these via `var(--*)`.

**Migration from old names**: The `dandysWorld.js` `cssVars` object is rewritten to export the new token set under the new names. `setTheme()` continues to write to `#theme-root` inline styles, overriding `:root` for runtime theme switching. No consumer code changes outside of `dandysWorld.js`.

**Rationale**: Naming aligns with the visual reference design 1-to-1, making future design updates trivially traceable. Short names reduce CSS verbosity.

---

## Decision 4: Google Fonts loading

**Decision**: In `index.html`, add:
1. `<link rel="preconnect" href="https://fonts.googleapis.com">`
2. `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
3. `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`

The `display=swap` parameter prevents FOIT (invisible text). System fallback fonts render instantly; brand fonts replace them on load.

**Rationale**: Confirmed in clarifications session. Simplest approach, no build-step changes.

---

## Decision 5: Tailwind config token mapping

**Decision**: Update `tailwind.config.js` with the full EduSpark token set:

```js
theme: {
  extend: {
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
      primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
      secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
      muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
      accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
      destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
      success: { DEFAULT: 'var(--success)', foreground: 'var(--success-foreground)' },
      border: 'var(--border)',
      input: 'var(--input)',
      ring: 'var(--ring)',
      surface: 'var(--surface)',
      'surface-elevated': 'var(--surface-elevated)',
      ink: 'var(--ink)',
      'ink-soft': 'var(--ink-soft)',
    },
    fontFamily: {
      display: 'var(--font-display)',
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
      // legacy aliases kept for backward compatibility during migration
      heading: 'var(--font-display)',
      body: 'var(--font-sans)',
    },
    borderRadius: {
      'sm': 'var(--radius-sm)',
      'md': 'var(--radius-md)',
      'lg': 'var(--radius-lg)',
      'xl': 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      '3xl': 'var(--radius-3xl)',
      // legacy
      card: 'var(--radius-lg)',
      button: 'var(--radius-md)',
    },
  }
}
```

---

## Decision 6: Custom utility class approach

**Decision**: All EduSpark signature utilities are added to `@layer utilities` in `index.css`. They use only GPU-composited properties (`transform`, `opacity`, `box-shadow`, `background`) — no layout triggers.

**Classes to add**: `.bg-hero-glow`, `.grid-paper`, `.bg-gradient-primary`, `.bg-gradient-accent`, `.text-gradient-primary`, `.ring-soft`, `.ring-soft-lg`, `.glow-primary`, `.glow-accent`, `.noise-overlay`, `.animate-float-slow`, `.animate-shimmer`, `.animate-pulse-glow`, `.font-display`, `.font-mono`.

**Keyframes to add**: `float-slow`, `shimmer`, `pulse-glow`, `loader` (for loading bar).

---

## Decision 7: Navigation for new pages (Leaderboard, About)

**Decision**: Extend `SessionContext` screen type to include `'leaderboard'` and `'about'`. Add cases to `App.jsx` router switch. Add nav links to `AppHeader.jsx`. No routing library required.

**Rationale**: The existing context-based router handles screen transitions trivially. Adding two screen values is a minimal, zero-dependency change consistent with the existing architecture.

---

## Decision 8: Mobile hamburger menu

**Decision**: Implement with a single `isMenuOpen` boolean `useState` in `AppHeader.jsx`. Menu opens on hamburger button click. Menu closes when: (a) any nav link is clicked, (b) outside the menu is clicked, (c) viewport resizes to ≥ 768 px. No animation library — use `hidden`/`block` Tailwind classes.

**Rationale**: Confirmed in clarifications session (auto-close on link click). Simple boolean state is the right tool; animation can be added later without architecture change.

---

## Decision 9: Leaderboard data source

**Decision**: Static hardcoded array in `Leaderboard.jsx` — no backend endpoint. Same 8-entry mock dataset used in the EduSpark prototype.

**Rationale**: Spec explicitly states static mock data is acceptable for v1.

---

## Decision 10: Theme token application order

**Decision**: Base tokens are defined on `:root` in `index.css` (always-on baseline). `setTheme()` in `dandysWorld.js` writes the same tokens as inline styles on `#theme-root`, providing runtime override capability (overrides `:root` due to specificity). Result: single source of truth in CSS, JS object is a superset for programmatic switching.

**Rationale**: Existing `setTheme()` contract preserved. Runtime theme switching still works without a page reload (FR-018 from spec 001 still satisfied).
