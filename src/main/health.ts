import type { JsonStore } from './store'

/** 健康提醒：久坐 + 护眼(20-20-20)，按各自间隔到点弹系统通知。 */
export class HealthReminder {
  private timer: NodeJS.Timeout | null = null
  private lastSit = Date.now()
  private lastEye = Date.now()

  constructor(
    private readonly settings: JsonStore<Record<string, unknown>>,
    private readonly notify: (title: string, body: string) => void
  ) {}

  start(): void {
    this.clear()
    this.reload()
    this.timer = setInterval(() => this.check(), 60000)
  }

  reload(): void {
    const now = Date.now()
    this.lastSit = now
    this.lastEye = now
  }

  private check(): void {
    const h = this.settings.get('health') as
      | { sitEnabled: boolean; sitIntervalMin: number; eyeEnabled: boolean; eyeIntervalMin: number }
      | undefined
    if (!h) return
    const now = Date.now()
    if (h.sitEnabled && now - this.lastSit >= (h.sitIntervalMin || 45) * 60000) {
      this.lastSit = now
      this.notify('久坐提醒', '起来活动一下，伸展身体 🧍')
    }
    if (h.eyeEnabled && now - this.lastEye >= (h.eyeIntervalMin || 30) * 60000) {
      this.lastEye = now
      this.notify('护眼提醒', '远眺 20 秒，放松眼睛 👀（20-20-20）')
    }
  }

  private clear(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
