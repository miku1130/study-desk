import type { JsonStore } from './store'
import { localDateKey } from './time'

export type PomodoroPhase = 'idle' | 'work' | 'short' | 'long'

export interface PomodoroState {
  phase: PomodoroPhase
  remaining: number
  total: number
  running: boolean
  completed: number
}

interface PomodoroHooks {
  onUpdate?: (state: PomodoroState) => void
  onEvent?: (type: 'workComplete' | 'breakComplete') => void
}

interface PomodoroCfg {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
  autoStart: boolean
}

/**
 * 番茄钟引擎（主进程权威计时），通过 broadcast 把状态推给所有窗口，
 * 使主窗口与锁屏窗口共享同一份倒计时。
 */
export class PomodoroEngine {
  private state: PomodoroState = {
    phase: 'idle',
    remaining: 0,
    total: 0,
    running: false,
    completed: 0
  }
  private timer: NodeJS.Timeout | null = null

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

  start(): void {
    if (this.state.phase === 'idle') this.enter('work')
    this.state.running = true
    this.runLoop()
    this.emit()
  }

  pause(): void {
    this.state.running = false
    this.clear()
    this.emit()
  }

  toggle(): void {
    if (this.state.running) this.pause()
    else this.start()
  }

  reset(): void {
    this.clear()
    this.state = {
      phase: 'idle',
      remaining: 0,
      total: 0,
      running: false,
      completed: this.state.completed
    }
    this.emit()
  }

  skip(): void {
    this.complete(true)
  }

  private enter(phase: PomodoroPhase): void {
    const c = this.cfg()
    let mins = 0
    if (phase === 'work') mins = c.workMin
    else if (phase === 'short') mins = c.shortBreakMin
    else if (phase === 'long') mins = c.longBreakMin
    this.state.phase = phase
    this.state.total = mins * 60
    this.state.remaining = mins * 60
  }

  private runLoop(): void {
    this.clear()
    this.timer = setInterval(() => {
      if (!this.state.running) return
      this.state.remaining -= 1
      if (this.state.remaining <= 0) this.complete(false)
      else this.emit()
    }, 1000)
  }

  private complete(skipped: boolean): void {
    const finished = this.state.phase
    if (finished === 'work') {
      this.state.completed += 1
      this.recordStat()
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
      this.runLoop()
    } else {
      this.state.running = false
      this.clear()
    }

    if (!skipped && finished !== 'idle') {
      this.hooks.onEvent?.(finished === 'work' ? 'workComplete' : 'breakComplete')
      this.broadcast('pomodoro:event', finished === 'work' ? 'workComplete' : 'breakComplete')
    }
    this.emit()
  }

  private recordStat(): void {
    const key = localDateKey()
    const days = (this.stats.get('days') as Record<string, { pomodoros: number; focusMinutes: number }>) || {}
    const day = days[key] || { pomodoros: 0, focusMinutes: 0 }
    day.pomodoros += 1
    day.focusMinutes += this.cfg().workMin
    days[key] = day
    this.stats.set('days', days)
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
