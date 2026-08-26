<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import DesktopWidgetCard, { type WidgetLessonItem } from '@/components/widgets/DesktopWidgetCard.vue'
import WidgetAppearanceEditor from '@/components/widgets/WidgetAppearanceEditor.vue'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { useTimetableStore } from '@/stores/timetable'
import { clone } from '@/lib/persist'
import { useCountdownStore } from '@/stores/countdowns'
import { useSchedulesStore } from '@/stores/schedules'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { useTodoStore } from '@/stores/todos'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { PET_CATS, usePetCompanionStore } from '@/stores/petCompanion'
import { buildTimetableWidgetWeekRows } from '@/lib/timetableWidget'
import type { DesktopWidgetConfig, DesktopWidgetKind } from '@/types'

const widgets = useDesktopWidgetsStore()
const countdowns = useCountdownStore()
const schedules = useSchedulesStore()
const timetable = useTimetableStore()
const todos = useTodoStore()
const ui = useUiStore()
const settings = useSettingsStore()
const pet = usePetCompanionStore()
const { remainingLessons } = useTimetableStatus()

const showCreate = ref(false)
const showEdit = ref(false)
const creating = reactive({ kind: 'countdown' as DesktopWidgetKind, sourceId: '' })
const editing = ref<DesktopWidgetConfig | null>(null)
const editingOriginal = ref<DesktopWidgetConfig | null>(null)
const section = ref<'widgets' | 'pet'>('widgets')

const memoOptions = computed(() => todos.items.filter((item) => !item.done && item.kind !== 'task'))
const todayLessons = computed<WidgetLessonItem[]>(() => {
  return remainingLessons.value.map((lesson) => ({
    ...lesson,
    start: lesson.period.start,
    end: lesson.period.end
  }))
})
const timetableWeekRows = computed(() => buildTimetableWidgetWeekRows(timetable.periods, timetable.lessons))
const currentWeekday = computed(() => new Date().getDay() || 7)

