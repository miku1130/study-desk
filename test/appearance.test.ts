import { describe, expect, it } from 'vitest'
import { getGlassSurfaceAlphas } from '../src/renderer/src/lib/appearance'

describe('background glass appearance', () => {
  it('keeps the standard surfaces at zero transparency', () => {
    expect(getGlassSurfaceAlphas(0)).toEqual({
      sidebar: 0.96,
      content: 0.94,
      card: 0.92,
      raised: 1,
      muted: 1
    })
  })

  it('makes foreground surfaces strongly transparent at 100%', () => {
    expect(getGlassSurfaceAlphas(1)).toEqual({
      sidebar: 0.14,
      content: 0.06,
      card: 0.16,
      raised: 0.24,
      muted: 0.2
    })
  })

  it('clamps persisted values to the supported range', () => {
    expect(getGlassSurfaceAlphas(-1)).toEqual(getGlassSurfaceAlphas(0))
    expect(getGlassSurfaceAlphas(2)).toEqual(getGlassSurfaceAlphas(1))
  })
})
