<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  dateKey,
  parseDateKey,
  reviewCountsByDate
} from '@/lib/reviewSchedule'
import type { ReviewItem as ReviewItemModel } from '@/types'

interface MonthCell {
  key: string
  day: number
  outside: boolean
  dueCount: number
  learnedCount: number
  completedCount: number
  overdue: boolean
  scheduled: boolean
}

const props = defineProps<{
  items: ReviewItemModel[]
  today: string
  selectedDate: string
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

const initialDate = parseDateKey(props.today) ?? new Date()
const cursor = shallowRef(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))

watch(
  () => props.selectedDate,
  (key) => {
    const date = parseDateKey(key)
    if (date && date.getMonth() !== cursor.value.getMonth()) {
      cursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
    }
  }
)

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
)

const dueCounts = computed(() => reviewCountsByDate(props.items))
const learnedCounts = computed(() =>
  props.items.reduce<Record<string, number>>((counts, item) => {
    counts[item.learnedOn] = (counts[item.learnedOn] ?? 0) + 1
    return counts
  }, {})
)
const completedCounts = computed(() =>
  props.items.reduce<Record<string, number>>((counts, item) => {
    for (const entry of item.reviewLog) {
      counts[entry.completedOn] = (counts[entry.completedOn] ?? 0) + 1
    }
    return counts
  }, {})
)

const monthDays = computed<MonthCell[]>(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    const dueCount = dueCounts.value[key] ?? 0
    return {
      key,
      day: date.getDate(),
      outside: date.getMonth() !== cursor.value.getMonth(),
      dueCount,
      learnedCount: learnedCounts.value[key] ?? 0,
      completedCount: completedCounts.value[key] ?? 0,
      overdue: dueCount > 0 && key < props.today,
      scheduled: dueCount > 0
    }
  })
})

function changeMonth(delta: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function jumpToToday(): void {
  const date = parseDateKey(props.today) ?? new Date()
  cursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
  emit('select', props.today)
}

function selectDate(key: string): void {
  const date = parseDateKey(key)
  if (date && date.getMonth() !== cursor.value.getMonth()) {
    cursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
  }
  emit('select', key)
}

function countLabel(cell: MonthCell): string {
  if (!cell.dueCount) return ''
  if (cell.key < props.today) return `${cell.dueCount} 项未复习`
  if (cell.key === props.today) return `${cell.dueCount} 项待复习`
  return `${cell.dueCount} 项计划`
}
</script>

<template>
  <section class="review-calendar" aria-label="复习日历">
    <header class="calendar-head">
      <div class="month-switch">
        <button type="button" class="calendar-icon" title="上个月" @click="changeMonth(-1)">
          <AppIcon name="chevron-left" :size="16" />
        </button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" class="calendar-icon" title="下个月" @click="changeMonth(1)">
          <AppIcon name="chevron-right" :size="16" />
        </button>
      </div>
      <button type="button" class="today-link" @click="jumpToToday">今天</button>
    </header>

    <div class="calendar-legend" aria-hidden="true">
      <span><i class="legend-dot todays" />待复习</span>
      <span><i class="legend-dot overdues" />未复习</span>
      <span><i class="legend-dot planned" />已排期</span>
      <span><i class="legend-dot recorded" />当天记录</span>
    </div>

    <div class="weekday-row">
      <span v-for="label in ['日', '一', '二', '三', '四', '五', '六']" :key="label">
        {{ label }}
      </span>
    </div>

    <div class="month-grid">
      <button
        v-for="cell in monthDays"
        :key="cell.key"
        type="button"
        class="day-cell"
        :class="{
          outside: cell.outside,
          selected: cell.key === selectedDate,
          today: cell.key === today,
          overdue: cell.overdue,
          scheduled: cell.scheduled,
          recorded: cell.learnedCount > 0,
          complete: !cell.dueCount && cell.completedCount > 0
        }"
        :title="countLabel(cell)"
        @click="selectDate(cell.key)"
      >
        <span class="day-number">{{ cell.day }}</span>
        <span v-if="cell.learnedCount" class="record-dot" />
        <span v-if="cell.dueCount" class="day-count">{{ cell.dueCount }} 项</span>
        <span v-else-if="cell.completedCount" class="complete-mark">
          <AppIcon name="check" :size="11" />
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.review-calendar {
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.calendar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.month-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.month-switch strong {
  min-width: 112px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 760;
  text-align: center;
  white-space: nowrap;
}

.calendar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.calendar-icon:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.today-link {
  flex-shrink: 0;
  padding: 5px 9px;
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 700;
}

.today-link:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 11px;
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.calendar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-dot.todays {
  background: var(--brand-peach);
}

.legend-dot.overdues {
  background: var(--status-danger);
}

.legend-dot.planned {
  background: var(--accent);
}

.legend-dot.recorded {
  background: var(--brand-sky);
}

.weekday-row,
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  gap: 4px;
  margin-bottom: 4px;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.month-grid {
  gap: 4px;
}

.day-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  min-height: 54px;
  padding: 7px 6px 5px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 7px;
  background: var(--surface-muted);
  color: var(--text-primary);
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease);
}

.day-cell:hover {
  border-color: var(--border-strong);
  background: var(--surface-raised);
}

.day-cell.outside {
  opacity: 0.38;
}

.day-cell.today {
  border-color: color-mix(in srgb, var(--brand-peach) 52%, transparent);
  background: color-mix(in srgb, var(--brand-peach) 8%, var(--surface-muted));
}

.day-cell.selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent);
}

.day-cell.overdue {
  background: color-mix(in srgb, var(--status-danger) 6%, var(--surface-muted));
}

.day-number {
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 680;
  line-height: 1;
}

.day-cell.today .day-number {
  color: var(--status-warning);
  font-weight: 850;
}

.record-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand-sky);
}

.day-count {
  overflow: hidden;
  max-width: 100%;
  margin-top: auto;
  padding-top: 5px;
  color: var(--accent-strong);
  font-size: 9px;
  font-weight: 780;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-cell.overdue .day-count {
  color: var(--status-danger);
}

.day-cell.today .day-count {
  color: var(--status-warning);
}

.complete-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: auto;
  border-radius: 50%;
  background: color-mix(in srgb, var(--status-success) 12%, transparent);
  color: var(--status-success);
}
</style>
