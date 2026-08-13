import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { activeAccentOf, resolveThemeMode } from '../src/renderer/src/lib/appearance'
import { getGlassSurfaceAlphas } from '../src/renderer/src/lib/appearance'

describe('background glass appearance', () => {
  it('keeps the standard surfaces at zero transparency', () => {
    expect(getGlassSurfaceAlphas(0)).toEqual({
      sidebar: 0.96,
      content: 0.94,
      card: 0.92,
      raised: 1,
      muted: 1,
      sidebarBlur: 28,
      sidebarSaturation: 125,
      toolbarBlur: 18,
      sidebarShadow: 0.045
    })
  })

  it('makes the sidebar and content floor fully transparent at 100%', () => {
    expect(getGlassSurfaceAlphas(1)).toEqual({
      sidebar: 0,
      content: 0,
      card: 0.16,
      raised: 0.24,
      muted: 0.2,
      sidebarBlur: 0,
      sidebarSaturation: 100,
      toolbarBlur: 0,
      sidebarShadow: 0
    })
  })

  it('clamps persisted values to the supported range', () => {
    expect(getGlassSurfaceAlphas(-1)).toEqual(getGlassSurfaceAlphas(0))
    expect(getGlassSurfaceAlphas(2)).toEqual(getGlassSurfaceAlphas(1))
  })

  it('resolves the system theme from the OS preference', () => {
    expect(resolveThemeMode('system', true)).toBe('dark')
    expect(resolveThemeMode('system', false)).toBe('light')
    expect(resolveThemeMode('dark', false)).toBe('dark')
    expect(resolveThemeMode('light', true)).toBe('light')
  })

  it('picks the accent that belongs to the current theme', () => {
    const colors = { accent: '#4fae98', accentDark: '#7fd3bb' }
    expect(activeAccentOf(colors, 'light')).toBe('#4fae98')
    expect(activeAccentOf(colors, 'dark')).toBe('#7fd3bb')
  })

  it('老配置只有一个 accent 时，深色沿用它而不是跳回默认色', () => {
    expect(activeAccentOf({ accent: '#a88ad8', accentDark: '' }, 'dark')).toBe('#a88ad8')
  })

  it('rebinds theme surface tokens inside the app shell', () => {
    const styles = readFileSync(join(__dirname, '../src/renderer/src/styles/main.css'), 'utf8')
    const shellRule = styles.match(/\.app-shell\s*\{(?<body>[^}]*)\}/s)?.groups?.body ?? ''

    expect(shellRule).toContain('--surface-sidebar: rgb(255 252 247 / var(--glass-sidebar-alpha')
    expect(shellRule).toContain('--surface-content: rgb(249 251 247 / var(--glass-content-alpha')
    expect(shellRule).toContain('--bg-card: var(--surface-card)')
    expect(styles).toContain(':root[data-theme="dark"] .app-shell')
  })
})
