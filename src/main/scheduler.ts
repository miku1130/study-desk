import type { JsonStore } from './store'
import { localDateKey } from './time'

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

/**
 * 上下课铃声 + 上课提醒调度器：每 10 秒比对当前 HH:mm 与作息节次，
 * 命中节次起止时间则触发铃声 / 通知，每个时刻当天仅触发一次。
 */
export class BellScheduler {
  private timer: NodeJS.Timeout | null = null
  private fired = new Set<string>()
  private lastDay = ''

  constructor(
    private readonly settings: JsonStore<Record<string, unknown>>,
    private readonly timetable: JsonStore<Record<string, unknown>>,
    private readonly broadcast: (channel: string, ...args: unknown[]) => void,
    private readonly notify: (title: string, body: string) => void
  ) {}

  start(): void {
    this.clear()
    this.timer = setInterval(() => this.check(), 10000)
    this.check()
  }

  reload(): void {
    this.fired.clear()
  }

  private check(): void {
    const now = new Date()
    const dayKey = localDateKey(now)
    if (dayKey !== this.lastDay) {
      this.fired.clear()
      this.lastDay = dayKey
    }
    const pad = (n: number): string => String(n).padStart(2, '0')
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const periods = (this.timetable.get('periods') as Period[]) || []
    const lessons = (this.timetable.get('lessons') as Lesson[]) || []
    const bell = this.settings.get('bell') as { enabled: boolean } | undefined
    const weekday = now.getDay() === 0 ? 7 : now.getDay()

    for (const p of periods) {
      if (p.start === hm) {
        const key = `${dayKey}:${p.id}:start`
        if (!this.fired.has(key)) {
          this.fired.add(key)
          if (bell?.enabled) this.broadcast('bell:ring', 'on')
          const lesson = lessons.find((l) => l.day === weekday && l.periodId === p.id)
          if (lesson) {
            this.broadcast('class:start', lesson)
            this.notify('上课提醒', `${lesson.name}${lesson.location ? ' · ' + lesson.location : ''}`)
          }
        }
      }
      if (p.end === hm) {
        const key = `${dayKey}:${p.id}:end`
        if (!this.fired.has(key)) {
          this.fired.add(key)
          if (bell?.enabled) this.broadcast('bell:ring', 'off')
        }
      }
    }
  }

  private clear(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
