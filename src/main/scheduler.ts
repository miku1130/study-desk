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

interface ScheduleItem {
  id: string
  date: string
  start: string
  end: string
  title: string
  location?: string
  allDay?: boolean
}

/**
 * 正常轮询间隔是 10 秒。主进程偶发被系统任务短暂阻塞时，补偿刚跨过的整分钟，
 * 既避免漏铃，也不会在电脑恢复很久后补播过期提醒。
 */
const BELL_CATCH_UP_WINDOW_MS = 90_000

/**
 * 上下课铃声 + 日程提醒调度器：每 10 秒比对当前 HH:mm，
 * 命中课程或日程起止时间则触发铃声 / 通知，每个时刻当天仅触发一次。
 */
export class BellScheduler {
  private timer: NodeJS.Timeout | null = null
  private fired = new Set<string>()
  private lastDay = ''
  private lastCheckAt: number | null = null

  constructor(
    private readonly settings: JsonStore<Record<string, unknown>>,
    private readonly timetable: JsonStore<Record<string, unknown>>,
    private readonly schedules: JsonStore<Record<string, unknown>>,
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
    this.lastCheckAt = null
  }

  /** 退出时停掉轮询；与其它常驻模块保持同名接口 */
  stop(): void {
    this.clear()
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
      // 铃声属于具体课程，不是单纯的作息提示。当天没有这节课时不触发上下课铃，
      // 因而周日或其它无课日都不会按空作息表误响。
      const lesson = lessons.find((l) => l.day === weekday && l.periodId === p.id)
      if (!lesson) continue
      if (this.shouldFireAt(p.start, hm, now)) {
        const key = `${dayKey}:${p.id}:start`
        if (!this.fired.has(key)) {
          this.fired.add(key)
          if (bell?.enabled) this.broadcast('bell:ring', 'on')
          if (lesson) {
            this.broadcast('class:start', lesson)
            this.notify('上课提醒', `${lesson.name}${lesson.location ? ' · ' + lesson.location : ''}`)
          }
        }
      }
      if (this.shouldFireAt(p.end, hm, now)) {
        const key = `${dayKey}:${p.id}:end`
        if (!this.fired.has(key)) {
          this.fired.add(key)
          if (bell?.enabled) this.broadcast('bell:ring', 'off')
        }
      }
    }

    const schedules = (this.schedules.get('items') as ScheduleItem[]) || []
    for (const item of schedules) {
      if (
        item.allDay ||
        item.date !== dayKey ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        !/^\d{2}:\d{2}$/.test(item.start) ||
        !/^\d{2}:\d{2}$/.test(item.end)
      ) continue
      if (this.shouldFireAt(item.start, hm, now)) this.fireSchedule(item, 'start', dayKey)
      if (this.shouldFireAt(item.end, hm, now)) this.fireSchedule(item, 'end', dayKey)
    }

    this.lastCheckAt = now.getTime()
  }

  private shouldFireAt(time: string, currentTime: string, now: Date): boolean {
    if (time === currentTime) return true
    if (!/^\d{2}:\d{2}$/.test(time) || this.lastCheckAt === null) return false

    const nowAt = now.getTime()
    if (nowAt <= this.lastCheckAt || nowAt - this.lastCheckAt > BELL_CATCH_UP_WINDOW_MS) return false

    const [hour, minute] = time.split(':').map(Number)
    const target = new Date(now)
    target.setHours(hour, minute, 0, 0)
    const targetAt = target.getTime()
    return targetAt > this.lastCheckAt && targetAt <= nowAt
  }

  private fireSchedule(item: ScheduleItem, kind: 'start' | 'end', dayKey: string): void {
    const key = `${dayKey}:schedule:${item.id}:${kind}`
    if (this.fired.has(key)) return
    this.fired.add(key)
    if ((this.settings.get('bell') as { enabled?: boolean } | undefined)?.enabled) {
      this.broadcast('bell:ring', kind === 'start' ? 'on' : 'off')
    }
    const label = item.location ? `${item.title} · ${item.location}` : item.title
    this.notify(kind === 'start' ? '日程开始提醒' : '日程结束提醒', label)
  }

  private clear(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
