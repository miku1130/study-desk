<script setup lang="ts">
import { computed, nextTick, ref, type CSSProperties } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import TodoAttachmentList from '@/components/todo/TodoAttachmentList.vue'
import { daysLeft } from '@/stores/countdowns'
import { WEEKDAYS, type Countdown, type DesktopWidgetConfig, type ScheduleItem, type TodoItem } from '@/types'
import type { TimetableWidgetWeekRow } from '@/lib/timetableWidget'

export interface WidgetLessonItem {
  id: string
  name: string
  start: string
  end: string
  location: string
  teacher: string
  color: string
}

const props = defineProps<{
  config: DesktopWidgetConfig
  countdown?: Countdown | null
  lessons?: WidgetLessonItem[]
  memos?: TodoItem[]
  timetableWeekRows?: TimetableWidgetWeekRow[]
  weekday?: number
  scheduleItems?: ScheduleItem[]
  preview?: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-lock': []
  'cycle-countdown': []
  'add-memo': [text: string]
}>()

const showMemoInput = ref(false)
const memoDraft = ref('')
const memoInput = ref<HTMLInputElement | null>(null)

function pad(value: number): string { return String(value).padStart(2, '0') }
function dateKey(date: Date): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function dateFromKey(key: string): Date { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day) }
function dayLabel(date: Date): string { return `${date.getMonth() + 1}/${date.getDate()}` }

const fontStack = computed(() => {
  if (props.config.font === 'serif') return '"Songti SC", "STSong", Georgia, serif'
  if (props.config.font === 'rounded') return '"Microsoft YaHei UI", "PingFang SC", sans-serif'
  if (props.config.font === 'mono') return '"Cascadia Mono", "SFMono-Regular", Consolas, monospace'
  if (props.config.font === 'handwriting') return '"Ma Shan Zheng", cursive'
  if (props.config.font === 'literary') return '"ZCOOL XiaoWei", serif'
  if (props.config.font === 'display') return '"ZCOOL QingKe HuangYou", sans-serif'
  return 'Inter, "Microsoft YaHei UI", "PingFang SC", sans-serif'
})

const cardStyle = computed<CSSProperties>(() => {
  const style = {
    '--widget-color': props.config.fontColor,
    '--widget-accent': props.config.accentColor,
    '--widget-font': fontStack.value,
    '--widget-font-scale': String(props.config.fontScale ?? 1)
  } as CSSProperties
  return style
})

const surfaceStyle = computed<CSSProperties>(() => ({
  backgroundColor: props.config.backgroundColor,
  backgroundImage: props.config.background
    ? `linear-gradient(rgba(10, 14, 12, ${props.config.overlayOpacity}), rgba(10, 14, 12, ${props.config.overlayOpacity})), url('${window.api.media.url(props.config.background)}')`
    : undefined,
  opacity: props.config.surfaceOpacity
}))

const memoImages = computed(() =>
  (props.memos ?? []).flatMap((memo) =>
    memo.attachments.filter((attachment) => attachment.kind === 'image')
  )
)
const selectedMemoImage = computed(() =>
  memoImages.value.find((image) => image.id === props.config.memoImageAttachmentId)
)
const pureImageMode = computed(
  () =>
    props.config.kind === 'memo' &&
    props.config.memoDisplayMode === 'image' &&
    Boolean(selectedMemoImage.value)
)
const pureImageUrl = computed(() =>
  selectedMemoImage.value ? window.api.media.url(selectedMemoImage.value.path) : ''
)

const countdownNumber = computed(() => Math.abs(daysLeft(props.countdown?.date ?? '')))
const countdownState = computed(() => {
  const days = daysLeft(props.countdown?.date ?? '')
  if (days > 0) return '距离目标还有'
  if (days === 0) return '就是今天'
  return `已经过去 ${Math.abs(days)} 天`
})

const scheduleTodayKey = dateKey(new Date())
const scheduleMonthCells = computed(() => {
  const today = dateFromKey(scheduleTodayKey)
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const start = new Date(first)
  // 日程视图统一以周一为一周起点，与页面表头和课表保持一致。
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      outside: date.getMonth() !== today.getMonth(),
      today: key === scheduleTodayKey,
      items: (props.scheduleItems ?? []).filter((item) => item.date === key)
    }
  })
})
const scheduleWeekDays = computed(() => {
  const today = dateFromKey(scheduleTodayKey)
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    return { key, label: dayLabel(date), weekday: index + 1, items: (props.scheduleItems ?? []).filter((item) => item.date === key) }
  })
})
const scheduleDayItems = computed(() =>
  (props.scheduleItems ?? [])
    .filter((item) => item.date === scheduleTodayKey)
    .sort((a, b) => Number(a.allDay) - Number(b.allDay) || a.start.localeCompare(b.start))
)
function scheduleTime(item: ScheduleItem): string { return item.allDay ? '全天' : `${item.start} - ${item.end}` }

