<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import DesktopWidgetCard, { type WidgetLessonItem } from '@/components/widgets/DesktopWidgetCard.vue'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useCountdownStore } from '@/stores/countdowns'
import { useTodoStore } from '@/stores/todos'
import { calculateWidgetDragPosition, type DragPoint } from '@/lib/widgetDrag'

const route = useRoute()
const widgets = useDesktopWidgetsStore()
const countdowns = useCountdownStore()
const todos = useTodoStore()
const { remainingLessons } = useTimetableStatus()

const widgetId = computed(() => String(route.params.id ?? ''))
const config = computed(() => widgets.items.find((item) => item.id === widgetId.value) ?? null)
const countdown = computed(() => countdowns.items.find((item) => item.id === config.value?.sourceId) ?? null)
const memos = computed(() =>
  todos.items
    .filter((item) => !item.done && (item.kind === 'memo' || item.kind === 'idea'))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
)
const lessons = computed<WidgetLessonItem[]>(() => {
  return remainingLessons.value.map((lesson) => ({
    ...lesson,
    start: lesson.period.start,
    end: lesson.period.end
  }))
})

function close(): void {
  if (config.value) void window.api.desktopWidgets.close(config.value.id)
}

function toggleLock(): void {
  if (!config.value) return
  const next = { ...config.value, locked: !config.value.locked }
  if (!next.locked) void window.api.desktopWidgets.setPointerInteractive(next.id, true)
  widgets.update(next)
}

function cycleCountdown(): void {
  if (!config.value || !countdowns.sorted.length) return
  const index = countdowns.sorted.findIndex((item) => item.id === config.value?.sourceId)
  const next = countdowns.sorted[(index + 1 + countdowns.sorted.length) % countdowns.sorted.length]
  widgets.update({ ...config.value, sourceId: next.id })
}

function addMemo(text: string): void {
  todos.add(text, 0, '', { kind: 'memo' })
}

interface DragSession {
  pointerId: number
  pointerOrigin: DragPoint
  windowOrigin: DragPoint
  latestPosition: DragPoint
}

let dragSession: DragSession | null = null
let moveFrame = 0

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element &&
      target.closest(
        'button, input, textarea, select, a, .memo-list, .memo-quick, .widget-actions, .todo-attachments'
      )
  )
}

async function startDrag(event: PointerEvent): Promise<void> {
  if (event.button !== 0 || !config.value || config.value.locked || isInteractiveTarget(event.target)) return
  event.preventDefault()
  const card = event.currentTarget as HTMLElement
  card.setPointerCapture(event.pointerId)
  const pointerOrigin = { x: event.screenX, y: event.screenY }
  const bounds = await window.api.desktopWidgets.beginDrag(config.value.id)
  if (!bounds || !card.hasPointerCapture(event.pointerId)) return
  const windowOrigin = { x: bounds.x, y: bounds.y }
  dragSession = { pointerId: event.pointerId, pointerOrigin, windowOrigin, latestPosition: windowOrigin }
  card.classList.add('dragging')
}

function moveDrag(event: PointerEvent): void {
  const session = dragSession
  if (!session || session.pointerId !== event.pointerId || !config.value) return
  session.latestPosition = calculateWidgetDragPosition(session.windowOrigin, session.pointerOrigin, {
    x: event.screenX,
    y: event.screenY
  })
  if (moveFrame) return
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0
    if (!dragSession || !config.value) return
    window.api.desktopWidgets.move(
      config.value.id,
      dragSession.latestPosition.x,
      dragSession.latestPosition.y
    )
  })
}

function endDrag(event: PointerEvent): void {
  const session = dragSession
  if (!session || session.pointerId !== event.pointerId || !config.value) return
  if (moveFrame) {
    cancelAnimationFrame(moveFrame)
    moveFrame = 0
  }
  dragSession = null
  const root = event.currentTarget as HTMLElement
  root.classList.remove('dragging')
  void window.api.desktopWidgets.endDrag(
    config.value.id,
    session.latestPosition.x,
    session.latestPosition.y
  )
}

let pointerInteractive = false
function handleMouseMove(event: MouseEvent): void {
  if (!config.value?.locked) return
  const target = document.elementFromPoint(event.clientX, event.clientY)
  const overInteractive = Boolean(target?.closest('.widget-lock-toggle, .todo-attachment-open'))
  if (overInteractive === pointerInteractive) return
  pointerInteractive = overInteractive
  void window.api.desktopWidgets.setPointerInteractive(config.value.id, overInteractive)
}

document.documentElement.classList.add('desktop-widget-window')
document.addEventListener('mousemove', handleMouseMove)
onBeforeUnmount(() => {
  if (moveFrame) cancelAnimationFrame(moveFrame)
  document.documentElement.classList.remove('desktop-widget-window')
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <main
    class="desktop-widget-root"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <DesktopWidgetCard
      v-if="config"
      :config="config"
      :countdown="countdown"
      :lessons="lessons"
      :memos="memos"
      @close="close"
      @toggle-lock="toggleLock"
      @cycle-countdown="cycleCountdown"
      @add-memo="addMemo"
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
.desktop-widget-root.dragging :deep(.desktop-widget-card) {
  cursor: grabbing;
  user-select: none;
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
