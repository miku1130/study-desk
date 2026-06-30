import { computed, type ComputedRef, type Ref } from 'vue'
import { useClock } from './useClock'
import { useTimetableStore } from '@/stores/timetable'
import type { Lesson, Period } from '@/types'

export interface LessonWithPeriod extends Lesson {
  period: Period
}

export interface TimetableStatus {
  now: Ref<Date>
  weekday: ComputedRef<number>
  todayLessons: ComputedRef<LessonWithPeriod[]>
  current: ComputedRef<LessonWithPeriod | null>
  next: ComputedRef<LessonWithPeriod | null>
  nextCountdown: ComputedRef<string>
}

function toMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function useTimetableStatus(): TimetableStatus {
  const tt = useTimetableStore()
  const { now } = useClock()

  const weekday = computed(() => (now.value.getDay() === 0 ? 7 : now.value.getDay()))
  const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())

  const todayLessons = computed<LessonWithPeriod[]>(() => {
    const list: LessonWithPeriod[] = []
    for (const l of tt.lessons) {
      if (l.day !== weekday.value) continue
      const p = tt.periods.find((x) => x.id === l.periodId)
      if (p) list.push({ ...l, period: p })
    }
    return list.sort((a, b) => toMin(a.period.start) - toMin(b.period.start))
  })

  const current = computed<LessonWithPeriod | null>(
    () =>
      todayLessons.value.find(
        (l) => nowMinutes.value >= toMin(l.period.start) && nowMinutes.value < toMin(l.period.end)
      ) ?? null
  )

  const next = computed<LessonWithPeriod | null>(
    () => todayLessons.value.find((l) => toMin(l.period.start) > nowMinutes.value) ?? null
  )

  const nextCountdown = computed(() => {
    if (!next.value) return ''
    const diff = toMin(next.value.period.start) - nowMinutes.value
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
  })

  return { now, weekday, todayLessons, current, next, nextCountdown }
}
