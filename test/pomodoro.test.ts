import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PomodoroEngine } from '../src/main/pomodoro'

interface PomoCfg {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
  autoStart: boolean
}

function makeStores(cfg: Partial<PomoCfg> = {}) {
  const pomodoro: PomoCfg = {
    workMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    autoStart: false,
    ...cfg
  }
  const settings = { get: (k: string) => (k === 'pomodoro' ? pomodoro : undefined) }
  const daysData: Record<string, { pomodoros: number; focusMinutes: number }> = {}
  const stats = {
    get: (k: string) => (k === 'days' ? daysData : undefined),
    set: (_k: string, v: unknown) => {
      Object.assign(daysData, v)
    }
  }
  return { settings, stats, daysData }
}

describe('PomodoroEngine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts a work session with the configured duration', () => {
    const { settings, stats } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    const s = engine.getState()
    expect(s.phase).toBe('work')
    expect(s.running).toBe(true)
    expect(s.total).toBe(25 * 60)
    expect(s.remaining).toBe(25 * 60)
  })

  it('counts down one second per tick', () => {
    const { settings, stats } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    vi.advanceTimersByTime(3000)
    expect(engine.getState().remaining).toBe(25 * 60 - 3)
  })

  it('completes work, records a stat, and enters short break', () => {
    const { settings, stats, daysData } = makeStores({ workMin: 1 })
    const events: unknown[][] = []
    const engine = new PomodoroEngine(settings as never, stats as never, (c, ...a) =>
      events.push([c, ...a])
    )
    engine.start()
    vi.advanceTimersByTime(60 * 1000)
    const s = engine.getState()
    expect(s.completed).toBe(1)
    expect(s.phase).toBe('short')
    expect(Object.values(daysData)[0].pomodoros).toBe(1)
    expect(Object.values(daysData)[0].focusMinutes).toBe(1)
    expect(events.some(([c, t]) => c === 'pomodoro:event' && t === 'workComplete')).toBe(true)
  })

  it('enters a long break after the configured number of works', () => {
    const { settings, stats } = makeStores({
      workMin: 1,
      shortBreakMin: 1,
      longBreakEvery: 2,
      autoStart: true
    })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    vi.advanceTimersByTime(60 * 1000) // work#1 -> short
    expect(engine.getState().phase).toBe('short')
    vi.advanceTimersByTime(60 * 1000) // short -> work#2
    expect(engine.getState().phase).toBe('work')
    vi.advanceTimersByTime(60 * 1000) // work#2 -> long
    expect(engine.getState().completed).toBe(2)
    expect(engine.getState().phase).toBe('long')
  })

  it('pause freezes the countdown and reset returns to idle', () => {
    const { settings, stats } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    vi.advanceTimersByTime(2000)
    engine.pause()
    const frozen = engine.getState().remaining
    vi.advanceTimersByTime(5000)
    expect(engine.getState().remaining).toBe(frozen)
    engine.reset()
    expect(engine.getState().phase).toBe('idle')
    expect(engine.getState().running).toBe(false)
  })
})