function countdownFor(config: DesktopWidgetConfig) {
  return countdowns.items.find((item) => item.id === config.sourceId) ?? null
}
function kindLabel(kind: DesktopWidgetKind): string {
  return kind === 'countdown' ? '倒数日' : kind === 'timetable' ? '课表' : kind === 'schedules' ? '日程管理' : '备忘录'
}
function sizeLabel(size: DesktopWidgetConfig['size']): string {
  return size === 'small' ? '小尺寸' : size === 'large' ? '大尺寸' : '中尺寸'
}
function openCreate(kind: DesktopWidgetKind): void {
  creating.kind = kind
  creating.sourceId = kind === 'countdown' ? countdowns.items[0]?.id ?? '' : ''
  showCreate.value = true
}
function create(): void {
  if (creating.kind === 'countdown' && !creating.sourceId) return
  const item = widgets.add(creating.kind, creating.sourceId)
  showCreate.value = false
  openEdit(item)
}
function openEdit(config: DesktopWidgetConfig): void {
  editingOriginal.value = clone(config)
  editing.value = clone(config)
  showEdit.value = true
}
function updateEditing(value: DesktopWidgetConfig): void {
  editing.value = value
  widgets.update(value)
}
function cancelEdit(): void {
  if (editingOriginal.value) widgets.update(editingOriginal.value)
  showEdit.value = false
  editing.value = null
  editingOriginal.value = null
}
function saveEdit(): void {
  if (!editing.value) return
  showEdit.value = false
  editing.value = null
  editingOriginal.value = null
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

function savePetWidgetSettings(): void {
  void settings.save()
}

function previewPetWidget(): void {
  void window.api.petWidget.sync(true)
  ui.success('桌面小猫已显示，可拖到顺手的位置')
}

function chooseCat(id: string): void {
  if (pet.buyAndUse('cat', id)) return
  ui.info('伴学金币还差一点，完成番茄后再来接它回家')
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
      <div v-if="section === 'widgets'" class="create-actions">
        <button class="btn btn-secondary btn-sm" @click="openCreate('countdown')"><AppIcon name="hourglass" :size="14" />倒数日</button>
        <button class="btn btn-secondary btn-sm" @click="openCreate('timetable')"><AppIcon name="calendar" :size="14" />课表</button>
        <button class="btn btn-secondary btn-sm" @click="openCreate('schedules')"><AppIcon name="calendar" :size="14" />日程</button>
        <button class="btn btn-secondary btn-sm" @click="openCreate('memo')"><AppIcon name="note" :size="14" />备忘录</button>
      </div>
    </header>

    <nav class="widget-subnav" aria-label="桌面摆件分类">
      <button :class="{ active: section === 'widgets' }" @click="section = 'widgets'">
        <AppIcon name="monitor" :size="15" />信息摆件
      </button>
      <button :class="{ active: section === 'pet' }" @click="section = 'pet'">
        <AppIcon name="sparkle" :size="15" />桌面小猫
      </button>
    </nav>

    <template v-if="section === 'widgets'">
    <div v-if="widgets.items.length" class="widget-list">
      <article v-for="config in widgets.items" :key="config.id" class="widget-row">
        <div class="preview-wrap" :class="`preview-${config.size}`">
          <DesktopWidgetCard :config="config" :countdown="countdownFor(config)" :lessons="todayLessons" :timetable-week-rows="timetableWeekRows" :schedule-items="schedules.items" :weekday="currentWeekday" :memos="memoOptions" preview />
        </div>
        <div class="widget-info">
          <span class="kind-label">{{ kindLabel(config.kind) }}</span>
          <h3>{{ config.title || countdownFor(config)?.title || (config.kind === 'timetable' ? '今天的课程' : config.kind === 'schedules' ? '日程管理' : config.kind === 'memo' ? '备忘与灵感' : '未命名摆件') }}</h3>
          <p>{{ sizeLabel(config.size) }} · {{ config.locked ? '已锁定并穿透鼠标' : '可拖动' }} · 桌面普通层级</p>
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
    </template>

    <section v-else class="pet-widget-settings">
      <div class="pet-widget-preview">
        <div class="preview-bubble">
          <strong>一起专注</strong>
          <span>25:00</span>
        </div>
        <PetSpriteAnimation class="pet-preview-animation" animation="writing" :cat-id="pet.catId" label="桌面小猫预览" />
        <span>{{ pet.selectedCat.name }}</span>
      </div>
      <div class="pet-widget-controls">
        <div class="pet-setting-head">
          <div>
            <p class="eyebrow">置顶陪伴挂件</p>
            <h3>桌面小猫</h3>
            <p>独立透明窗口，不固定到桌面层；普通窗口切换时保持在最上方，全屏专注时自动隐藏。</p>
          </div>
          <button class="btn btn-secondary btn-sm" @click="previewPetWidget">
            <AppIcon name="play" :size="14" />立即预览
          </button>
        </div>

        <div class="pet-toggle-list">
          <div class="setting-row">
            <div><p class="s-title">启用桌面小猫</p><p class="s-sub">允许按番茄和课表状态自动出现</p></div>
            <label class="switch"><input v-model="settings.s.petWidget.enabled" type="checkbox" @change="savePetWidgetSettings" /><span class="slider" /></label>
          </div>
          <div class="setting-row">
            <div><p class="s-title">番茄期间出现</p><p class="s-sub">只在未开启全屏锁屏的工作番茄中显示</p></div>
            <label class="switch"><input v-model="settings.s.petWidget.duringPomodoro" type="checkbox" :disabled="!settings.s.petWidget.enabled" @change="savePetWidgetSettings" /><span class="slider" /></label>
          </div>
          <div class="setting-row">
            <div><p class="s-title">上课期间出现</p><p class="s-sub">按课表时间自动出现，下课后自动收起</p></div>
            <label class="switch"><input v-model="settings.s.petWidget.duringClass" type="checkbox" :disabled="!settings.s.petWidget.enabled" @change="savePetWidgetSettings" /><span class="slider" /></label>
          </div>
        </div>

        <div class="pet-choice-block">
          <h4>挂件小猫</h4>
          <div class="pet-choice-grid">
            <button
              v-for="cat in PET_CATS"
              :key="cat.id"
              class="pet-choice"
              :class="{ selected: pet.catId === cat.id }"
              :disabled="!pet.unlockedCats.includes(cat.id) && pet.coins < cat.cost"
              @click="chooseCat(cat.id)"
            >
              <PetSpriteAnimation class="pet-choice-animation" animation="idle" :cat-id="cat.id" />
              <span><strong>{{ cat.name }}</strong><small v-if="pet.unlockedCats.includes(cat.id)">{{ pet.catId === cat.id ? '使用中' : '已拥有' }}</small><small v-else>{{ cat.cost }} 金币</small></span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <AppModal v-if="showCreate" title="新建桌面摆件" @close="showCreate = false">
      <div class="create-form">
        <div class="kind-segment">
          <button v-for="kind in (['countdown', 'timetable', 'schedules', 'memo'] as DesktopWidgetKind[])" :key="kind" :class="{ active: creating.kind === kind }" @click="openCreate(kind)">{{ kindLabel(kind) }}</button>
        </div>
        <label v-if="creating.kind === 'countdown'" class="field"><span>选择倒数日</span><select v-model="creating.sourceId" class="input select"><option value="" disabled>请选择</option><option v-for="item in countdowns.items" :key="item.id" :value="item.id">{{ item.title }} · {{ item.date }}</option></select></label>
        <p v-else-if="creating.kind === 'memo'" class="create-tip">备忘录摆件会展示全部未完成的备忘与灵感，并支持在桌面直接快捷记录。</p>
        <p v-else-if="creating.kind === 'timetable'" class="create-tip">课表摆件会自动显示今日课程或整周课程，并随课表内容更新。</p>
        <p v-else-if="creating.kind === 'schedules'" class="create-tip">日程摆件会显示月、周或日视图，并随日程管理内容更新。</p>
        <p v-else class="create-tip">备忘录摆件会展示全部未完成的备忘与灵感。</p>
        <p v-if="creating.kind === 'countdown' && !countdowns.items.length" class="create-tip">请先在倒数日页面添加一个目标日期。</p>
      </div>
      <template #footer><button class="btn btn-secondary btn-sm" @click="showCreate = false">取消</button><button class="btn btn-sm" :disabled="creating.kind === 'countdown' && !creating.sourceId" @click="create">创建并显示</button></template>
    </AppModal>

    <AppModal v-if="showEdit && editing" title="摆件外观与行为" @close="cancelEdit">
      <div class="editor-layout">
        <div class="editor-preview"><DesktopWidgetCard :config="editing" :countdown="countdownFor(editing)" :lessons="todayLessons" :timetable-week-rows="timetableWeekRows" :schedule-items="schedules.items" :weekday="currentWeekday" :memos="memoOptions" preview /></div>
        <WidgetAppearanceEditor :model-value="editing" :memos="memoOptions" @update:model-value="updateEditing" />
      </div>
      <template #footer><button class="btn btn-secondary btn-sm" @click="cancelEdit">取消</button><button class="btn btn-sm" @click="saveEdit">完成</button></template>
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
.widget-subnav { display: inline-flex; gap: 3px; margin: 14px 0 4px; padding: 3px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-muted); }
.widget-subnav button { min-height: 34px; display: inline-flex; align-items: center; gap: 6px; padding: 0 13px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); font-size: 12.5px; font-weight: 700; }
.widget-subnav button.active { background: var(--surface-raised); color: var(--accent-strong); box-shadow: 0 1px 4px rgba(20, 28, 24, 0.09); }
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
.kind-segment { display: grid; grid-template-columns: repeat(4, 1fr); padding: 3px; border-radius: 7px; background: var(--surface-muted); }
.kind-segment button { min-height: 34px; border: 0; border-radius: 5px; background: transparent; color: var(--text-secondary); }
.kind-segment button.active { background: var(--surface-raised); color: var(--accent-strong); box-shadow: 0 1px 5px rgba(20, 28, 24, 0.1); }
.field { display: flex; flex-direction: column; gap: 7px; }
.field span { color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.create-tip { padding: 12px; border-left: 3px solid var(--accent); background: var(--surface-muted); color: var(--text-secondary); font-size: 12.5px; line-height: 1.55; }
.editor-layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 20px; align-items: start; }
.editor-preview { position: sticky; top: 0; width: 290px; height: 210px; }
.pet-widget-settings { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 32px; padding: 28px 4px; align-items: start; }
.pet-widget-preview { position: sticky; top: 0; height: 350px; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-muted); box-shadow: inset 0 -70px 70px rgba(67, 101, 84, 0.08); }
.pet-preview-animation { position: absolute; left: 28px; bottom: 8px; width: 270px; height: 270px; }
.pet-widget-preview > span { position: absolute; right: 12px; bottom: 12px; padding: 4px 7px; border-radius: 6px; background: rgba(37, 51, 45, 0.72); color: white; font-size: 10px; font-weight: 720; }
.preview-bubble { position: absolute; z-index: 2; top: 18px; left: 18px; display: flex; flex-direction: column; min-width: 126px; padding: 9px 12px; border: 1px solid var(--border-strong); border-radius: 8px 8px 8px 2px; background: var(--surface-raised); box-shadow: var(--shadow-card); }
.preview-bubble strong { font-size: 11px; }
.preview-bubble span { color: var(--accent-strong); font-size: 16px; font-weight: 780; font-variant-numeric: tabular-nums; }
.pet-widget-controls { min-width: 0; }
.pet-setting-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding-bottom: 18px; border-bottom: 1px solid var(--separator); }
.pet-setting-head h3 { margin-top: 2px; font-size: 21px; }
.pet-setting-head p:last-child { max-width: 560px; margin-top: 6px; color: var(--text-secondary); font-size: 12.5px; line-height: 1.55; }
.pet-toggle-list { margin-top: 4px; }
.pet-choice-block { margin-top: 20px; }
.pet-choice-block h4 { margin-bottom: 10px; font-size: 13px; }
.pet-choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pet-choice { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 7px; min-height: 72px; padding: 7px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-card); color: var(--text-primary); text-align: left; }
.pet-choice.selected { border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong)); box-shadow: inset 3px 0 var(--accent); }
.pet-choice:disabled { opacity: 0.48; cursor: not-allowed; }
.pet-choice-animation { width: 58px; height: 58px; }
.pet-choice span, .pet-choice strong, .pet-choice small { display: block; min-width: 0; }
.pet-choice strong { font-size: 12px; }
.pet-choice small { margin-top: 3px; color: var(--text-tertiary); font-size: 10px; }
@media (max-width: 900px) { .widget-row { grid-template-columns: 250px minmax(0, 1fr); } .row-actions { grid-column: 2; } .preview-wrap { width: 250px; } }
@media (max-width: 900px) { .pet-widget-settings { grid-template-columns: 260px minmax(0, 1fr); } .pet-preview-animation { width: 230px; } .pet-choice-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .widgets-head, .widget-row, .pet-setting-head { display: flex; flex-direction: column; align-items: stretch; } .create-actions { justify-content: flex-start; } .preview-wrap, .preview-small, .preview-large { width: 100%; } .editor-layout, .pet-widget-settings { grid-template-columns: 1fr; } .editor-preview, .pet-widget-preview { position: static; width: 100%; } }
</style>
