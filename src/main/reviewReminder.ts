import type { JsonStore } from './store'
import { localDateKey } from './time'

const CHECK_INTERVAL = 30_000
const DEFAULT_REMINDER_TIME = '09:00'
const MAX_NOTIFIED_KEYS = 500

interface ReviewItemLike {
  id?: unknown
  title?: unknown
  round?: unknown
  totalRounds?: unknown
  nextReviewDate?: unknown
  archived?: unknown
}

interface ReminderConfigLike {
  enabled?: unknown
  time?: unknown
}

/**
 * 记忆曲线到期提醒：每天到提醒时间后检查一次到期知识，
 * 同一知识在同一计划日期只通知一次，避免重启或轮询重复打扰。
 */
export class ReviewReminder {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly reviews: JsonStore<Record<string, unknown>>,
    private readonly state: JsonStore<Record<string, unknown>>,
    private readonly notify: (title: string, body: string) => void,
    private readonly send: (channel: string, ...args: unknown[]) => void
  ) {}

  start(): void {
    this.stop()
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL)
    this.check()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  check(now: Date = new Date()): void {
    const reminder = (this.reviews.get('reminder') ?? {}) as ReminderConfigLike
    if (reminder.enabled === false) return

    const configuredTime =
      typeof reminder.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)
        ? reminder.time
        : DEFAULT_REMINDER_TIME
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`
    if (currentTime < configuredTime) return

    const items = this.reviews.get('items')
    if (!Array.isArray(items)) return
    const today = localDateKey(now)
    const due = items.filter((value): value is ReviewItemLike => {
      if (!value || typeof value !== 'object') return false
      const item = value as ReviewItemLike
      return (
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        item.archived !== true &&
        typeof item.nextReviewDate === 'string' &&
        item.nextReviewDate !== '' &&
        item.nextReviewDate <= today
      )
    })
    if (!due.length) return

    const rawNotified = this.state.get('notified')
    const notified = new Set(
      Array.isArray(rawNotified)
        ? rawNotified.filter((key): key is string => typeof key === 'string')
        : []
    )
    const fresh = due.filter((item) => {
      const key = `${String(item.id)}:${String(item.nextReviewDate)}:${String(item.round ?? 0)}`
      return !notified.has(key)
    })
    if (!fresh.length) return

    const keys = fresh.map(
      (item) =>
        `${String(item.id)}:${String(item.nextReviewDate)}:${String(item.round ?? 0)}`
    )
    this.state.set('notified', [...notified, ...keys].slice(-MAX_NOTIFIED_KEYS))

    if (fresh.length === 1) {
      const item = fresh[0]
      const totalRounds = Math.max(1, Number(item.totalRounds) || 6)
      const round = Math.min(totalRounds, Math.max(0, Number(item.round) || 0)) + 1
      this.notify(
        '记忆曲线 · 该复习了',
        `${String(item.title).slice(0, 60)} · 第 ${round}/${totalRounds} 轮`
      )
    } else {
      this.notify(
        `记忆曲线 · ${fresh.length} 条知识待复习`,
        `${String(fresh[0].title).slice(0, 40)} 等 ${fresh.length} 条知识今天到期`
      )
    }
    this.send('reviews:due', fresh.length)
  }
}
