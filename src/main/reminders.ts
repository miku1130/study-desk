import type { JsonStore } from './store'

const CHECK_INTERVAL = 20 * 1000
/** 超过该时长的过期提醒静默置位，避免升级/久未启动后集中轰炸 */
const STALE_MS = 12 * 60 * 60 * 1000

interface TodoLike {
  id?: unknown
  text?: unknown
  done?: unknown
  reminded?: unknown
  reminderAt?: unknown
  [key: string]: unknown
}

/**
 * 备忘录到点提醒：轮询 todos 存储，对到期未提醒且未完成的条目
 * 弹系统通知并置位 reminded，再广播渲染层刷新。
 */
export class TodoReminder {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly todos: JsonStore<Record<string, unknown>>,
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

  check(): void {
    const items = (this.todos.get('items') as TodoLike[] | undefined) ?? []
    if (!Array.isArray(items) || !items.length) return
    const now = Date.now()
    let changed = false
    for (const it of items) {
      if (!it || it.done || it.reminded) continue
      const raw = typeof it.reminderAt === 'string' ? it.reminderAt : ''
      if (!raw) continue
      const at = new Date(raw).getTime()
      if (!Number.isFinite(at) || at > now) continue
      it.reminded = true
      changed = true
      if (now - at <= STALE_MS) {
        this.notify('备忘录提醒', String(it.text ?? '').slice(0, 60) || '有一条待办到点了')
      }
    }
    if (changed) {
      this.todos.set('items', items)
      this.send('todos:changed')
    }
  }
}
