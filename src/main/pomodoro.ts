import type { JsonStore } from './store'
import { appendSession, type FocusSession } from './focusStats'

export type PomodoroPhase = 'idle' | 'work' | 'short' | 'long'

/**
 * 计时方式：
 *  - countdown 倒计时，走完自动进入休息，是标准番茄钟
 *  - countup   正向计时，学到什么时候算什么时候，由用户手动结束
 *  - untimed   不计时，只记开始到结束，适合不想被数字盯着的场景
 */
export type PomodoroMode = 'countdown' | 'countup' | 'untimed'

export interface PomodoroState {
  phase: PomodoroPhase
  mode: PomodoroMode
  /** 倒计时剩余秒数；countup / untimed 恒为 0 */
  remaining: number
  /** 已经过去的秒数，三种模式都有效 */
  elapsed: number
  total: number
  running: boolean
  completed: number
  /** 本次专注关联的待办 id，空表示只是单纯计时 */
  targetId: string
  targetName: string
}

export type { FocusSession } from './focusStats'

/** 短于这个时长的不记账，避免误触产生一堆垃圾记录 */
const MIN_SESSION_SECONDS = 60

interface PomodoroHooks {
  onUpdate?: (state: PomodoroState) => void
  onEvent?: (type: 'workComplete' | 'breakComplete' | 'workAbandoned') => void
}

interface PomodoroCfg {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
  autoStart: boolean
  mode?: PomodoroMode
}

export interface StartOptions {
  mode?: PomodoroMode
  /** 自定义单次时长（分钟），仅 countdown 有意义 */
  minutes?: number
  targetId?: string
  targetName?: string
}

/**
 * 番茄钟引擎（主进程权威计时），通过 broadcast 把状态推给所有窗口，
 * 使主窗口与锁屏窗口共享同一份倒计时。
 *
 * 计时以时间戳为准而不是累减 tick：setInterval 在系统休眠时会停摆，
 * 合盖两小时再打开的话，累减出来的剩余时间会严重失真。
 */
export class PomodoroEngine {
  private state: PomodoroState = {
    phase: 'idle',
    mode: 'countdown',
    remaining: 0,
    elapsed: 0,
    total: 0,
    running: false,
    completed: 0,
    targetId: '',
    targetName: ''
  }
  private timer: NodeJS.Timeout | null = null
  /** 当前阶段的截止时刻（countdown）或起始时刻，均为时间戳 */
  private deadline = 0
  private phaseStartedAt = 0
  /** 本阶段已累计的秒数，暂停时结算进来，避免暂停期间继续走时 */
  private accumulated = 0

  constructor(
    private readonly settings: JsonStore<Record<string, unknown>>,
    private readonly stats: JsonStore<Record<string, unknown>>,
    private readonly broadcast: (channel: string, ...args: unknown[]) => void,
    private readonly hooks: PomodoroHooks = {}
  ) {}

  getState(): PomodoroState {
    return this.state
  }

  private cfg(): PomodoroCfg {
    return this.settings.get('pomodoro') as unknown as PomodoroCfg
  }

  start(options: StartOptions = {}): void {
    if (this.state.phase === 'idle') {
      if (options.mode) this.state.mode = options.mode
      else this.state.mode = this.cfg().mode ?? 'countdown'
      this.state.targetId = String(options.targetId ?? '')
      this.state.targetName = String(options.targetName ?? '')
      this.enter('work', options.minutes)
    }
    this.state.running = true
    this.resumeClock()
    this.runLoop()
    this.emit()
  }

  pause(): void {
    this.settleClock()
    this.state.running = false
    this.clear()
    this.emit()
  }

  toggle(): void {
    if (this.state.running) this.pause()
    else this.start()
  }

  /** 正向计时与不计时没有自然终点，由用户主动结束本段 */
  finish(): void {
    if (this.state.phase !== 'work') return this.complete(false)
    this.settleClock()
    this.complete(false)
  }

  /** 进程退出时停掉计时循环；不改变 state，避免退出瞬间还广播一次状态 */
  dispose(): void {
    this.clear()
  }

  reset(): void {
    if (this.workWasStarted()) {
      this.settleClock()
      this.recordSession(false)
      this.emitEvent('workAbandoned')
    }
    this.clear()
    this.state = {
      phase: 'idle',
      mode: this.state.mode,
      remaining: 0,
      elapsed: 0,
      total: 0,
      running: false,
      completed: this.state.completed,
      targetId: '',
      targetName: ''
    }
    this.accumulated = 0
    this.emit()
  }

