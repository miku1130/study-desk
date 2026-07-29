import { computed, type ComputedRef, type Ref } from 'vue'
import { useClock } from './useClock'
import { useTimetableStore } from '@/stores/timetable'
import { isPeriodRemaining, timeToMinutes } from '@/lib/timetableLayout'
import type { Lesson, Period } from '@/types'

export interface LessonWithPeriod extends Lesson {
  period: Period
}

export interface TimetableStatus {
  now: Ref<Date>
  weekday: ComputedRef<number>
  todayLessons: ComputedRef<LessonWithPeriod[]>
  remainingLessons: ComputedRef<LessonWithPeriod[]>
  current: ComputedRef<LessonWithPeriod | null>
  next: ComputedRef<LessonWithPeriod | null>
  nextCountdown: ComputedRef<string>
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
    return list.sort(
      (a, b) => timeToMinutes(a.period.start) - timeToMinutes(b.period.start)
    )
  })

  const remainingLessons = computed(() =>
    todayLessons.value.filter((lesson) => isPeriodRemaining(lesson.period, nowMinutes.value))
  )

  const current = computed<LessonWithPeriod | null>(
    () =>
      todayLessons.value.find(
        (l) =>
          nowMinutes.value >= timeToMinutes(l.period.start) &&
          nowMinutes.value < timeToMinutes(l.period.end)
      ) ?? null
  )

  const next = computed<LessonWithPeriod | null>(
    () =>
      todayLessons.value.find((l) => timeToMinutes(l.period.start) > nowMinutes.value) ?? null
  )

  const nextCountdown = computed(() => {
    if (!next.value) return ''
    const diff = timeToMinutes(next.value.period.start) - nowMinutes.value
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
  })

  return { now, weekday, todayLessons, remainingLessons, current, next, nextCountdown }
}
