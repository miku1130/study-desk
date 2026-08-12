import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DayStat, FocusSession, StatsData } from '@/types'
import { loadStore } from '@/lib/persist'

export function dayKeyOf(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export const useStatsStore = defineStore('stats', () => {
  /** 旧版按日聚合；新版数据从 sessions 现算，这里只用于补历史 */
  const days = ref<Record<string, DayStat>>({})
  const sessions = ref<FocusSession[]>([])
  const loaded = ref(false)
  const error = ref('')

  async function load(): Promise<void> {
    try {
      const data = await loadStore<StatsData>('stats')
      days.value = data.days ?? {}
      sessions.value = data.sessions ?? []
      error.value = ''
    } catch {
      error.value = '统计数据没读出来，重启应用再试试'
    } finally {
      loaded.value = true
    }
  }

  /**
   * 每日汇总。明细里没有的历史日期用旧聚合补上；
   * 同一天两边都有值时取大的——升级当天两份数据各记了一半。
   */
  const daily = computed<Record<string, DayStat>>(() => {
    const merged: Record<string, DayStat> = {}
    for (const session of sessions.value) {
      const key = dayKeyOf(new Date(session.startAt))
      const day = merged[key] ?? { pomodoros: 0, focusMinutes: 0 }
      day.focusMinutes += session.minutes
      if (session.completed) day.pomodoros += 1
      merged[key] = day
    }
    for (const [key, legacy] of Object.entries(days.value)) {
      const fromSessions = merged[key]
      merged[key] = fromSessions
        ? {
            pomodoros: Math.max(fromSessions.pomodoros, legacy.pomodoros),
            focusMinutes: Math.max(fromSessions.focusMinutes, legacy.focusMinutes)
          }
        : { ...legacy }
    }
    return merged
  })

  const totalMinutes = computed(() =>
    Object.values(daily.value).reduce((sum, day) => sum + day.focusMinutes, 0)
  )
  const totalPomodoros = computed(() =>
    Object.values(daily.value).reduce((sum, day) => sum + day.pomodoros, 0)
  )
  /** 真实专注过的天数，不是从注册日算起的自然天 */
  const focusDays = computed(
    () => Object.values(daily.value).filter((day) => day.focusMinutes > 0).length
  )

  const today = computed<DayStat>(
    () => daily.value[dayKeyOf(new Date())] ?? { pomodoros: 0, focusMinutes: 0 }
  )

  /** 连续专注天数；今天还没开始不算断，从昨天往前数 */
  const streak = computed(() => {
    const cursor = new Date()
    if (!(daily.value[dayKeyOf(cursor)]?.focusMinutes > 0)) cursor.setDate(cursor.getDate() - 1)
    let count = 0
    for (;;) {
      const day = daily.value[dayKeyOf(cursor)]
      if (!day || day.focusMinutes <= 0) break
      count += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  })

  function range(dayCount: number): Array<DayStat & { key: string; label: string }> {
    const list: Array<DayStat & { key: string; label: string }> = []
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = dayKeyOf(date)
      const day = daily.value[key] ?? { pomodoros: 0, focusMinutes: 0 }
      list.push({ key, label: `${date.getMonth() + 1}/${date.getDate()}`, ...day })
    }
    return list
  }

  /** 24 小时分布，看自己到底是早起型还是夜猫子 */
  const byHour = computed(() => {
    const hours = new Array<number>(24).fill(0)
    for (const session of sessions.value) {
      hours[new Date(session.startAt).getHours()] += session.minutes
    }
    return hours
  })

  /** 各任务累计专注，用于「时间都花在哪」 */
  const byTarget = computed(() => {
    const map = new Map<string, { name: string; minutes: number; count: number }>()
    for (const session of sessions.value) {
      const name = session.targetName || '未绑定任务'
      const row = map.get(name) ?? { name, minutes: 0, count: 0 }
      row.minutes += session.minutes
      row.count += 1
      map.set(name, row)
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes)
  })

  const recent = computed(() => [...sessions.value].sort((a, b) => b.startAt - a.startAt))

  return {
    days,
    sessions,
    loaded,
    error,
    daily,
    totalMinutes,
    totalPomodoros,
    focusDays,
    today,
    streak,
    byHour,
    byTarget,
    recent,
    range,
    load
  }
})
