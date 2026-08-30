import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PomodoroEngine, type FocusSession } from '../src/main/pomodoro'

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
  // 按 key 分开存：引擎现在同时写 days 与 sessions，混在一起会互相污染
  const data: Record<string, unknown> = {}
  const stats = {
    get: (k: string) => data[k],
    set: (k: string, v: unknown) => {
      data[k] = v
    }
  }
  const daysData = (): Record<string, { pomodoros: number; focusMinutes: number }> =>
    (data.days as Record<string, { pomodoros: number; focusMinutes: number }>) ?? {}
  const sessions = (): FocusSession[] => (data.sessions as FocusSession[]) ?? []
  return { settings, stats, daysData, sessions }
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
    expect(Object.values(daysData())[0].pomodoros).toBe(1)
    expect(Object.values(daysData())[0].focusMinutes).toBe(1)
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

  it('emits a completion event when a break ends and work resumes', () => {
    const { settings, stats } = makeStores({
      workMin: 1,
      shortBreakMin: 1,
      autoStart: true
    })
    const events: unknown[][] = []
    const engine = new PomodoroEngine(settings as never, stats as never, (channel, ...args) =>
      events.push([channel, ...args])
    )

    engine.start()
    vi.advanceTimersByTime(60 * 1000)
    vi.advanceTimersByTime(60 * 1000)

    expect(events).toContainEqual(['pomodoro:event', 'breakComplete'])
    expect(engine.getState().phase).toBe('work')
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

  it('skipping started work records an abandoned event without awarding a completion', () => {
    const { settings, stats, daysData } = makeStores()
    const events: unknown[][] = []
    const engine = new PomodoroEngine(settings as never, stats as never, (c, ...a) =>
      events.push([c, ...a])
    )
    engine.start()
    vi.advanceTimersByTime(2000)
    engine.skip()

    expect(engine.getState().completed).toBe(0)
    expect(Object.values(daysData())).toHaveLength(0)
    expect(events.some(([c, t]) => c === 'pomodoro:event' && t === 'workAbandoned')).toBe(true)
  })

  it('resetting progressed work records one abandoned event', () => {
    const { settings, stats } = makeStores()
    const events: unknown[][] = []
    const engine = new PomodoroEngine(settings as never, stats as never, (c, ...a) =>
      events.push([c, ...a])
    )
    engine.start()
    vi.advanceTimersByTime(2000)
    engine.pause()
    engine.reset()

    expect(events.filter(([c, t]) => c === 'pomodoro:event' && t === 'workAbandoned')).toHaveLength(1)
  })
})

describe('计时方式', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('正向计时不设终点，一直往上走', () => {
    const { settings, stats } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ mode: 'countup' })

    vi.advanceTimersByTime(90 * 1000)
    const s = engine.getState()
    expect(s.mode).toBe('countup')
    expect(s.total).toBe(0)
    expect(s.remaining).toBe(0)
    expect(s.elapsed).toBe(90)
    // 没有自然终点，不会自己结束
    expect(s.phase).toBe('work')
  })

  it('正向计时由用户结束，按实际时长记账', () => {
    const { settings, stats, sessions } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ mode: 'countup' })
    vi.advanceTimersByTime(7 * 60 * 1000)
    engine.finish()

    expect(sessions()).toHaveLength(1)
    expect(sessions()[0].minutes).toBe(7)
    expect(sessions()[0].mode).toBe('countup')
    expect(sessions()[0].completed).toBe(true)
  })

  it('不计时同样按真实时长记账', () => {
    const { settings, stats, sessions } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ mode: 'untimed' })
    vi.advanceTimersByTime(12 * 60 * 1000)
    engine.finish()
    expect(sessions()[0].minutes).toBe(12)
    expect(sessions()[0].mode).toBe('untimed')
  })

  it('自定义时长覆盖配置里的默认值', () => {
    const { settings, stats } = makeStores({ workMin: 25 })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ minutes: 35 })
    expect(engine.getState().total).toBe(35 * 60)
  })

  it('休息段始终是倒计时，不受专注模式影响', () => {
    const { settings, stats } = makeStores({ workMin: 1, shortBreakMin: 5 })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ mode: 'countup' })
    vi.advanceTimersByTime(60 * 1000)
    engine.finish()
    const s = engine.getState()
    expect(s.phase).toBe('short')
    expect(s.total).toBe(5 * 60)
  })
})

describe('专注明细', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('按实际时长记账，而不是配置里的时长', () => {
    const { settings, stats, sessions, daysData } = makeStores({ workMin: 25 })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    // 只学了 10 分钟就主动结束，不该算成一整个 25 分钟
    vi.advanceTimersByTime(10 * 60 * 1000)
    engine.skip()

    expect(sessions()).toHaveLength(1)
    expect(sessions()[0].minutes).toBe(10)
    expect(sessions()[0].completed).toBe(false)
    expect(Object.values(daysData())[0].focusMinutes).toBe(10)
    // 时长照记，但没走完就不算一个完整番茄
    expect(Object.values(daysData())[0].pomodoros).toBe(0)
  })

  it('关联目标会写进明细，删了待办也还看得懂', () => {
    const { settings, stats, sessions } = makeStores({ workMin: 1 })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ targetId: 't1', targetName: '注会综合基础班' })
    vi.advanceTimersByTime(60 * 1000)

    expect(sessions()[0].targetId).toBe('t1')
    expect(sessions()[0].targetName).toBe('注会综合基础班')
  })

  it('太短的专注不记账，避免误触产生垃圾记录', () => {
    const { settings, stats, sessions } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()
    vi.advanceTimersByTime(20 * 1000)
    engine.skip()
    expect(sessions()).toHaveLength(0)
  })

  it('暂停期间不计入时长', () => {
    const { settings, stats, sessions } = makeStores()
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start({ mode: 'countup' })
    vi.advanceTimersByTime(5 * 60 * 1000)
    engine.pause()
    vi.advanceTimersByTime(30 * 60 * 1000) // 暂停了半小时
    engine.start()
    vi.advanceTimersByTime(2 * 60 * 1000)
    engine.finish()

    expect(sessions()[0].minutes).toBe(7)
  })

  it('系统休眠导致 tick 停摆时，按真实时间结算而不是少算', () => {
    const { settings, stats } = makeStores({ workMin: 30 })
    const engine = new PomodoroEngine(settings as never, stats as never, () => {})
    engine.start()

    // 模拟合盖：定时器没有触发，但真实时间过去了 10 分钟
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    vi.advanceTimersByTime(1000)

    // 累减实现会认为只过了 1 秒，时间戳实现能看出真实流逝
    expect(engine.getState().remaining).toBeLessThanOrEqual(20 * 60)
  })
})
