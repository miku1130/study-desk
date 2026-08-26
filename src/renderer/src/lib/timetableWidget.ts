import type { Lesson, Period } from '@/types'

export interface TimetableWidgetLesson extends Lesson {
  start: string
  end: string
}

export interface TimetableWidgetWeekRow {
  id: string
  name: string
  start: string
  end: string
  lessons: Array<TimetableWidgetLesson | null>
}

export function buildTimetableWidgetWeekRows(
  periods: Period[],
  lessons: Lesson[]
): TimetableWidgetWeekRow[] {
  return [...periods]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((period) => ({
      id: period.id,
      name: period.name,
      start: period.start,
      end: period.end,
      lessons: Array.from({ length: 7 }, (_, index) => {
        const lesson = lessons.find((item) => item.day === index + 1 && item.periodId === period.id)
        return lesson ? { ...lesson, start: period.start, end: period.end } : null
      })
    }))
}
