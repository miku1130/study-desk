import type { JsonStore } from './store'

/** 喝水提醒：按设置的间隔分钟，到点弹系统通知并广播给渲染层。 */
export class WaterReminder {
  private timer: NodeJS.Timeout | null = null
  private lastRemind = Date.now()

  constructor(
    private readonly settings: JsonStore<Record<string, unknown>>,
    private readonly notify: (title: string, body: string) => void,
    private readonly broadcast: (channel: string, ...args: unknown[]) => void
  ) {}

  start(): void {
    this.clear()
    this.lastRemind = Date.now()
    this.timer = setInterval(() => this.check(), 60000)
  }

  reload(): void {
    this.lastRemind = Date.now()
  }

  private check(): void {
    const w = this.settings.get('water') as { enabled: boolean; intervalMin: number } | undefined
    if (!w?.enabled) return
    const interval = (w.intervalMin || 60) * 60000
    if (Date.now() - this.lastRemind >= interval) {
      this.lastRemind = Date.now()
      this.notify('喝水提醒', '起来喝口水，补充水分 💧')
      this.broadcast('water:remind')
    }
  }

  private clear(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
