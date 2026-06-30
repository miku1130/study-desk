import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Lesson, Period, TimetableData } from '@/types'
import { clone, loadStore, saveStore } from '@/lib/persist'

export const useTimetableStore = defineStore('timetable', () => {
  const periods = ref<Period[]>([])
  const lessons = ref<Lesson[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const data = await loadStore<TimetableData>('timetable')
    periods.value = data.periods ?? []
    lessons.value = data.lessons ?? []
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('timetable', { periods: periods.value, lessons: lessons.value })
  }

  function upsertLesson(lesson: Lesson): void {
    const i = lessons.value.findIndex((l) => l.id === lesson.id)
    if (i >= 0) lessons.value[i] = lesson
    else lessons.value.push(lesson)
    save()
  }

  function removeLesson(id: string): void {
    lessons.value = lessons.value.filter((l) => l.id !== id)
    save()
  }

  function lessonAt(day: number, periodId: string): Lesson | undefined {
    return lessons.value.find((l) => l.day === day && l.periodId === periodId)
  }

  function setPeriods(next: Period[]): void {
    periods.value = clone(next)
    // 清理引用了已删除节次的课程
    const ids = new Set(periods.value.map((p) => p.id))
    lessons.value = lessons.value.filter((l) => ids.has(l.periodId))
    save()
  }

  function replaceAll(data: TimetableData): void {
    periods.value = data.periods ?? []
    lessons.value = data.lessons ?? []
    save()
  }

  return { periods, lessons, loaded, load, save, upsertLesson, removeLesson, lessonAt, setPeriods, replaceAll }
})