  skip(): void {
    this.complete(true)
  }

  private enter(phase: PomodoroPhase, customMinutes?: number): void {
    const c = this.cfg()
    let mins = 0
    if (phase === 'work') mins = customMinutes && customMinutes > 0 ? customMinutes : c.workMin
    else if (phase === 'short') mins = c.shortBreakMin
    else if (phase === 'long') mins = c.longBreakMin

    // 休息阶段一律走倒计时；正向与不计时只作用于专注段
    const countdown = phase !== 'work' || this.state.mode === 'countdown'
    this.state.phase = phase
    this.state.total = countdown ? mins * 60 : 0
    this.state.remaining = countdown ? mins * 60 : 0
    this.state.elapsed = 0
    this.accumulated = 0
    this.phaseStartedAt = Date.now()
  }

  /** 恢复走时：把「已累计秒数」换算成新的基准时刻 */
  private resumeClock(): void {
    const now = Date.now()
    this.phaseStartedAt = now - this.accumulated * 1000
    this.deadline = this.state.total > 0 ? this.phaseStartedAt + this.state.total * 1000 : 0
  }

  /** 暂停或结束时把走过的时间落进 accumulated */
  private settleClock(): void {
    if (!this.state.running) return
    this.accumulated = Math.max(0, Math.floor((Date.now() - this.phaseStartedAt) / 1000))
    this.state.elapsed = this.accumulated
    if (this.state.total > 0) {
      this.state.remaining = Math.max(0, this.state.total - this.accumulated)
    }
  }

  private runLoop(): void {
    this.clear()
    this.timer = setInterval(() => {
      if (!this.state.running) return
      const now = Date.now()
      const elapsed = Math.max(0, Math.floor((now - this.phaseStartedAt) / 1000))
      this.state.elapsed = elapsed

      if (this.state.total > 0) {
        this.state.remaining = Math.max(0, this.state.total - elapsed)
        if (now >= this.deadline) {
          this.accumulated = this.state.total
          this.complete(false)
          return
        }
      }
      this.emit()
    }, 1000)
  }

  private complete(skipped: boolean): void {
    const finished = this.state.phase
    const abandonedWork = skipped && this.workWasStarted()
    if (finished === 'work') {
      this.settleClock()
      if (!skipped) {
        this.state.completed += 1
        this.recordSession(true)
      } else if (abandonedWork) {
        this.recordSession(false)
      }
    }

    let next: PomodoroPhase
    if (finished === 'work') {
      next = this.state.completed % this.cfg().longBreakEvery === 0 ? 'long' : 'short'
    } else {
      next = 'work'
    }
    this.enter(next)

    if (this.cfg().autoStart && !skipped) {
      this.state.running = true
      this.resumeClock()
      this.runLoop()
    } else {
      this.state.running = false
      this.clear()
    }

    if (abandonedWork) this.emitEvent('workAbandoned')
    else if (!skipped && finished !== 'idle') {
      this.emitEvent(finished === 'work' ? 'workComplete' : 'breakComplete')
    }
    this.emit()
  }

  private workWasStarted(): boolean {
    if (this.state.phase !== 'work') return false
    return this.state.running || this.state.elapsed > 0 || this.accumulated > 0
  }

  private emitEvent(type: 'workComplete' | 'breakComplete' | 'workAbandoned'): void {
    this.hooks.onEvent?.(type)
    this.broadcast('pomodoro:event', type)
  }

  /**
   * 记一条专注明细。分钟数取实际走过的时间，而不是配置里的 workMin——
   * 那样记的话，中途放弃和提前结束都会被算成完整一个番茄。
   */
  private recordSession(completed: boolean): void {
    const seconds = this.accumulated
    if (seconds < MIN_SESSION_SECONDS) return

    const endAt = Date.now()
    const session: FocusSession = {
      id: `${endAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      startAt: endAt - seconds * 1000,
      endAt,
      minutes: Math.round(seconds / 60),
      mode: this.state.mode,
      targetId: this.state.targetId,
      targetName: this.state.targetName,
      completed
    }

    appendSession(this.stats, session)
  }

  private emit(): void {
    this.broadcast('pomodoro:tick', this.state)
    this.hooks.onUpdate?.(this.state)
  }

  private clear(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
