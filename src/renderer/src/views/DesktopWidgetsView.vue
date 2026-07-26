<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import DesktopWidgetCard, { type WidgetLessonItem } from '@/components/widgets/DesktopWidgetCard.vue'
import WidgetAppearanceEditor from '@/components/widgets/WidgetAppearanceEditor.vue'
import { useCountdownStore } from '@/stores/countdowns'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useTimetableStore } from '@/stores/timetable'
import { useTodoStore } from '@/stores/todos'
import { useUiStore } from '@/stores/ui'
import type { DesktopWidgetConfig, DesktopWidgetKind } from '@/types'

const widgets = useDesktopWidgetsStore()
const countdowns = useCountdownStore()
const timetable = useTimetableStore()
const todos = useTodoStore()
const ui = useUiStore()

const showCreate = ref(false)
const showEdit = ref(false)
const creating = reactive({ kind: 'countdown' as DesktopWidgetKind, sourceId: '' })
const editing = ref<DesktopWidgetConfig | null>(null)

const memoOptions = computed(() => todos.items.filter((item) => !item.done && item.kind !== 'task'))
const periodMap = computed(() => new Map(timetable.periods.map((period) => [period.id, period])))
const todayLessons = computed<WidgetLessonItem[]>(() => {
  const day = new Date().getDay() || 7
  return timetable.lessons
    .filter((lesson) => lesson.day === day && periodMap.value.has(lesson.periodId))
    .map((lesson) => {
      const period = periodMap.value.get(lesson.periodId)!
      return { ...lesson, start: period.start, end: period.end }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
})

function countdownFor(config: DesktopWidgetConfig) {
  return countdowns.items.find((item) => item.id === config.sourceId) ?? null
}
function memoFor(config: DesktopWidgetConfig) {
  return todos.items.find((item) => item.id === config.sourceId) ?? null
}
function kindLabel(kind: DesktopWidgetKind): string {
  return kind === 'countdown' ? '倒数日' : kind === 'timetable' ? '今日课表' : '备忘录'
}
function sizeLabel(size: DesktopWidgetConfig['size']): string {
  return size === 'small' ? '小尺寸' : size === 'large' ? '大尺寸' : '中尺寸'
}
function openCreate(kind: DesktopWidgetKind): void {
  creating.kind = kind
  creating.sourceId = kind === 'countdown' ? countdowns.items[0]?.id ?? '' : kind === 'memo' ? memoOptions.value[0]?.id ?? '' : 'today'
  showCreate.value = true
}
function create(): void {
  if (creating.kind !== 'timetable' && !creating.sourceId) return
  const item = widgets.add(creating.kind, creating.sourceId)
  showCreate.value = false
  openEdit(item)
}
function openEdit(config: DesktopWidgetConfig): void {
  editing.value = structuredClone(config)
  showEdit.value = true
}
function saveEdit(): void {
  if (!editing.value) return
  widgets.update(editing.value)
  showEdit.value = false
  ui.success('摆件设置已应用')
}
async function remove(config: DesktopWidgetConfig): Promise<void> {
  const ok = await ui.confirm({ title: '移除这个桌面摆件？', message: '摆件窗口会立即关闭，原始倒数日、课表或备忘录数据不会删除。', confirmText: '移除', danger: true })
  if (!ok) return
  widgets.remove(config.id)
}
function toggle(config: DesktopWidgetConfig): void {
  widgets.setEnabled(config.id, !config.enabled)
}
</script>

<template>
  <div class="page widgets-page">
    <header class="widgets-head">
      <div>
        <p class="eyebrow">桌面摆件</p>
        <h2>把重要信息固定在桌面，需要时一眼看到</h2>
        <p>摆件可独立设置图片、字体、尺寸和透明度；锁定后不会被误拖动或缩放。</p>
      </div>
      <div class="create-actions">
        <button class="btn btn-secondary btn-sm" @click="openCreate('countdown')"><AppIcon name="hourglass" :size="14" />倒数日</button>
        <button class="btn btn-secondary btn-sm" @click="openCreate('timetable')"><AppIcon name="calendar" :size="14" />课表</button>
        <button class="btn btn-secondary btn-sm" @click="openCreate('memo')"><AppIcon name="note" :size="14" />备忘录</button>
      </div>
    </header>

    <div v-if="widgets.items.length" class="widget-list">
      <article v-for="config in widgets.items" :key="config.id" class="widget-row">
        <div class="preview-wrap" :class="`preview-${config.size}`">
          <DesktopWidgetCard :config="config" :countdown="countdownFor(config)" :lessons="todayLessons" :memo="memoFor(config)" preview />
        </div>
        <div class="widget-info">
          <span class="kind-label">{{ kindLabel(config.kind) }}</span>
          <h3>{{ config.title || countdownFor(config)?.title || memoFor(config)?.text || (config.kind === 'timetable' ? '今天的课程' : '未命名摆件') }}</h3>
          <p>{{ sizeLabel(config.size) }} · {{ config.locked ? '已锁定' : '可拖动' }} · {{ config.alwaysOnTop ? '保持在最前' : '普通层级' }}</p>
          <div class="state-line">
            <span :class="{ on: config.enabled }">{{ config.enabled ? '正在显示' : '已隐藏' }}</span>
            <span v-if="config.launchOnStartup">开机启动</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="icon-action" :title="config.enabled ? '隐藏摆件' : '显示摆件'" @click="toggle(config)"><AppIcon :name="config.enabled ? 'monitor' : 'play'" :size="17" /></button>
          <button class="icon-action" title="编辑外观" @click="openEdit(config)"><AppIcon name="note" :size="17" /></button>
          <button class="icon-action danger" title="移除摆件" @click="remove(config)"><AppIcon name="x" :size="17" /></button>
        </div>
      </article>
    </div>
    <div v-else class="empty-band">
      <EmptyState icon="monitor" title="还没有桌面摆件" desc="从倒数日、今日课表或备忘录开始，创建第一张属于你的桌面卡片。">
        <button class="btn" @click="openCreate('countdown')">创建倒数日摆件</button>
      </EmptyState>
    </div>

    <AppModal v-if="showCreate" title="新建桌面摆件" @close="showCreate = false">
      <div class="create-form">
        <div class="kind-segment">
          <button v-for="kind in (['countdown', 'timetable', 'memo'] as DesktopWidgetKind[])" :key="kind" :class="{ active: creating.kind === kind }" @click="openCreate(kind)">{{ kindLabel(kind) }}</button>
        </div>
        <label v-if="creating.kind === 'countdown'" class="field"><span>选择倒数日</span><select v-model="creating.sourceId" class="input select"><option value="" disabled>请选择</option><option v-for="item in countdowns.items" :key="item.id" :value="item.id">{{ item.title }} · {{ item.date }}</option></select></label>
        <label v-else-if="creating.kind === 'memo'" class="field"><span>选择备忘录</span><select v-model="creating.sourceId" class="input select"><option value="" disabled>请选择</option><option v-for="item in memoOptions" :key="item.id" :value="item.id">{{ item.text }}</option></select></label>
        <p v-else class="create-tip">课表摆件会自动显示当天课程，并随课表内容更新。</p>
        <p v-if="creating.kind === 'countdown' && !countdowns.items.length" class="create-tip">请先在倒数日页面添加一个目标日期。</p>
        <p v-if="creating.kind === 'memo' && !memoOptions.length" class="create-tip">请先在备忘录中心添加一条备忘或灵感。</p>
      </div>
      <template #footer><button class="btn btn-secondary btn-sm" @click="showCreate = false">取消</button><button class="btn btn-sm" :disabled="creating.kind !== 'timetable' && !creating.sourceId" @click="create">创建并显示</button></template>
    </AppModal>

    <AppModal v-if="showEdit && editing" title="摆件外观与行为" @close="showEdit = false">
      <div class="editor-layout">
        <div class="editor-preview"><DesktopWidgetCard :config="editing" :countdown="countdownFor(editing)" :lessons="todayLessons" :memo="memoFor(editing)" preview /></div>
        <WidgetAppearanceEditor v-model="editing" />
      </div>
      <template #footer><button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button><button class="btn btn-sm" @click="saveEdit">应用设置</button></template>
    </AppModal>
  </div>
</template>

<style scoped>
.widgets-page { max-width: 1160px; }
.widgets-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 10px 4px 20px; border-bottom: 1px solid var(--separator); }
.widgets-head h2 { font-size: 24px; line-height: 1.25; }
.widgets-head p:last-child { max-width: 620px; margin-top: 7px; color: var(--text-secondary); font-size: 13px; }
.create-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.create-actions .btn { display: inline-flex; align-items: center; gap: 6px; }
.widget-list { display: flex; flex-direction: column; }
.widget-row { display: grid; grid-template-columns: 300px minmax(0, 1fr) auto; align-items: center; gap: 22px; padding: 22px 4px; border-bottom: 1px solid var(--separator); }
.preview-wrap { width: 300px; height: 190px; }
.preview-small { width: 250px; height: 176px; }
.preview-large { width: 320px; height: 225px; }
.widget-info { min-width: 0; }
.kind-label { color: var(--accent-strong); font-size: 11px; font-weight: 800; }
.widget-info h3 { margin-top: 5px; overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
.widget-info p { margin-top: 7px; color: var(--text-secondary); font-size: 12.5px; }
.state-line { display: flex; gap: 7px; margin-top: 12px; }
.state-line span { padding: 4px 7px; border-radius: 5px; background: var(--surface-muted); color: var(--text-tertiary); font-size: 10.5px; font-weight: 700; }
.state-line span.on { background: color-mix(in srgb, var(--status-success) 13%, transparent); color: var(--status-success); }
.row-actions { display: flex; gap: 6px; }
.icon-action { width: 36px; height: 36px; display: inline-grid; place-items: center; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--surface-raised); color: var(--text-secondary); }
.icon-action:hover { color: var(--accent-strong); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.icon-action.danger:hover { color: var(--status-danger); border-color: var(--status-danger); }
.empty-band { min-height: 440px; display: grid; place-items: center; }
.create-form { display: flex; flex-direction: column; gap: 16px; }
.kind-segment { display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border-radius: 7px; background: var(--surface-muted); }
.kind-segment button { min-height: 34px; border: 0; border-radius: 5px; background: transparent; color: var(--text-secondary); }
.kind-segment button.active { background: var(--surface-raised); color: var(--accent-strong); box-shadow: 0 1px 5px rgba(20, 28, 24, 0.1); }
.field { display: flex; flex-direction: column; gap: 7px; }
.field span { color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.create-tip { padding: 12px; border-left: 3px solid var(--accent); background: var(--surface-muted); color: var(--text-secondary); font-size: 12.5px; line-height: 1.55; }
.editor-layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 20px; align-items: start; }
.editor-preview { position: sticky; top: 0; width: 290px; height: 210px; }
@media (max-width: 900px) { .widget-row { grid-template-columns: 250px minmax(0, 1fr); } .row-actions { grid-column: 2; } .preview-wrap { width: 250px; } }
@media (max-width: 720px) { .widgets-head, .widget-row { display: flex; flex-direction: column; align-items: stretch; } .create-actions { justify-content: flex-start; } .preview-wrap, .preview-small, .preview-large { width: 100%; } .editor-layout { grid-template-columns: 1fr; } .editor-preview { position: static; width: 100%; } }
</style>
