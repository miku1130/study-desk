<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import { useSchedulesStore } from '@/stores/schedules'
import { uid, type ScheduleItem } from '@/types'

const schedules = useSchedulesStore()
const cursor = shallowRef(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const selectedDate = shallowRef(formatDate(new Date()))
const showEditor = shallowRef(false)
const editingId = shallowRef('')
const draft = reactive<ScheduleItem>(emptyDraft(selectedDate.value))

function pad(value: number): string { return String(value).padStart(2, '0') }
function formatDate(date: Date): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function parseDate(value: string): Date { const [y, m, d] = value.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
function emptyDraft(date: string): ScheduleItem {
  const now = Date.now()
  return { id: uid(), date, start: '09:00', end: '10:00', title: '', location: '', note: '', color: '#4f8fd8', allDay: false, createdAt: now, updatedAt: now }
}

const monthLabel = computed(() => cursor.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }))
const monthDays = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = formatDate(date)
    return { key, day: date.getDate(), outside: date.getMonth() !== cursor.value.getMonth(), events: schedules.items.filter((item) => item.date === key) }
  })
})
const selectedEvents = computed(() => schedules.items.filter((item) => item.date === selectedDate.value).sort((a, b) => Number(a.allDay) - Number(b.allDay) || a.start.localeCompare(b.start)))
const selectedLabel = computed(() => parseDate(selectedDate.value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))

