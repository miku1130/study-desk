<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import DesktopWidgetCard, { type WidgetLessonItem } from '@/components/widgets/DesktopWidgetCard.vue'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useTimetableStore } from '@/stores/timetable'
import { useSchedulesStore } from '@/stores/schedules'
import { useCountdownStore } from '@/stores/countdowns'
import { useTodoStore } from '@/stores/todos'
import { calculateWidgetDragPosition, type DragPoint } from '@/lib/widgetDrag'
import { resolvePointerInteractive, WIDGET_INTERACTIVE_SELECTOR } from '@/lib/widgetPointer'
import { buildTimetableWidgetWeekRows } from '@/lib/timetableWidget'

const route = useRoute()
const widgets = useDesktopWidgetsStore()
const countdowns = useCountdownStore()
const todos = useTodoStore()
const timetable = useTimetableStore()
const schedules = useSchedulesStore()
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
const timetableWeekRows = computed(() => buildTimetableWidgetWeekRows(timetable.periods, timetable.lessons))
const weekday = computed(() => {
  const day = new Date().getDay()
  return day === 0 ? 7 : day
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

interface ResizeSession {
  pointerId: number
  pointerOrigin: DragPoint
  sizeOrigin: { width: number; height: number }
  latestSize: { width: number; height: number }
}

let dragSession: DragSession | null = null
let resizeSession: ResizeSession | null = null
let moveFrame = 0

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element &&
      target.closest(
        'button, input, textarea, select, a, .memo-list, .memo-quick, .widget-actions, .todo-attachments, .widget-resize-handle'
      )
  )
}

async function startResize(event: PointerEvent): Promise<void> {
  if (event.button !== 0 || !config.value || config.value.locked) return
  event.preventDefault()
  event.stopPropagation()
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  const bounds = await window.api.desktopWidgets.beginDrag(config.value.id)
  if (!bounds || !handle.hasPointerCapture(event.pointerId)) return
  resizeSession = {
    pointerId: event.pointerId,
    pointerOrigin: { x: event.screenX, y: event.screenY },
    sizeOrigin: { width: bounds.width, height: bounds.height },
    latestSize: { width: bounds.width, height: bounds.height }
  }
}

function moveResize(event: PointerEvent): void {
  const session = resizeSession
  if (!session || session.pointerId !== event.pointerId || !config.value) return
  session.latestSize = {
    width: Math.max(220, Math.min(800, Math.round(session.sizeOrigin.width + event.screenX - session.pointerOrigin.x))),
    height: Math.max(150, Math.min(600, Math.round(session.sizeOrigin.height + event.screenY - session.pointerOrigin.y)))
  }
  if (moveFrame) return
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0
    if (!resizeSession || !config.value) return
    window.api.desktopWidgets.resize(config.value.id, resizeSession.latestSize.width, resizeSession.latestSize.height)
  })
}

function endResize(event: PointerEvent): void {
  const session = resizeSession
  if (!session || session.pointerId !== event.pointerId || !config.value) return
  if (moveFrame) {
    cancelAnimationFrame(moveFrame)
    moveFrame = 0
  }
  // 松开鼠标时补发最后尺寸，避免 pointerup 紧跟在未执行的动画帧之后导致末次调整丢失。
  window.api.desktopWidgets.resize(config.value.id, session.latestSize.width, session.latestSize.height)
  resizeSession = null
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

function applyPointerInteractive(overInteractive: boolean): void {
  const id = config.value?.id
  if (!id) return
  const decision = resolvePointerInteractive(
    Boolean(config.value?.locked),
    overInteractive,
    pointerInteractive
  )
  pointerInteractive = decision.interactive
  if (decision.send) void window.api.desktopWidgets.setPointerInteractive(id, decision.interactive)
}

function handleMouseMove(event: MouseEvent): void {
  const target = document.elementFromPoint(event.clientX, event.clientY)
  applyPointerInteractive(Boolean(target?.closest(WIDGET_INTERACTIVE_SELECTOR)))
}

// 指针可能从小锁上直接飞出窗口，之后再也收不到 mousemove；
// 不兜底的话窗口会一直抓着鼠标，系统提示条也会卡在最顶层
function handlePointerGone(): void {
  applyPointerInteractive(false)
}

// 失焦时主动清掉系统级鼠标捕获。全屏应用切换不会保证触发 DOM mouseleave，
// 只依赖 mouseleave 会让“解锁摆件”提示残留在其他应用上方。
function handleVisibilityChange(): void {
  if (document.hidden) handlePointerGone()
}

document.documentElement.classList.add('desktop-widget-window')
document.addEventListener('mousemove', handleMouseMove)
document.addEventListener('mouseleave', handlePointerGone)
window.addEventListener('blur', handlePointerGone)
document.addEventListener('visibilitychange', handleVisibilityChange)
watch(() => config.value?.locked, handlePointerGone)
onBeforeUnmount(() => {
  if (moveFrame) cancelAnimationFrame(moveFrame)
  document.documentElement.classList.remove('desktop-widget-window')
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handlePointerGone)
  window.removeEventListener('blur', handlePointerGone)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      :timetable-week-rows="timetableWeekRows"
      :weekday="weekday"
      :schedule-items="schedules.items"
      :memos="memos"
      @close="close"
      @toggle-lock="toggleLock"
      @cycle-countdown="cycleCountdown"
      @add-memo="addMemo"
    />
    <button
      v-if="config && !config.locked"
      class="widget-resize-handle"
      aria-label="调整摆件大小"
      title="调整摆件大小"
      @pointerdown="startResize"
      @pointermove="moveResize"
      @pointerup="endResize"
      @pointercancel="endResize"
    ><AppIcon name="expand" :size="12" /></button>
    <div v-if="!config" class="widget-loading">正在载入摆件</div>
  </main>
</template>

<style scoped>
.desktop-widget-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 6px;
  overflow: hidden;
  background: transparent;
}
.widget-resize-handle {
  position: absolute;
  right: 5px;
  bottom: 5px;
  z-index: 3;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.78);
  cursor: nwse-resize;
  -webkit-app-region: no-drag;
}
.widget-resize-handle:hover { background: rgba(0, 0, 0, 0.42); }
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
