import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const source = (path: string): string => readFileSync(join(root, path), 'utf8')

describe('commercial visual system', () => {
  it('uses a transparent vector brand mark instead of a colored tile', () => {
    const logo = source('src/renderer/src/components/AppLogo.vue')

    expect(logo).toContain('class="mark-orbit"')
    expect(logo).toContain('class="mark-page')
    expect(logo).not.toMatch(/\.app-logo\s*\{[^}]*background:/s)
    expect(logo).not.toContain('<rect')
  })

  it('defines semantic surface, border and focus tokens', () => {
    const tokens = source('src/renderer/src/styles/variables.css')

    expect(tokens).toContain('--surface-canvas:')
    expect(tokens).toContain('--surface-raised:')
    expect(tokens).toContain('--border-subtle:')
    expect(tokens).toContain('--brand-highlight:')
    expect(tokens).toContain('--focus-ring:')
  })

  it('uses a bright healing palette and starts new users in light mode', () => {
    const tokens = source('src/renderer/src/styles/variables.css')
    const types = source('src/renderer/src/types.ts')

    expect(tokens).toContain('--accent: #4fae98')
    expect(tokens).toContain('--brand-peach:')
    expect(tokens).toContain('--brand-sky:')
    expect(tokens).toContain('--brand-sun:')
    expect(types).toMatch(/theme:\s*'light'/)
    expect(types).toContain("accent: '#4fae98'")
  })

  it('keeps selected navigation restrained instead of a saturated block', () => {
    const styles = source('src/renderer/src/styles/main.css')
    const activeRule = styles.match(/\.nav-item\.active\s*\{(?<body>[^}]*)\}/s)?.groups?.body ?? ''

    expect(activeRule).toContain('var(--nav-active-bg)')
    expect(activeRule).not.toContain('background: var(--accent)')
    expect(styles).toContain('.nav-item.active::before')
  })

  it('renders publication-style default covers instead of giant glyph tiles', () => {
    const cover = source('src/renderer/src/components/BookCover.vue')

    expect(cover).toContain('class="bk-frame"')
    expect(cover).toContain('class="bk-series"')
    expect(cover).toContain('class="bk-title"')
    expect(cover).not.toContain('class="bk-glyph"')
  })
})
