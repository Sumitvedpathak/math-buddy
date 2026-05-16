/**
 * EduSpark dark theme tokens.
 * CSS custom property name → value pairs applied to #theme-root by setTheme().
 * The same tokens are defined on :root in index.css; inline styles here
 * override :root, enabling runtime theme switching without a page reload.
 */
export const theme = {
  id: 'eduspark-dark',
  displayName: 'EduSpark Dark',
  cssVars: {
    '--radius': '0.875rem',
    '--background': 'oklch(0.13 0.02 270)',
    '--foreground': 'oklch(0.97 0.01 90)',
    '--ink': 'oklch(0.98 0.008 90)',
    '--ink-soft': 'oklch(0.74 0.02 270)',
    '--surface': 'oklch(0.17 0.025 270)',
    '--surface-elevated': 'oklch(0.21 0.03 275)',
    '--card': 'oklch(0.17 0.025 270)',
    '--card-foreground': 'oklch(0.97 0.01 90)',
    '--primary': 'oklch(0.7 0.24 295)',
    '--primary-foreground': 'oklch(0.13 0.02 270)',
    '--secondary': 'oklch(0.24 0.04 280)',
    '--secondary-foreground': 'oklch(0.97 0.01 90)',
    '--muted': 'oklch(0.22 0.025 275)',
    '--muted-foreground': 'oklch(0.68 0.02 275)',
    '--accent': 'oklch(0.88 0.22 130)',
    '--accent-foreground': 'oklch(0.16 0.04 270)',
    '--destructive': 'oklch(0.68 0.24 18)',
    '--destructive-foreground': 'oklch(0.98 0.01 90)',
    '--success': 'oklch(0.82 0.2 155)',
    '--success-foreground': 'oklch(0.13 0.02 270)',
    '--border': 'oklch(1 0 0 / 9%)',
    '--input': 'oklch(1 0 0 / 12%)',
    '--ring': 'oklch(0.7 0.24 295)',
    '--font-display': '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    '--font-sans': '"Inter", ui-sans-serif, system-ui, sans-serif',
    '--font-mono': '"JetBrains Mono", ui-monospace, monospace',
    '--gradient-primary': 'linear-gradient(135deg, oklch(0.7 0.24 295), oklch(0.7 0.22 330))',
    '--gradient-accent': 'linear-gradient(135deg, oklch(0.88 0.22 130), oklch(0.82 0.2 175))',
    '--glow-primary': '0 0 0 1px oklch(0.7 0.24 295 / 0.4), 0 8px 32px -8px oklch(0.7 0.24 295 / 0.55)',
    '--glow-accent': '0 0 0 1px oklch(0.88 0.22 130 / 0.5), 0 10px 40px -10px oklch(0.88 0.22 130 / 0.6)',
  },
}

/**
 * Apply a theme to #theme-root by writing CSS custom properties as inline styles.
 * Overrides :root values without a page reload (CSS inline specificity wins).
 *
 * @param {typeof theme} themeObj
 */
export function setTheme(themeObj) {
  const root = document.getElementById('theme-root')
  if (!root) return
  for (const [prop, value] of Object.entries(themeObj.cssVars)) {
    root.style.setProperty(prop, value)
  }
}
