<script setup lang="ts">
import { computed, reactive, ref, shallowRef, type CSSProperties } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useTimetableStore } from '@/stores/timetable'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useUiStore } from '@/stores/ui'
import { useClock } from '@/composables/useClock'
import {
  formatDuration,
  formatHour,
  getPeriodPosition,
  getTimelineBounds,
  timeToMinutes,
  TIMETABLE_HOUR_HEIGHT
} from '@/lib/timetableLayout'
import { WEEKDAYS, LESSON_COLORS, uid, type Lesson, type Period, type TimetableData } from '@/types'

const tt = useTimetableStore()
const widgets = useDesktopWidgetsStore()
const ui = useUiStore()
const router = useRouter()
const { now } = useClock()

const weekday = computed(() => (now.value.getDay() === 0 ? 7 : now.value.getDay()))
const nowMin = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
function isCurrent(day: number, p: Period): boolean {
  return (
    day === weekday.value &&
    nowMin.value >= timeToMinutes(p.start) &&
    nowMin.value < timeToMinutes(p.end)
  )
}

const lessonMap = computed(() => {
  const m: Record<string, Lesson> = {}
  for (const l of tt.lessons) m[`${l.day}-${l.periodId}`] = l
  return m
})
const timeline = computed(() => getTimelineBounds(tt.periods))
const gridStyle = { gridTemplateColumns: '92px repeat(7, minmax(0, 1fr))' }
const timelineStyle = computed<CSSProperties>(() => ({
  height: `${timeline.value.hours.length * TIMETABLE_HOUR_HEIGHT}px`
}))
const positionedPeriods = computed(() =>
  [...tt.periods]
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    .map((period) => {
      const position = getPeriodPosition(period, timeline.value)
      return {
        period,
        durationMinutes: position.durationMinutes,
        timeLabel: `${period.start}–${period.end}`,
        durationLabel: formatDuration(position.durationMinutes),
        style: { top: position.top, height: position.height } satisfies CSSProperties
      }
    })
    .filter(({ durationMinutes }) => durationMinutes > 0)
)
const timetableDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const day = index + 1
    return {
      day,
      slots: positionedPeriods.value.map((slot) => {
        const lesson = lessonMap.value[`${day}-${slot.period.id}`] ?? null
        return {
          ...slot,
          lesson,
          detailLabel: lesson ? [lesson.teacher, lesson.location].filter(Boolean).join(' · ') : ''
        }
      })
    }
  })
)

/* 课程编辑 */
const showLesson = shallowRef(false)
const isEdit = shallowRef(false)
const editing = reactive<Lesson>({
  id: '',
  day: 1,
  periodId: '',
  name: '',
  teacher: '',
  location: '',
  color: LESSON_COLORS[0]
})

function openCell(day: number, p: Period): void {
  const ex = tt.lessonAt(day, p.id)
  if (ex) {
    Object.assign(editing, ex)
    isEdit.value = true
  } else {
    Object.assign(editing, {
      id: uid(),
      day,
      periodId: p.id,
      name: '',
      teacher: '',
      location: '',
      color: LESSON_COLORS[(day - 1) % LESSON_COLORS.length]
    })
    isEdit.value = false
  }
  showLesson.value = true
}
function saveLesson(): void {
  if (!editing.name.trim()) return
  tt.upsertLesson({ ...editing })
  showLesson.value = false
}
function deleteLesson(): void {
  tt.removeLesson(editing.id)
  showLesson.value = false
}

/* 作息编辑 */
const showPeriods = shallowRef(false)
const draftPeriods = ref<Period[]>([])
function openPeriods(): void {
  draftPeriods.value = JSON.parse(JSON.stringify(tt.periods))
  showPeriods.value = true
}
function addPeriod(): void {
  draftPeriods.value.push({
    id: uid(),
    name: `第 ${draftPeriods.value.length + 1} 节`,
    start: '08:00',
    end: '08:45'
  })
}
function removePeriod(i: number): void {
  draftPeriods.value.splice(i, 1)
}
function savePeriods(): void {
  tt.setPeriods(draftPeriods.value)
  showPeriods.value = false
}

/* 导入导出 */
async function doExport(): Promise<void> {
  await window.api.timetable.export()
}
async function doImport(): Promise<void> {
  const data = (await window.api.timetable.import()) as TimetableData | null
  if (data) tt.replaceAll(data)
}
function addTimetableWidget(): void {
  const existing = widgets.items.find((item) => item.kind === 'timetable')
  if (existing) widgets.setEnabled(existing.id, true)
  else widgets.add('timetable', 'today', '今天的课程')
  ui.success(existing ? '课表摆件已显示' : '今日课表已添加到桌面')
}
</script>

