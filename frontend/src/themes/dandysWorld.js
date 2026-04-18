/** @type {import('./themes/dandysWorld').Theme} */

/**
 * Dandy's World-inspired theme tokens — dark vibrant edition.
 * Deep purples, electric blues, bright yellows, and neon greens for an
 * exciting, engaging feel aimed at 9–12 year old kids.
 * All values are CSS custom property name → value pairs.
 *
 * @type {Object}
 * @property {string} id
 * @property {string} displayName
 * @property {Record<string, string>} cssVars
 * @property {string} characterAsset - path to character SVG asset
 * @property {string} bgTileAsset - path to background tile SVG asset
 */
export const theme = {
  id: 'dandys-world',
  displayName: "Dandy's World",
  characterAsset: new URL('../assets/character.svg', import.meta.url).href,
  bgTileAsset: new URL('../assets/bg-tile.svg', import.meta.url).href,
  cssVars: {
    '--color-primary': '#facc15',
    '--color-primary-dark': '#eab308',
    '--color-secondary': '#38bdf8',
    '--color-accent': '#a78bfa',
    '--color-accent-green': '#4ade80',
    '--color-background': '#0f0a1e',
    '--color-surface': '#1a1035',
    '--color-surface-raised': '#241848',
    '--color-text-primary': '#f0e6ff',
    '--color-text-secondary': '#a89ec4',
    '--color-success': '#4ade80',
    '--color-warning': '#facc15',
    '--color-error': '#f87171',
    '--color-canvas-stroke': '#1e1b14',
    '--font-heading': '"Nunito", "Comic Sans MS", cursive',
    '--font-body': '"Nunito", "Segoe UI", sans-serif',
    '--radius-card': '1rem',
    '--radius-button': '0.75rem',
  },
}

/**
 * Apply a theme to the root wrapper element by writing CSS custom properties.
 * Does NOT cause a page reload.
 *
 * @param {typeof theme} themeObj - theme object with cssVars record
 * @returns {void}
 */
export function setTheme(themeObj) {
  const root = document.getElementById('theme-root')
  if (!root) return
  for (const [prop, value] of Object.entries(themeObj.cssVars)) {
    root.style.setProperty(prop, value)
  }
}
