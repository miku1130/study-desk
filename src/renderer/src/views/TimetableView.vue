<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import { useTimetableStore } from '@/stores/timetable'
import { useClock } from '@/composables/useClock'
import { WEEKDAYS, LESSON_COLORS, uid, type Lesson, type Period, type TimetableData } from '@/types'

const tt = useTimetableStore()
const { now } = useClock()

const weekday = computed(() => (now.value.getDay() === 0 ? 7 : now.value.getDay()))
const nowMin = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
const toMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
function isCurrent(day: number, p: Period): boolean {
  return day === weekday.value && nowMin.value >= toMin(p.start) && nowMin.value < toMin(p.end)
}

const lessonMap = computed(() => {
  const m: Record<string, Lesson> = {}
  for (const l of tt.lessons) m[`${l.day}-${l.periodId}`] = l
  return m
})
const grid = computed(() =>
  tt.periods.map((p) => ({
    period: p,
    cells: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      lesson: lessonMap.value[`${i + 1}-${p.id}`] ?? null
    }))
  }))
)
const gridStyle = computed(() => ({ gridTemplateColumns: '92px repeat(7, minmax(0, 1fr))' }))

/* 课程编辑 */
const showLesson = ref(false)
const isEdit = ref(false)
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
const showPeriods = ref(false)
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
</script>

<template>
  <div class="page wide">
    <div class="tt-toolbar">
      <button class="btn btn-secondary btn-sm" @click="openPeriods">编辑作息</button>
      <span class="spacer" />
      <button class="btn btn-secondary btn-sm" @click="doImport">导入</button>
      <button class="btn btn-secondary btn-sm" @click="doExport">导出</button>
    </div>

    <div class="tt-grid card" :style="gridStyle">
      <div class="tt-corner" />
      <div v-for="(w, i) in WEEKDAYS" :key="w" class="tt-head" :class="{ today: i + 1 === weekday }">
        {{ w }}
      </div>

      <template v-for="row in grid" :key="row.period.id">
        <div class="tt-period">
          <span>{{ row.period.name }}</span>
          <small>{{ row.period.start }}</small>
        </div>
        <div
          v-for="cell in row.cells"
          :key="cell.day"
          class="tt-cell"
          :class="{ now: isCurrent(cell.day, row.period) }"
          @click="openCell(cell.day, row.period)"
        >
          <div v-if="cell.lesson" class="lesson" :style="{ background: cell.lesson.color }">
            <span class="lesson-name">{{ cell.lesson.name }}</span>
            <span v-if="cell.lesson.location" class="lesson-loc">{{ cell.lesson.location }}</span>
          </div>
          <span v-else class="tt-add">+</span>
        </div>
      </template>
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
  display: grid;
  gap: 6px;
  padding: 14px;
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
.tt-period {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  min-height: 64px;
}
.tt-period small {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}
.tt-cell {
  min-height: 64px;
  border-radius: 9px;
  background: var(--bg-input);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  cursor: pointer;
  transition: background 0.15s var(--ease);
  overflow: hidden;
}
.tt-cell:hover {
  background: var(--hover);
}
.tt-cell.now {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.tt-add {
  margin: auto;
  color: var(--text-tertiary);
  font-size: 18px;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}
.tt-cell:hover .tt-add {
  opacity: 1;
}
.lesson {
  flex: 1;
  padding: 8px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-radius: 9px;
}
.lesson-name {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
}
.lesson-loc {
  font-size: 11px;
  opacity: 0.85;
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