<template>
  <div class="page wide">
    <div class="tt-toolbar">
      <button class="btn btn-secondary btn-sm widget-button" @click="addTimetableWidget"><AppIcon name="monitor" :size="14" />添加到桌面</button>
      <button class="btn btn-secondary btn-sm" @click="openPeriods">编辑作息</button>
      <span class="spacer" />
      <button class="btn btn-secondary btn-sm" @click="doImport">导入</button>
      <button class="btn btn-secondary btn-sm" @click="doExport">导出</button>
      <button class="btn btn-secondary btn-sm" @click="router.push('/widgets')">管理摆件</button>
    </div>

    <div class="tt-grid card">
      <div class="tt-grid-head" :style="gridStyle">
        <div class="tt-corner" />
        <div
          v-for="(w, i) in WEEKDAYS"
          :key="w"
          class="tt-head"
          :class="{ today: i + 1 === weekday }"
        >
          {{ w }}
        </div>
      </div>

      <div class="tt-grid-body" :style="[gridStyle, timelineStyle]">
        <div class="tt-time-axis">
          <div v-for="hour in timeline.hours" :key="hour" class="tt-time-label">
            {{ formatHour(hour) }}
          </div>
        </div>

        <div
          v-for="day in timetableDays"
          :key="day.day"
          class="tt-day"
          :class="{ today: day.day === weekday }"
        >
          <div class="tt-hour-grid" aria-hidden="true">
            <div v-for="hour in timeline.hours" :key="hour" class="tt-hour-cell" />
          </div>

          <button
            v-for="slot in day.slots"
            :key="slot.period.id"
            class="tt-slot"
            :class="{
              'has-lesson': slot.lesson,
              compact: slot.durationMinutes < 40,
              micro: slot.durationMinutes < 30,
              now: isCurrent(day.day, slot.period)
            }"
            :style="[
              slot.style,
              slot.lesson ? { backgroundColor: slot.lesson.color } : undefined
            ]"
            :aria-label="`${slot.period.name} ${slot.timeLabel} ${slot.durationLabel}${slot.lesson ? ` ${slot.lesson.name}` : ' 添加课程'}`"
            :title="slot.lesson ? `${slot.lesson.name}\n${slot.timeLabel} · ${slot.durationLabel}${slot.detailLabel ? `\n${slot.detailLabel}` : ''}` : `${slot.period.name}\n${slot.timeLabel} · ${slot.durationLabel}`"
            @click="openCell(day.day, slot.period)"
          >
            <template v-if="slot.lesson">
              <span class="lesson-name">{{ slot.lesson.name }}</span>
              <span v-if="slot.durationMinutes >= 30" class="lesson-meta">
                <span>{{ slot.timeLabel }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ slot.durationLabel }}</span>
              </span>
              <span v-if="slot.detailLabel && slot.durationMinutes >= 40" class="lesson-detail">
                {{ slot.detailLabel }}
              </span>
            </template>
            <span v-else class="tt-add">+</span>
          </button>
        </div>
      </div>
    </div>

    <AppModal
      v-if="showLesson"
      :title="isEdit ? '编辑课程' : '添加课程'"
      @close="showLesson = false"
    >
      <div class="form">
        <label class="fld">
          <span>课程名称</span>
          <input v-model="editing.name" class="input" placeholder="如 高等数学" />
        </label>
        <div class="fld-row">
          <label class="fld">
            <span>教师</span>
            <input v-model="editing.teacher" class="input" placeholder="选填" />
          </label>
          <label class="fld">
            <span>地点</span>
            <input v-model="editing.location" class="input" placeholder="选填" />
          </label>
        </div>
        <div class="fld">
          <span>颜色</span>
          <div class="colors">
            <button
              v-for="c in LESSON_COLORS"
              :key="c"
              class="cdot"
              :class="{ on: editing.color === c }"
              :style="{ background: c }"
              :aria-label="c"
              @click="editing.color = c"
            />
          </div>
        </div>
        <div class="fld-row">
          <label class="fld">
            <span>星期</span>
            <select v-model.number="editing.day" class="input select">
              <option v-for="(w, i) in WEEKDAYS" :key="w" :value="i + 1">{{ w }}</option>
            </select>
          </label>
          <label class="fld">
            <span>节次（时间）</span>
            <select v-model="editing.periodId" class="input select">
              <option v-for="p in tt.periods" :key="p.id" :value="p.id">
                {{ p.name }}（{{ p.start }}-{{ p.end }}）
              </option>
            </select>
          </label>
        </div>
        <p class="fld-hint">提示：节次时间在右上角「编辑作息」中自定义。</p>
      </div>
      <template #footer>
        <button v-if="isEdit" class="btn btn-danger btn-sm" @click="deleteLesson">删除</button>
        <button class="btn btn-secondary btn-sm" @click="showLesson = false">取消</button>
        <button class="btn btn-sm" @click="saveLesson">保存</button>
      </template>
    </AppModal>

    <AppModal v-if="showPeriods" title="编辑作息时间" @close="showPeriods = false">
      <div class="periods">
        <div v-for="(p, i) in draftPeriods" :key="p.id" class="prow">
          <input v-model="p.name" class="input input-sm pname" />
          <input v-model="p.start" class="input input-sm" type="time" />
          <span class="dash">-</span>
          <input v-model="p.end" class="input input-sm" type="time" />
          <button class="btn-icon" aria-label="删除" @click="removePeriod(i)">✕</button>
        </div>
        <button class="btn btn-secondary btn-sm add-p" @click="addPeriod">+ 添加一节</button>
      </div>
      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="showPeriods = false">取消</button>
        <button class="btn btn-sm" @click="savePeriods">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.wide {
  max-width: 1100px;
}
.tt-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.spacer {
  flex: 1;
}
.tt-grid {
  padding: 14px;
  overflow-x: auto;
}
.tt-grid-head,
.tt-grid-body {
  display: grid;
  column-gap: 6px;
  min-width: 820px;
}
.tt-grid-head {
  margin-bottom: 6px;
}
.tt-corner {
  height: 34px;
}
.tt-head {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-radius: 8px;
}
.tt-head.today {
  background: var(--accent-soft);
  color: var(--accent);
}
.tt-time-axis,
.tt-day,
.tt-hour-grid {
  height: 100%;
}
.tt-time-axis,
.tt-hour-grid {
  display: grid;
  grid-auto-rows: 72px;
}
.tt-time-label {
  display: flex;
  align-items: flex-start;
  padding: 7px 8px 0;
  font-size: 12px;
  line-height: 1;
  color: var(--text-tertiary);
  border-top: 1px solid var(--separator);
}
.tt-day {
  position: relative;
  min-width: 0;
  border-radius: 10px;
  overflow: hidden;
}
.tt-hour-grid {
  position: absolute;
  inset: 0;
}
.tt-hour-cell {
  background: var(--bg-input);
  border-top: 1px solid var(--separator);
}
.tt-day.today .tt-hour-cell {
  background: color-mix(in srgb, var(--accent-soft) 30%, var(--bg-input));
}
.tt-slot {
  position: absolute;
  z-index: 1;
  left: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: 0;
  padding: 6px 8px;
  overflow: hidden;
  color: var(--text-tertiary);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s var(--ease),
    border-color 0.15s var(--ease);
}
.tt-slot:hover {
  background: var(--hover);
  border-color: var(--separator);
}
.tt-slot.has-lesson {
  justify-content: flex-start;
  gap: 1px;
  padding: 4px 7px;
  color: #fff;
  border-color: color-mix(in srgb, #fff 32%, transparent);
  box-shadow: 0 2px 8px rgb(37 54 48 / 10%);
}
.tt-slot.has-lesson:hover {
  filter: brightness(0.98);
}
.tt-slot.compact {
  justify-content: center;
  padding-block: 2px;
}
.tt-slot.micro {
  padding-block: 1px;
}
.tt-slot.now {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.tt-add {
  margin: auto;
  color: var(--text-tertiary);
  font-size: 18px;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}
.tt-slot:hover .tt-add {
  opacity: 1;
}
.lesson-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-meta,
.lesson-detail {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.2;
  opacity: 0.88;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-meta {
  display: flex;
  gap: 3px;
}
.lesson-detail {
  font-size: 10.5px;
  opacity: 0.82;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.fld > span {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.fld-row {
  display: flex;
  gap: 12px;
}
.fld-hint {
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.colors {
  display: flex;
  gap: 9px;
}
.cdot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px var(--separator);
}
.cdot.on {
  box-shadow: 0 0 0 2px var(--accent);
}
.periods {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.prow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pname {
  flex: 1;
}
.dash {
  color: var(--text-tertiary);
}
.add-p {
  align-self: flex-start;
  margin-top: 4px;
}
</style>
