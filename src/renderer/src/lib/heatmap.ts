/**
 * 专注热力图的网格计算。
 *
 * 一整年的坚持用柱状图看不出来——柱子太多太挤。热力图的价值在于一眼看见
 * 「哪几周断了」，所以空白格也必须画出来，不能只画有数据的日子。
 */
import type { DayStat } from '@/types'

export interface HeatCell {
  key: string
  minutes: number
  pomodoros: number
  level: number
  label: string
}

export interface HeatWeek {
  /** 周日到周六共 7 格；今天之后的位置是 null */
  days: Array<HeatCell | null>
  /** 该列若是某个月第一次出现，标上月份 */
  month: string
}

export interface Heatmap {
  weeks: HeatWeek[]
  activeDays: number
  totalMinutes: number
}

/** 分钟数到色阶。阈值按「一个番茄 25 分钟」的直觉来分 */
export function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes < 30) return 1
  if (minutes < 75) return 2
  if (minutes < 150) return 3
  return 4
}

function keyOf(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function buildHeatmap(
  daily: Record<string, DayStat>,
  options: { weeks: number; today?: Date }
): Heatmap {
  const today = options.today ? new Date(options.today) : new Date()
  today.setHours(0, 0, 0, 0)
  const weekCount = Math.max(1, Math.floor(options.weeks))

  // 从今天所在这一周的周日往前推，保证最后一列的最后一个有效格就是今天
  const start = new Date(today)
  start.setDate(start.getDate() - today.getDay() - (weekCount - 1) * 7)

  const weeks: HeatWeek[] = []
  let activeDays = 0
  let totalMinutes = 0
  let lastMonth = -1

  for (let w = 0; w < weekCount; w++) {
    const days: Array<HeatCell | null> = []
    let month = ''
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      if (date > today) {
        days.push(null)
        continue
      }
      const key = keyOf(date)
      const stat = daily[key]
      const minutes = Math.max(0, Math.round(stat?.focusMinutes ?? 0))
      if (minutes > 0) {
        activeDays += 1
        totalMinutes += minutes
      }
      if (month === '' && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        month = `${date.getMonth() + 1} 月`
      }
      days.push({
        key,
        minutes,
        pomodoros: Math.max(0, Math.round(stat?.pomodoros ?? 0)),
        level: heatLevel(minutes),
        label: `${date.getMonth() + 1}/${date.getDate()}`
      })
    }
    weeks.push({ days, month })
  }

  return { weeks, activeDays, totalMinutes }
}
