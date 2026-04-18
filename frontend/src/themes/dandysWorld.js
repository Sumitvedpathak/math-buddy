/** @type {import('./themes/dandysWorld').Theme} */

/**
 * Dandy's World-inspired theme tokens.
 * Colour palette uses soft pastels with bold accent colours reminiscent of the game's aesthetic.
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
    '--color-primary': '#f7c948',
    '--color-primary-dark': '#d9a800',
    '--color-secondary': '#6ec6f0',
    '--color-accent': '#f97316',
    '--color-background': '#fef9ec',
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#fffbe8',
    '--color-text-primary': '#1e1b14',
    '--color-text-secondary': '#5c5340',
    '--color-success': '#22c55e',
    '--color-warning': '#f59e0b',
    '--color-error': '#ef4444',
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