function lessonDuration(start: string, end: string): string {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const minutes = endHour * 60 + endMinute - startHour * 60 - startMinute
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} 小时` : `${minutes} 分钟`
}

async function openMemoInput(): Promise<void> {
  showMemoInput.value = true
  await nextTick()
  memoInput.value?.focus()
}

function submitMemo(): void {
  const text = memoDraft.value.trim()
  if (!text) return
  emit('add-memo', text)
  memoDraft.value = ''
  showMemoInput.value = false
}
</script>

<template>
  <article
    class="desktop-widget-card"
    :class="[`kind-${config.kind}`, `size-${config.size}`, { locked: config.locked, preview, 'pure-image-mode': pureImageMode }]"
    :style="cardStyle"
  >
    <img v-if="pureImageMode" class="memo-pure-image" :src="pureImageUrl" :alt="selectedMemoImage?.name ?? ''" />
    <template v-else>
      <span class="widget-surface" :style="surfaceStyle" />
      <header class="widget-head">
      <span class="widget-kicker">
        <AppIcon :name="config.kind === 'countdown' ? 'hourglass' : 'calendar'" :size="13" />
        {{ config.kind === 'countdown' ? '倒数日' : config.kind === 'timetable' ? (config.timetableMode === 'week' ? '本周课表' : '今日课表') : config.kind === 'schedules' ? '日程管理' : '备忘录' }}
      </span>
      <div v-if="!preview" class="widget-actions">
        <button v-if="config.kind === 'countdown'" class="widget-action" title="切换倒数日" aria-label="切换倒数日" @click="$emit('cycle-countdown')">
          <AppIcon name="rotate-ccw" :size="13" />
        </button>
        <button v-if="config.kind === 'memo' && !config.locked" class="widget-action" title="快捷记录" aria-label="快捷记录" @click="openMemoInput">
          <AppIcon name="plus" :size="14" />
        </button>
        <button class="widget-action widget-lock-toggle" :title="config.locked ? '解锁摆件' : '锁定摆件'" :aria-label="config.locked ? '解锁摆件' : '锁定摆件'" @click="$emit('toggle-lock')">
          <AppIcon :name="config.locked ? 'lock' : 'unlock'" :size="13" />
        </button>
        <button v-if="!config.locked" class="widget-action" title="关闭摆件" aria-label="关闭摆件" @click="$emit('close')">
          <AppIcon name="x" :size="14" />
        </button>
      </div>
      <AppIcon v-else-if="config.locked" class="lock-mark" name="lock" :size="13" />
      </header>

      <section v-if="config.kind === 'countdown'" class="countdown-body">
      <p class="widget-title">{{ countdown?.title || config.title || '选择一个倒数日' }}</p>
      <p class="countdown-value">{{ countdownNumber }}<small>天</small></p>
      <div class="widget-footer">
        <span>{{ countdownState }}</span>
        <time>{{ countdown?.date || '尚未设置日期' }}</time>
      </div>
      </section>

      <section v-else-if="config.kind === 'timetable'" class="timetable-body">
      <p class="widget-title">{{ config.title || (config.timetableMode === 'week' ? '本周课表' : '今天的课程') }}</p>
      <div v-if="config.timetableMode === 'week' && timetableWeekRows?.length" class="timetable-week">
        <div class="timetable-week-head"><span>节次</span><span v-for="(day, index) in WEEKDAYS" :key="day" :class="{ today: index + 1 === weekday }">{{ day }}</span></div>
        <div v-for="row in timetableWeekRows" :key="row.id" class="timetable-week-row">
          <span class="period-label"><strong>{{ row.name.replace('第 ', '') }}</strong><small>{{ row.start }}</small></span>
          <span v-for="(lesson, index) in row.lessons" :key="`${row.id}-${index}`" class="week-lesson" :class="{ today: index + 1 === weekday, empty: !lesson }" :style="lesson ? { backgroundColor: lesson.color } : undefined">{{ lesson?.name || '·' }}</span>
        </div>
      </div>
      <div v-else-if="lessons?.length" class="lesson-list">
        <div v-for="lesson in lessons" :key="lesson.id" class="lesson-row">
          <span class="lesson-dot" :style="{ background: lesson.color }" />
          <span class="lesson-main">
            <strong>{{ lesson.name }}</strong>
            <small>{{ [lesson.teacher, lesson.location, lessonDuration(lesson.start, lesson.end)].filter(Boolean).join(' · ') || '课程安排' }}</small>
          </span>
          <time>{{ lesson.start }}<br />{{ lesson.end }}</time>
        </div>
      </div>
      <p v-else class="widget-empty">今天没有课程，留点时间给自己。</p>
      </section>

      <section v-else-if="config.kind === 'schedules'" class="schedules-body">
      <p class="widget-title">{{ config.title || '日程管理' }} <small class="mode-label">{{ config.scheduleMode === 'month' ? '月' : config.scheduleMode === 'week' ? '周' : '日' }}</small></p>
      <div v-if="config.scheduleMode === 'month'" class="schedule-month">
        <div class="schedule-month-head"><span v-for="day in WEEKDAYS" :key="day">{{ day }}</span></div>
        <div class="schedule-month-grid"><span v-for="cell in scheduleMonthCells" :key="cell.key" class="schedule-month-cell" :class="{ outside: cell.outside, today: cell.today, busy: cell.items.length }"><b>{{ cell.day }}</b><i v-if="cell.items.length">{{ cell.items.length > 9 ? '9+' : cell.items.length }}</i></span></div>
      </div>
      <div v-else-if="config.scheduleMode === 'week'" class="schedule-week">
        <div v-for="day in scheduleWeekDays" :key="day.key" class="schedule-week-day" :class="{ today: day.key === scheduleTodayKey }"><strong>{{ day.label }}</strong><span v-for="item in day.items.slice(0, 3)" :key="item.id" :style="{ borderLeftColor: item.color }">{{ item.title }}</span><small v-if="day.items.length > 3">+{{ day.items.length - 3 }}</small></div>
      </div>
      <div v-else class="schedule-day">
        <div v-for="item in scheduleDayItems.slice(0, 5)" :key="item.id" class="schedule-day-row"><time>{{ scheduleTime(item) }}</time><span :style="{ backgroundColor: item.color }"></span><strong>{{ item.title }}</strong></div>
        <p v-if="!scheduleDayItems.length" class="widget-empty">今天没有日程</p>
        <small v-else-if="scheduleDayItems.length > 5" class="schedule-more">还有 {{ scheduleDayItems.length - 5 }} 项</small>
      </div>
      </section>

      <section v-else class="memo-body">
      <p class="widget-title">{{ config.title || '备忘与灵感' }}</p>
      <form v-if="showMemoInput && !config.locked" class="memo-quick" @submit.prevent="submitMemo">
        <input ref="memoInput" v-model="memoDraft" maxlength="120" placeholder="记录此刻想到的事" @keydown.esc="showMemoInput = false" />
        <button type="submit" title="保存"><AppIcon name="check" :size="13" /></button>
      </form>
      <div v-if="memos?.length" class="memo-list">
        <article v-for="item in memos" :key="item.id" class="memo-item">
          <span class="memo-kind">{{ item.kind === 'idea' ? '灵感' : '备忘' }}</span>
          <p>{{ item.text }}</p>
          <small v-if="item.note">{{ item.note }}</small>
          <TodoAttachmentList
            v-if="item.attachments.length"
            class="widget-memo-attachments"
            :attachments="item.attachments"
            mode="widget"
          />
        </article>
      </div>
      <p v-else class="widget-empty">暂无备忘，点击右上角加号快速记录。</p>
      </section>
    </template>
  </article>
</template>

<style scoped>
.desktop-widget-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 18px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  color: var(--widget-color);
  font-family: var(--widget-font);
  -webkit-app-region: no-drag;
  container-type: size;
}
.desktop-widget-card:not(.locked):not(.preview) {
  cursor: grab;
}
.desktop-widget-card.preview {
  -webkit-app-region: no-drag;
}
.desktop-widget-card.pure-image-mode {
  padding: 0;
}
.memo-pure-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.widget-surface {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-position: center;
  background-size: cover;
  pointer-events: none;
}
.widget-head,
.countdown-body,
.timetable-body,
.schedules-body,
.memo-body {
  position: relative;
  z-index: 1;
}
.widget-head {
  display: flex;
  align-items: center;
  min-height: 24px;
}
.widget-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: color-mix(in srgb, var(--widget-color) 72%, transparent);
  font-size: calc(11px * var(--widget-font-scale, 1));
  font-weight: 750;
}
.widget-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}
.widget-action {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  -webkit-app-region: no-drag;
}
.widget-action:hover {
  background: rgba(0, 0, 0, 0.36);
}
.lock-mark {
  margin-left: auto;
  opacity: 0.48;
}
.widget-title {
  margin-top: 10px;
  overflow: hidden;
  color: color-mix(in srgb, var(--widget-color) 88%, transparent);
  font-size: calc(14px * var(--widget-font-scale, 1));
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.countdown-value {
  margin-top: 4px;
  color: var(--widget-accent);
  font-size: clamp(calc(38px * var(--widget-font-scale, 1)), calc(24cqh * var(--widget-font-scale, 1)), calc(76px * var(--widget-font-scale, 1)));
  font-weight: 820;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.countdown-value small {
  margin-left: 5px;
  color: var(--widget-color);
  font-size: calc(14px * var(--widget-font-scale, 1));
  font-weight: 700;
}
.widget-footer {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: color-mix(in srgb, var(--widget-color) 68%, transparent);
  font-size: calc(11px * var(--widget-font-scale, 1));
}
.widget-footer time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.countdown-body,
.memo-body,
.timetable-body {
  height: calc(100% - 24px);
}
.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
  overflow: hidden;
}
.lesson-row {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 45px;
  padding: 7px 9px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}
.lesson-dot {
  width: 4px;
  height: 26px;
  border-radius: 2px;
}
.lesson-main {
  min-width: 0;
}
.lesson-main strong,
.lesson-main small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-main strong {
  font-size: calc(12px * var(--widget-font-scale, 1));
}
.lesson-main small {
  margin-top: 2px;
  color: color-mix(in srgb, var(--widget-color) 61%, transparent);
  font-size: calc(10px * var(--widget-font-scale, 1));
}
.lesson-row time {
  color: color-mix(in srgb, var(--widget-color) 70%, transparent);
  font-size: calc(9.5px * var(--widget-font-scale, 1));
  line-height: 1.35;
  text-align: right;
}
.timetable-week { margin-top: 8px; overflow: hidden; }
.timetable-week-head, .timetable-week-row { display: grid; grid-template-columns: 32px repeat(7, minmax(0, 1fr)); gap: 3px; align-items: stretch; }
.timetable-week-head { margin-bottom: 3px; color: color-mix(in srgb, var(--widget-color) 62%, transparent); font-size: calc(9px * var(--widget-font-scale, 1)); text-align: center; }
.timetable-week-head span { padding: 2px 0; }.timetable-week-head .today { color: var(--widget-accent); font-weight: 800; }
.timetable-week-row { min-height: 25px; margin-top: 3px; }.period-label { display: flex; flex-direction: column; justify-content: center; color: color-mix(in srgb, var(--widget-color) 62%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); line-height: 1.1; text-align: center; }.period-label small { margin-top: 2px; font-size: calc(7px * var(--widget-font-scale, 1)); }
.week-lesson { display: flex; align-items: center; justify-content: center; min-width: 0; overflow: hidden; padding: 2px; border-radius: 4px; color: #fff; font-size: calc(8px * var(--widget-font-scale, 1)); font-weight: 700; text-align: center; text-overflow: ellipsis; white-space: nowrap; }.week-lesson.empty { color: color-mix(in srgb, var(--widget-color) 28%, transparent); background: rgba(255,255,255,.04); }.week-lesson.today { outline: 1px solid color-mix(in srgb, var(--widget-accent) 68%, transparent); outline-offset: -1px; }
.schedules-body { height: calc(100% - 24px); overflow: hidden; }.mode-label { margin-left: 4px; color: color-mix(in srgb, var(--widget-accent) 86%, transparent); font-size: calc(9px * var(--widget-font-scale, 1)); font-weight: 700; }
.schedule-month { margin-top: 8px; }.schedule-month-head, .schedule-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }.schedule-month-head { color: color-mix(in srgb, var(--widget-color) 60%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); text-align: center; }.schedule-month-grid { margin-top: 3px; }.schedule-month-cell { position: relative; min-height: 22px; padding: 3px; border-radius: 4px; background: rgba(255,255,255,.06); color: color-mix(in srgb, var(--widget-color) 75%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); }.schedule-month-cell.outside { opacity: .3; }.schedule-month-cell.today { box-shadow: inset 0 -2px var(--widget-accent); color: var(--widget-accent); font-weight: 800; }.schedule-month-cell.busy { background: color-mix(in srgb, var(--widget-accent) 16%, transparent); }.schedule-month-cell i { position: absolute; right: 3px; bottom: 2px; color: var(--widget-accent); font-size: calc(7px * var(--widget-font-scale, 1)); font-style: normal; }.schedule-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; height: calc(100% - 5px); margin-top: 8px; }.schedule-week-day { min-width: 0; padding: 4px; overflow: hidden; border-radius: 5px; background: rgba(255,255,255,.05); }.schedule-week-day.today { box-shadow: inset 0 -2px var(--widget-accent); }.schedule-week-day > strong { display: block; margin-bottom: 5px; color: color-mix(in srgb, var(--widget-color) 74%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); text-align: center; }.schedule-week-day.today > strong { color: var(--widget-accent); }.schedule-week-day > span { display: block; overflow: hidden; margin-top: 3px; padding: 3px 3px 3px 5px; border-left: 2px solid; border-radius: 2px; background: rgba(255,255,255,.08); font-size: calc(8px * var(--widget-font-scale, 1)); text-overflow: ellipsis; white-space: nowrap; }.schedule-week-day > small, .schedule-more { display: block; margin-top: 4px; color: color-mix(in srgb, var(--widget-color) 55%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); }.schedule-day { margin-top: 8px; }.schedule-day-row { display: grid; grid-template-columns: 55px 4px minmax(0, 1fr); gap: 7px; align-items: center; min-height: 28px; border-bottom: 1px solid color-mix(in srgb, var(--widget-color) 12%, transparent); }.schedule-day-row time { color: color-mix(in srgb, var(--widget-color) 65%, transparent); font-size: calc(8px * var(--widget-font-scale, 1)); }.schedule-day-row > span { width: 4px; height: 18px; border-radius: 2px; }.schedule-day-row strong { overflow: hidden; font-size: calc(10px * var(--widget-font-scale, 1)); text-overflow: ellipsis; white-space: nowrap; }
.widget-empty {
  margin-top: 22px;
  color: color-mix(in srgb, var(--widget-color) 68%, transparent);
  font-size: calc(13px * var(--widget-font-scale, 1));
  line-height: 1.6;
}
.memo-list {
  height: calc(100% - 42px);
  margin-top: 9px;
  padding-right: 3px;
  overflow-y: auto;
  -webkit-app-region: no-drag;
}
.memo-item {
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--widget-color) 15%, transparent);
}
.memo-item:first-child { padding-top: 2px; }
.memo-item p {
  margin-top: 3px;
  font-size: calc(13px * var(--widget-font-scale, 1));
  font-weight: 700;
  line-height: 1.4;
  user-select: text;
}
.memo-item small,
.memo-kind {
  color: color-mix(in srgb, var(--widget-color) 64%, transparent);
  font-size: calc(9.5px * var(--widget-font-scale, 1));
  line-height: 1.45;
}
.memo-item small { display: block; margin-top: 3px; }
.widget-memo-attachments { margin-top: 6px; }
.memo-quick {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 5px;
  margin-top: 8px;
  -webkit-app-region: no-drag;
}
.memo-quick input {
  min-width: 0;
  flex: 1;
  height: 31px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  outline: 0;
  background: rgba(0, 0, 0, 0.28);
  color: inherit;
  font: inherit;
  font-size: calc(11px * var(--widget-font-scale, 1));
}
.memo-quick button {
  width: 31px;
  border: 0;
  border-radius: 6px;
  background: var(--widget-accent);
  color: #17201c;
}
@container (max-height: 195px) {
  .desktop-widget-card {
    padding: 14px;
  }
  .lesson-main small {
    display: none;
  }
  .lesson-list {
    gap: 5px;
  }
  .lesson-row {
    min-height: 36px;
    padding: 5px 7px;
  }
  .lesson-row:nth-child(n + 3) {
    display: none;
  }
  .timetable-week-row:nth-child(n + 6), .schedule-month-cell:nth-child(n + 29) { display: none; }
  .schedule-week-day > span:nth-of-type(n + 3) { display: none; }
  .memo-item { padding: 6px 0; }
}
</style>
