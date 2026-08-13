import { describe, expect, it } from 'vitest'
import { appendSession, dayTotals, type FocusSession } from '../src/main/focusStats'

function makeStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial }
  return {
    data,
    get: (key: string) => data[key],
    set: (key: string, value: unknown) => {
      data[key] = value
    }
  }
}

function session(partial: Partial<FocusSession> & { startAt: number; minutes: number }): FocusSession {
  return {
    id: `s${partial.startAt}`,
    endAt: partial.startAt + partial.minutes * 60_000,
    mode: 'countdown',
    targetId: '',
    targetName: '',
    completed: true,
    ...partial
  }
}

const DAY = new Date(2026, 7, 13, 9, 0, 0).getTime()

describe('专注明细写入', () => {
  it('明细与当日聚合一起更新，两边说的是同一件事', () => {
    const store = makeStore()
    appendSession(store, session({ startAt: DAY, minutes: 25 }))

    expect((store.data.sessions as FocusSession[])).toHaveLength(1)
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 1, focusMinutes: 25 })
  })

  it('中断的那段计时长但不计番茄', () => {
    const store = makeStore()
    appendSession(store, session({ startAt: DAY, minutes: 12, completed: false }))
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 0, focusMinutes: 12 })
  })

  it('同一天多段累加，不同天各算各的', () => {
    const store = makeStore()
    appendSession(store, session({ startAt: DAY, minutes: 25 }))
    appendSession(store, session({ startAt: DAY + 3600_000, minutes: 30 }))
    const otherDay = DAY - 24 * 3600_000
    appendSession(store, session({ startAt: otherDay, minutes: 40 }))

    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 2, focusMinutes: 55 })
    expect(dayTotals(store, otherDay)).toEqual({ pomodoros: 1, focusMinutes: 40 })
  })

  it('明细超过上限时丢最早的，但当日聚合不受影响', () => {
    const store = makeStore()
    for (let i = 0; i < 3; i++) appendSession(store, session({ startAt: DAY + i * 1000, minutes: 10 }), 2)
    expect((store.data.sessions as FocusSession[])).toHaveLength(2)
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 3, focusMinutes: 30 })
  })

  it('只有旧版聚合、没有明细的历史数据照样读得出来', () => {
    const store = makeStore({ days: { '2026-08-13': { pomodoros: 4, focusMinutes: 100 } } })
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 4, focusMinutes: 100 })
  })

  it('升级当天两份数据各记一半时取大的，不会比实际少', () => {
    const store = makeStore({ days: { '2026-08-13': { pomodoros: 4, focusMinutes: 100 } } })
    appendSession(store, session({ startAt: DAY, minutes: 25 }))
    // 聚合里已经含这 25 分钟，取大的才不会重复累加
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 5, focusMinutes: 125 })
  })

  it('没有任何记录时返回零而不是 undefined', () => {
    expect(dayTotals(makeStore(), DAY)).toEqual({ pomodoros: 0, focusMinutes: 0 })
  })

  it('明细数据损坏时不炸，按空处理', () => {
    const store = makeStore({ sessions: 'not-an-array' })
    expect(dayTotals(store, DAY)).toEqual({ pomodoros: 0, focusMinutes: 0 })
    appendSession(store, session({ startAt: DAY, minutes: 25 }))
    expect((store.data.sessions as FocusSession[])).toHaveLength(1)
  })
})
