import { describe, it, expect } from 'vitest'
import { localDateKey } from '../src/main/time'

describe('localDateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 5, 30))).toBe('2026-06-30')
  })

  it('zero-pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
