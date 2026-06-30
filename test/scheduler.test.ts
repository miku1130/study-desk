import { describe, it, expect, afterEach, vi } from 'vitest'
import { BellScheduler } from '../src/main/scheduler'

interface Period {
  id: string
  name: string
  start: string
  end: string
}
interface Lesson {
  id: string
  day: number
  periodId: string
  name: string
  teacher: string
  location: string
  color: string
}

function makeStores(periods: Period[], lessons: Lesson[], bellEnabled = true) {
  const settings = { get: (k: string) => (k === 'bell' ? { enabled: bellEnabled } : undefined) }
  const timetable = {
    get: (k: string) => (k === 'periods' ? periods : k === 'lessons' ? lessons : undefined)
  }
  return { settings, timetable }
}

const period: Period = { id: 'p1', name: '第 1 节', start: '08:00', end: '08:45' }
// 2026-01-05 是星期一
const MONDAY_0800 = new Date(2026, 0, 5, 8, 0, 0)

describe('BellScheduler', () => {
  afterEach(() => vi.useRealTimers())

  it('rings the on-bell once at a period start', () => {
    vi.useFakeTimers()
    vi.setSystemTime(MONDAY_0800)
    const calls: unknown[][] = []
    const { settings, timetable } = makeStores([period], [], true)
    const s = new BellScheduler(settings as never, timetable as never, (c, ...a) => calls.push([c, ...a]), () => {})
    s.start()
    expect(calls.filter(([c, k]) => c === 'bell:ring' && k === 'on').length).toBe(1)
    vi.advanceTimersByTime(10000)
    expect(calls.filter(([c, k]) => c === 'bell:ring' && k === 'on').length).toBe(1)
  })

  it('does not ring when the bell is disabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(MONDAY_0800)
    const calls: unknown[][] = []
    const { settings, timetable } = makeStores([period], [], false)
    const s = new BellScheduler(settings as never, timetable as never, (c, ...a) => calls.push([c, ...a]), () => {})
    s.start()
    expect(calls.filter(([c]) => c === 'bell:ring').length).toBe(0)
  })

  it('notifies the class start for a lesson on the matching weekday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(MONDAY_0800)
    const calls: unknown[][] = []
    const notes: unknown[][] = []
    const lesson: Lesson = {
      id: 'a',
      day: 1,
      periodId: 'p1',
      name: '高等数学',
      teacher: '王',
      location: 'A101',
      color: '#0a84ff'
    }
    const { settings, timetable } = makeStores([period], [lesson], true)
    const s = new BellScheduler(
      settings as never,
      timetable as never,
      (c, ...a) => calls.push([c, ...a]),
      (t, b) => notes.push([t, b])
    )
    s.start()
    expect(calls.some(([c]) => c === 'class:start')).toBe(true)
    expect(notes.length).toBe(1)
  })
})
