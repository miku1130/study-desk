<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DesktopWidgetCard, { type WidgetLessonItem } from '@/components/widgets/DesktopWidgetCard.vue'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useCountdownStore } from '@/stores/countdowns'
import { useTimetableStore } from '@/stores/timetable'
import { useTodoStore } from '@/stores/todos'

const route = useRoute()
const widgets = useDesktopWidgetsStore()
const countdowns = useCountdownStore()
const timetable = useTimetableStore()
const todos = useTodoStore()

const widgetId = computed(() => String(route.params.id ?? ''))
const config = computed(() => widgets.items.find((item) => item.id === widgetId.value) ?? null)
const countdown = computed(() => countdowns.items.find((item) => item.id === config.value?.sourceId) ?? null)
const memo = computed(() => {
  const selected = todos.items.find((item) => item.id === config.value?.sourceId)
  return selected ?? todos.items.find((item) => !item.done && item.kind !== 'task') ?? null
})
const lessons = computed<WidgetLessonItem[]>(() => {
  const day = new Date().getDay() || 7
  const periods = new Map(timetable.periods.map((period) => [period.id, period]))
  return timetable.lessons
    .filter((lesson) => lesson.day === day && periods.has(lesson.periodId))
    .map((lesson) => {
      const period = periods.get(lesson.periodId)!
      return { ...lesson, start: period.start, end: period.end }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
})

function close(): void {
  if (config.value) void window.api.desktopWidgets.close(config.value.id)
}
</script>

<template>
  <main class="desktop-widget-root">
    <DesktopWidgetCard
      v-if="config"
      :config="config"
      :countdown="countdown"
      :lessons="lessons"
      :memo="memo"
      @close="close"
    />
    <div v-else class="widget-loading">正在载入摆件</div>
  </main>
</template>

<style scoped>
.desktop-widget-root {
  width: 100vw;
  height: 100vh;
  padding: 6px;
  overflow: hidden;
  background: transparent;
}
.widget-loading {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(34, 42, 38, 0.92);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}
</style>