function changeMonth(delta: number): void { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1) }
function selectDate(key: string): void { selectedDate.value = key }
function openCreate(date = selectedDate.value): void {
  Object.assign(draft, emptyDraft(date)); editingId.value = ''; showEditor.value = true
}
function openEdit(item: ScheduleItem): void { Object.assign(draft, item); editingId.value = item.id; showEditor.value = true }
function save(): void {
  if (!draft.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return
  if (editingId.value) schedules.upsert({ ...draft, title: draft.title.trim() })
  else {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = draft
    schedules.add(input)
  }
  selectedDate.value = draft.date
  cursor.value = new Date(parseDate(draft.date).getFullYear(), parseDate(draft.date).getMonth(), 1)
  showEditor.value = false
}
function remove(): void { if (editingId.value) schedules.remove(editingId.value); showEditor.value = false }
async function importTemplate(): Promise<void> { const data = await window.api.schedules.import(); if (data) schedules.replaceAll(data as { items: ScheduleItem[] }) }
async function exportTemplate(): Promise<void> { await window.api.schedules.export() }
</script>

<template>
  <div class="page schedule-page">
    <header class="schedule-head">
      <div><p class="eyebrow">日程管理</p><h2>把每天要做的事放进时间轴</h2><p>按日期安排课程、会议和专注时段，也可以批量导入模板。</p></div>
      <div class="schedule-actions"><button class="btn btn-secondary btn-sm" @click="importTemplate"><AppIcon name="download" :size="14" />导入模板</button><button class="btn btn-secondary btn-sm" @click="exportTemplate"><AppIcon name="upload" :size="14" />导出模板</button><button class="btn btn-sm" @click="openCreate()"><AppIcon name="plus" :size="14" />新建日程</button></div>
    </header>
    <details class="template-guide"><summary>模板字段怎么填</summary><div class="guide-grid"><span><strong>date</strong> 日期，YYYY-MM-DD</span><span><strong>start / end</strong> 时间，HH:mm</span><span><strong>title</strong> 主题，必填</span><span><strong>location</strong> 地点，可留空</span><span><strong>note</strong> 备注，可留空</span><span><strong>color</strong> 十六进制颜色</span><span><strong>allDay</strong> 全天填写 true/false</span></div><code>{ "items": [{ "date": "2026-09-01", "start": "09:00", "end": "10:30", "title": "项目评审", "location": "会议室 A", "note": "", "color": "#4f8fd8", "allDay": false }] }</code></details>
    <div class="schedule-layout">
      <section class="calendar-panel">
        <div class="calendar-toolbar"><button class="icon-action" title="上个月" @click="changeMonth(-1)"><AppIcon name="chevron-left" :size="17" /></button><strong>{{ monthLabel }}</strong><button class="icon-action" title="下个月" @click="changeMonth(1)"><AppIcon name="chevron-right" :size="17" /></button><button class="today-btn" @click="cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); selectedDate = formatDate(new Date())">今天</button></div>
        <div class="week-labels"><span v-for="label in ['日','一','二','三','四','五','六']" :key="label">{{ label }}</span></div>
        <div class="month-grid"><button v-for="cell in monthDays" :key="cell.key" class="day-cell" :class="{ outside: cell.outside, selected: cell.key === selectedDate, today: cell.key === formatDate(new Date()) }" @click="selectDate(cell.key)"><span class="day-number">{{ cell.day }}</span><span v-for="event in cell.events.slice(0, 3)" :key="event.id" class="day-event" :style="{ '--event-color': event.color }">{{ event.title }}</span><span v-if="cell.events.length > 3" class="more-events">+{{ cell.events.length - 3 }}</span></button></div>
      </section>
      <aside class="agenda-panel"><div class="agenda-head"><div><p class="eyebrow">选中日期</p><h3>{{ selectedLabel }}</h3></div><button class="icon-action" title="在此日期新建" @click="openCreate()"><AppIcon name="plus" :size="17" /></button></div><div v-if="selectedEvents.length" class="agenda-list"><button v-for="event in selectedEvents" :key="event.id" class="agenda-item" @click="openEdit(event)"><span class="agenda-color" :style="{ background: event.color }" /><span class="agenda-main"><strong>{{ event.title }}</strong><small>{{ event.allDay ? '全天' : `${event.start} - ${event.end}` }}{{ event.location ? ` · ${event.location}` : '' }}</small><small v-if="event.note">{{ event.note }}</small></span><AppIcon name="chevron-right" :size="15" /></button></div><div v-else class="agenda-empty"><AppIcon name="calendar" :size="24" /><p>这一天还没有安排</p><button class="btn btn-secondary btn-sm" @click="openCreate()">添加第一条日程</button></div></aside>
    </div>
    <AppModal v-if="showEditor" :title="editingId ? '编辑日程' : '新建日程'" @close="showEditor = false"><div class="schedule-form"><label class="field"><span>主题</span><input v-model="draft.title" class="input" placeholder="例如：项目评审" /></label><div class="field-row"><label class="field"><span>日期</span><input v-model="draft.date" class="input" type="date" /></label><label class="field check-field"><span>全天</span><input v-model="draft.allDay" type="checkbox" /></label></div><div v-if="!draft.allDay" class="field-row"><label class="field"><span>开始</span><input v-model="draft.start" class="input" type="time" /></label><label class="field"><span>结束</span><input v-model="draft.end" class="input" type="time" /></label></div><label class="field"><span>地点</span><input v-model="draft.location" class="input" placeholder="选填" /></label><label class="field"><span>备注</span><textarea v-model="draft.note" class="input" rows="3" placeholder="补充说明、链接或准备事项" /></label><label class="field"><span>颜色</span><input v-model="draft.color" type="color" /></label></div><template #footer><button v-if="editingId" class="btn btn-danger btn-sm" @click="remove">删除</button><button class="btn btn-secondary btn-sm" @click="showEditor = false">取消</button><button class="btn btn-sm" :disabled="!draft.title.trim()" @click="save">保存</button></template></AppModal>
  </div>
</template>

<style scoped>
.schedule-page { max-width: 1180px; }
.schedule-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding:10px 4px 20px; border-bottom:1px solid var(--separator); }
.schedule-head h2 { font-size:24px; line-height:1.25; }.schedule-head p:last-child { margin-top:7px; color:var(--text-secondary); font-size:13px; }.schedule-actions { display:flex; gap:8px; flex-wrap:wrap; }
.template-guide { margin-top:12px; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:7px; background:var(--surface-muted); color:var(--text-secondary); font-size:12px; }.template-guide summary { cursor:pointer; color:var(--accent-strong); font-weight:700; }.guide-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 18px; margin-top:10px; }.guide-grid strong { color:var(--text-primary); font-family:monospace; }.template-guide code { display:block; margin-top:10px; overflow:auto; color:var(--text-tertiary); font-size:10px; white-space:pre-wrap; }
.schedule-layout { display:grid; grid-template-columns:minmax(0, 1fr) 330px; gap:18px; margin-top:18px; }.calendar-panel,.agenda-panel { border:1px solid var(--border-subtle); border-radius:8px; background:var(--surface-card); }.calendar-panel { padding:16px; }.calendar-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; }.calendar-toolbar strong { min-width:130px; text-align:center; font-size:16px; }.today-btn { margin-left:auto; padding:6px 10px; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-muted); color:var(--text-secondary); font-size:12px; }.week-labels,.month-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }.week-labels { margin-bottom:5px; color:var(--text-tertiary); font-size:11px; text-align:center; }.day-cell { min-height:88px; padding:7px; overflow:hidden; border:1px solid transparent; border-radius:6px; background:var(--surface-muted); text-align:left; }.day-cell:hover,.day-cell.selected { border-color:var(--accent); }.day-cell.outside { opacity:.48; }.day-cell.today .day-number { color:var(--accent); font-weight:800; }.day-number { display:block; margin-bottom:5px; color:var(--text-secondary); font-size:12px; }.day-event { display:block; overflow:hidden; margin-top:3px; padding:3px 5px; border-left:3px solid var(--event-color); border-radius:3px; background:var(--surface-raised); color:var(--text-primary); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }.more-events { display:block; margin-top:3px; color:var(--text-tertiary); font-size:10px; }
.agenda-panel { padding:16px; }.agenda-head { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:14px; border-bottom:1px solid var(--separator); }.agenda-head h3 { margin-top:5px; font-size:17px; }.agenda-list { display:flex; flex-direction:column; }.agenda-item { display:flex; align-items:flex-start; gap:10px; width:100%; padding:13px 2px; border:0; border-bottom:1px solid var(--separator); background:transparent; color:var(--text-primary); text-align:left; }.agenda-color { width:4px; min-height:42px; border-radius:3px; }.agenda-main { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; }.agenda-main strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }.agenda-main small { color:var(--text-secondary); font-size:11px; }.agenda-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:48px 10px; color:var(--text-tertiary); text-align:center; }.agenda-empty p { font-size:12px; }.schedule-form { display:flex; flex-direction:column; gap:13px; }.field { display:flex; flex-direction:column; gap:6px; }.field > span { color:var(--text-secondary); font-size:12px; font-weight:700; }.field-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.check-field { justify-content:flex-end; padding-bottom:8px; }.check-field input { width:18px; height:18px; }.schedule-form textarea { resize:vertical; }.schedule-form input[type='color'] { width:46px; height:30px; padding:2px; border:1px solid var(--border-subtle); border-radius:5px; background:var(--surface-muted); }
@media (max-width:900px) { .schedule-layout { grid-template-columns:1fr; } .agenda-panel { min-height:220px; } }.icon-action { width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-muted); color:var(--text-secondary); }
</style>
