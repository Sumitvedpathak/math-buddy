import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { theme, setTheme } from './dandysWorld'

describe('dandysWorld theme', () => {
  let root

  beforeEach(() => {
    root = document.createElement('div')
    root.id = 'theme-root'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.removeChild(root)
  })

  it('exports a theme object with required fields', () => {
    expect(theme.id).toBeDefined()
    expect(theme.displayName).toBeDefined()
    expect(theme.cssVars).toBeDefined()
    expect(typeof theme.cssVars).toBe('object')
  })

  it('sets CSS custom properties on #theme-root', () => {
    setTheme(theme)
    const rootEl = document.getElementById('theme-root')
    // At least one CSS var must be applied
    const hasVar = Object.keys(theme.cssVars).some(
      (key) => rootEl.style.getPropertyValue(key) !== ''
    )
    expect(hasVar).toBe(true)
  })

  it('setTheme does nothing if #theme-root is absent', () => {
    document.body.removeChild(root)
    expect(() => setTheme(theme)).not.toThrow()
    // Re-add for afterEach cleanup
    document.body.appendChild(root)
  })
})
