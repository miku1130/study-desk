<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import TodoAttachmentList from '@/components/todo/TodoAttachmentList.vue'
import { useTodoStore } from '@/stores/todos'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'
import {
  PRIORITIES,
  REPEATS,
  type Priority,
  type TodoAttachment,
  type TodoItem,
  type TodoKind
} from '@/types'
import { TODO_IMAGE_FILTER, mergeTodoAttachments } from '@/lib/todoAttachments'

const todos = useTodoStore()
const pomodoro = usePomodoroStore()
const ui = useUiStore()
const router = useRouter()

type Tab = 'today' | 'plan' | 'memo' | 'all' | 'done'

const tab = ref<Tab>('today')
const query = ref('')
const tagFilter = ref('全部')
const quickText = ref('')
const quickKind = ref<TodoKind>('task')
const quickPriority = ref<Priority>(0)
const quickDue = ref('')
const quickAttachments = ref<TodoAttachment[]>([])

const tabs: { key: Tab; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'plan', label: '计划' },
  { key: 'memo', label: '备忘录' },
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' }
]

const kindOptions: { value: TodoKind; label: string; desc: string }[] = [
  { value: 'task', label: '任务', desc: '需要完成的事项' },
  { value: 'memo', label: '备忘', desc: '资料、提醒、记录' },
  { value: 'idea', label: '灵感', desc: '闪念、想法、草稿' }
]

const kindLabel: Record<TodoKind, string> = {
  task: '任务',
  memo: '备忘',
  idea: '灵感'
}

const tagOptions = computed(() => ['全部', ...todos.tags])

const counts = computed(() => ({
  today: todos.dueToday,
  plan: todos.planned,
  memo: todos.memoCount,
  all: todos.items.filter((item) => !item.done).length,
  done: todos.items.filter((item) => item.done).length
}))

function todayKey(): string {
  return todos.dateKey()
}

function tomorrowKey(): string {
  return todos.dateKey(1)
}

function nextWeekKey(): string {
  return todos.dateKey(7)
}

function sortFn(a: TodoItem, b: TodoItem): number {
  if (a.done !== b.done) return Number(a.done) - Number(b.done)
  if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
  if (b.priority !== a.priority) return b.priority - a.priority
  const aDue = a.due || '9999-99-99'
  const bDue = b.due || '9999-99-99'
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  return b.createdAt - a.createdAt
}

const filtered = computed<TodoItem[]>(() => {
  const keyword = query.value.trim().toLowerCase()
  let list = todos.items.slice()
  if (tab.value === 'done') list = list.filter((i) => i.done)
  else list = list.filter((i) => !i.done)

  if (tab.value === 'today') list = list.filter((i) => i.kind === 'task' && i.due && i.due <= todayKey())
  else if (tab.value === 'plan') list = list.filter((i) => i.kind === 'task' && !!i.due)
  else if (tab.value === 'memo') list = list.filter((i) => i.kind !== 'task')

  if (tagFilter.value !== '全部') list = list.filter((i) => i.tags.includes(tagFilter.value))
  if (keyword) {
    list = list.filter((i) =>
      [i.text, i.note, ...i.tags, ...i.subtasks.map((s) => s.text)].join(' ').toLowerCase().includes(keyword)
    )
  }
  return list.sort(tab.value === 'done' ? (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) : sortFn)
})

const pinnedItems = computed(() => (tab.value === 'done' ? [] : filtered.value.filter((i) => i.pinned)))
const restItems = computed(() => (tab.value === 'done' ? filtered.value : filtered.value.filter((i) => !i.pinned)))

/** 已完成按完成日分组 */
const doneGroups = computed(() => {
  if (tab.value !== 'done') return []
  const groups: { label: string; items: TodoItem[] }[] = []
  const map = new Map<string, TodoItem[]>()
  for (const item of filtered.value) {
    const d = item.completedAt ? new Date(item.completedAt) : new Date(item.createdAt)
    const p = (n: number): string => String(n).padStart(2, '0')
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  for (const [key, items] of map) {
    let label = key.slice(5).replace('-', ' 月 ') + ' 日'
    if (key === todayKey()) label = '今天'
    else if (key === todos.dateKey(-1)) label = '昨天'
    groups.push({ label, items })
  }
  return groups
})

function add(): void {
  if (!quickText.value.trim()) return
  const due = quickKind.value === 'task' ? quickDue.value || (tab.value === 'today' ? todayKey() : '') : ''
  todos.add(quickText.value, quickPriority.value, due, {
    kind: quickKind.value,
    attachments: quickKind.value === 'task' ? [] : quickAttachments.value
  })
  quickText.value = ''
  quickKind.value = 'task'
  quickPriority.value = 0
  quickDue.value = ''
  quickAttachments.value = []
}

const showEdit = ref(false)
const editing = reactive<TodoItem>({
  id: '',
  text: '',
  done: false,
  pomodoros: 0,
  createdAt: 0,
  priority: 0,
  due: '',
  note: '',
  repeat: 'none',
  kind: 'task',
  tags: [],
  reminderAt: '',
  reminded: false,
  pinned: false,
  estimatePomodoros: 0,
  subtasks: [],
  attachments: [],
  completedAt: undefined
})
const tagText = ref('')
const newSubtask = ref('')

function openEdit(item: TodoItem): void {
  Object.assign(editing, {
    ...item,
    tags: [...item.tags],
    subtasks: item.subtasks.map((subtask) => ({ ...subtask })),
    attachments: item.attachments.map((attachment) => ({ ...attachment }))
  })
  tagText.value = item.tags.join('，')
  newSubtask.value = ''
  showEdit.value = true
}

function saveEdit(): void {
  if (!editing.text.trim()) return
  editing.tags = tagText.value
    .split(/[，,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
  todos.update({
    ...editing,
    tags: [...editing.tags],
    subtasks: editing.subtasks.map((subtask) => ({ ...subtask })),
    attachments: editing.attachments.map((attachment) => ({ ...attachment }))
  })
  showEdit.value = false
}

async function delEdit(): Promise<void> {
  const ok = await ui.confirm({
    title: '删除这条记录？',
    message: `「${editing.text.slice(0, 24)}」将被永久删除，无法恢复。`,
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  todos.remove(editing.id)
  showEdit.value = false
  ui.info('已删除')
}

async function clearDone(): Promise<void> {
  const count = todos.items.filter((i) => i.done).length
  if (!count) return
  const ok = await ui.confirm({
    title: '清除全部已完成？',
    message: `${count} 条已完成记录将被永久删除。`,
    confirmText: '清除',
    danger: true
  })
  if (!ok) return
  todos.clearDone()
  ui.info(`已清除 ${count} 条已完成`)
}

function addEditingSubtask(): void {
  const text = newSubtask.value.trim()
  if (!text) return
  editing.subtasks.push({ id: `${Date.now()}-${Math.random()}`, text, done: false })
  newSubtask.value = ''
}

function removeEditingSubtask(id: string): void {
  editing.subtasks = editing.subtasks.filter((subtask) => subtask.id !== id)
}

async function chooseAttachments(target: 'quick' | 'editing', imagesOnly: boolean): Promise<void> {
  const paths = await window.api.dialog.openFiles(imagesOnly ? TODO_IMAGE_FILTER : undefined)
  if (!paths.length) return
  if (target === 'quick') {
    quickAttachments.value = mergeTodoAttachments(
      quickAttachments.value,
      paths,
      imagesOnly ? 'image' : undefined
    )
    return
  }
  editing.attachments = mergeTodoAttachments(
    editing.attachments,
    paths,
    imagesOnly ? 'image' : undefined
  )
}

function removeQuickAttachment(id: string): void {
  quickAttachments.value = quickAttachments.value.filter((attachment) => attachment.id !== id)
}

function removeEditingAttachment(id: string): void {
  editing.attachments = editing.attachments.filter((attachment) => attachment.id !== id)
}

function attachmentOpenError(attachment: TodoAttachment): void {
  ui.info(`未找到附件「${attachment.name}」，请重新选择文件`)
}

function startFocus(item: TodoItem): void {
  todos.focusOn(item.id)
  if (todos.activeId === item.id) {
    ui.success(`已绑定「${item.text.slice(0, 16)}」，去开一个番茄吧`)
    router.push('/pomodoro')
  } else {
    ui.info('已解除任务绑定')
  }
}

function priColor(p: Priority): string {
  return PRIORITIES.find((x) => x.value === p)?.color ?? '#8e8e93'
}

function isOverdue(item: TodoItem): boolean {
  return !!item.due && !item.done && item.due < todayKey()
}

function dueLabel(due: string): string {
  if (!due) return ''
  if (due === todayKey()) return '今天'
  if (due === tomorrowKey()) return '明天'
  return due.slice(5)
}

function subtaskProgress(item: TodoItem): number {
  if (!item.subtasks.length) return 0
  return Math.round((item.subtasks.filter((subtask) => subtask.done).length / item.subtasks.length) * 100)
}

function formatReminder(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function reminderPending(item: TodoItem): boolean {
  if (!item.reminderAt || item.done) return false
  const at = new Date(item.reminderAt).getTime()
  return Number.isFinite(at) && at > Date.now()
}
</script>

<template>
  <div class="page memo-page">
    <section class="memo-hero">
      <div>
        <p class="eyebrow">备忘录中心</p>
        <h2>任务、备忘和灵感放在同一个工作台里推进</h2>
        <p>置顶重点、到点系统提醒、绑定番茄钟专注执行，把轻量记录变成真正可落地的学习计划。</p>
      </div>
      <div class="memo-score">
        <strong>{{ todos.remaining }}</strong>
        <span>未完成任务</span>
      </div>
      <div class="memo-score warn">
        <strong>{{ todos.overdue }}</strong>
        <span>已逾期</span>
      </div>
    </section>

    <section v-if="todos.activeItem" class="focus-banner" @click="router.push('/pomodoro')">
      <span class="focus-dot" :class="{ running: pomodoro.running }" />
      <span class="focus-text">
        正在专注：<strong>{{ todos.activeItem.text }}</strong>
        <small>已投入 {{ todos.activeItem.pomodoros }} 个番茄</small>
      </span>
      <button class="btn btn-secondary btn-sm" @click.stop="todos.focusOn(todos.activeId)">解绑</button>
    </section>

    <section class="memo-tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        class="memo-tab"
        :class="{ active: tab === item.key }"
        @click="tab = item.key"
      >
        {{ item.label }}
        <span>{{ counts[item.key] }}</span>
      </button>
    </section>

    <section v-if="tab !== 'done'" class="quick-card card">
      <input
        v-model="quickText"
        class="input quick-input"
        :placeholder="quickKind === 'task' ? '添加任务，回车确认...' : '写下一条备忘或灵感...'"
        @keyup.enter="add"
      />
      <div class="kind-switch">
        <button
          v-for="kind in kindOptions"
          :key="kind.value"
          :class="{ active: quickKind === kind.value }"
          type="button"
          @click="quickKind = kind.value"
        >
          {{ kind.label }}
        </button>
      </div>
      <select v-model.number="quickPriority" class="input input-sm select pri-sel">
        <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}优先级</option>
      </select>
      <div v-if="quickKind === 'task'" class="due-quick">
        <button type="button" :class="{ on: quickDue === todayKey() }" @click="quickDue = quickDue === todayKey() ? '' : todayKey()">今天</button>
        <button type="button" :class="{ on: quickDue === tomorrowKey() }" @click="quickDue = quickDue === tomorrowKey() ? '' : tomorrowKey()">明天</button>
        <button type="button" :class="{ on: quickDue === nextWeekKey() }" @click="quickDue = quickDue === nextWeekKey() ? '' : nextWeekKey()">下周</button>
        <input v-model="quickDue" type="date" class="input input-sm" />
      </div>
      <button class="btn" @click="add">添加</button>
      <div v-if="quickKind !== 'task'" class="quick-attachment-panel">
        <div class="attachment-actions">
          <button class="btn btn-secondary btn-sm" type="button" @click="chooseAttachments('quick', true)">
            <AppIcon name="image" :size="14" />添加图片
          </button>
          <button class="btn btn-secondary btn-sm" type="button" @click="chooseAttachments('quick', false)">
            <AppIcon name="paperclip" :size="14" />添加文件
          </button>
        </div>
        <TodoAttachmentList
          v-if="quickAttachments.length"
          :attachments="quickAttachments"
          editable
          mode="editor"
          @remove="removeQuickAttachment"
          @open-error="attachmentOpenError"
        />
      </div>
    </section>

    <section class="memo-tools">
      <input v-model="query" class="input search" placeholder="搜索内容、备注、标签、子任务..." />
      <select v-model="tagFilter" class="input input-sm select">
        <option v-for="tag in tagOptions" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <button class="btn btn-secondary btn-sm widget-entry" @click="router.push('/widgets')"><AppIcon name="monitor" :size="14" />桌面摆件</button>
      <button v-if="tab === 'done'" class="btn btn-secondary btn-sm" @click="clearDone">清除已完成</button>
    </section>

    <template v-if="filtered.length">
      <section v-if="pinnedItems.length" class="pin-block">
        <p class="block-title"><AppIcon name="pin" :size="12" />置顶</p>
        <TransitionGroup name="list" tag="div" class="memo-list">
          <article
            v-for="item in pinnedItems"
            :key="item.id"
            class="memo-item card pinned"
            :class="[`kind-${item.kind}`, { done: item.done }]"
            @click="openEdit(item)"
          >
            <button v-if="item.kind === 'task'" class="check" :class="{ on: item.done }" @click.stop="todos.toggle(item.id)">
              <svg v-if="item.done" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 8.5l3.2 3.2L13 5" />
              </svg>
            </button>
            <div v-else class="kind-mark">{{ kindLabel[item.kind].slice(0, 1) }}</div>
            <div class="memo-main">
              <div class="memo-title-row">
                <span class="kind-pill">{{ kindLabel[item.kind] }}</span>
                <h3>{{ item.text }}</h3>
                <span v-if="todos.activeId === item.id" class="active-pill">专注中</span>
              </div>
              <p v-if="item.note" class="memo-note">{{ item.note }}</p>
              <TodoAttachmentList
                v-if="item.attachments.length"
                class="memo-attachments"
                :attachments="item.attachments"
                mode="list"
                @open-error="attachmentOpenError"
              />
              <div v-if="item.subtasks.length" class="sub-progress">
                <span :style="{ width: subtaskProgress(item) + '%' }" />
              </div>
              <div class="memo-tags">
                <span v-for="tag in item.tags" :key="tag">#{{ tag }}</span>
              </div>
            </div>
            <div class="memo-side">
              <div class="hover-actions">
                <button
                  v-if="item.kind === 'task'"
                  class="mini-act"
                  :title="todos.activeId === item.id ? '解除绑定' : '绑定番茄钟开始专注'"
                  @click.stop="startFocus(item)"
                >
                  <AppIcon name="play" :size="12" />
                </button>
                <button
                  class="mini-act"
                  :class="{ on: item.pinned }"
                  :title="item.pinned ? '取消置顶' : '置顶'"
                  @click.stop="todos.togglePin(item.id)"
                >
                  <AppIcon name="pin" :size="12" />
                </button>
              </div>
              <span v-if="item.priority > 0" class="flag" :style="{ background: priColor(item.priority) }" />
              <span v-if="item.due" class="due" :class="{ over: isOverdue(item) }">{{ dueLabel(item.due) }}</span>
              <span v-if="item.reminderAt" class="reminder" :class="{ armed: reminderPending(item) }">
                <AppIcon name="bell" :size="11" />{{ formatReminder(item.reminderAt) }}
              </span>
              <span v-if="item.pomodoros || item.estimatePomodoros" class="pomodoros">
                <AppIcon name="tomato" :size="11" />{{ item.pomodoros }}{{ item.estimatePomodoros ? ` / ${item.estimatePomodoros}` : '' }}
              </span>
            </div>
          </article>
        </TransitionGroup>
      </section>

      <template v-if="tab === 'done'">
        <section v-for="group in doneGroups" :key="group.label" class="done-block">
          <p class="block-title">{{ group.label }}</p>
          <div class="memo-list">
            <article
              v-for="item in group.items"
              :key="item.id"
              class="memo-item card done"
              :class="`kind-${item.kind}`"
              @click="openEdit(item)"
            >
              <button v-if="item.kind === 'task'" class="check on" @click.stop="todos.toggle(item.id)">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 8.5l3.2 3.2L13 5" />
                </svg>
              </button>
              <div v-else class="kind-mark">{{ kindLabel[item.kind].slice(0, 1) }}</div>
              <div class="memo-main">
                <div class="memo-title-row">
                  <span class="kind-pill">{{ kindLabel[item.kind] }}</span>
                  <h3>{{ item.text }}</h3>
                </div>
                <TodoAttachmentList
                  v-if="item.attachments.length"
                  class="memo-attachments"
                  :attachments="item.attachments"
                  mode="list"
                  @open-error="attachmentOpenError"
                />
                <div class="memo-tags">
                  <span v-for="tag in item.tags" :key="tag">#{{ tag }}</span>
                </div>
              </div>
              <div class="memo-side">
                <span v-if="item.pomodoros" class="pomodoros"><AppIcon name="tomato" :size="11" />{{ item.pomodoros }}</span>
              </div>
            </article>
          </div>
        </section>
      </template>

      <TransitionGroup v-else name="list" tag="section" class="memo-list">
        <article
          v-for="item in restItems"
          :key="item.id"
          class="memo-item card"
          :class="[`kind-${item.kind}`, { done: item.done }]"
          @click="openEdit(item)"
        >
          <button v-if="item.kind === 'task'" class="check" :class="{ on: item.done }" @click.stop="todos.toggle(item.id)">
            <svg v-if="item.done" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8.5l3.2 3.2L13 5" />
            </svg>
          </button>
          <div v-else class="kind-mark">{{ kindLabel[item.kind].slice(0, 1) }}</div>
          <div class="memo-main">
            <div class="memo-title-row">
              <span class="kind-pill">{{ kindLabel[item.kind] }}</span>
              <h3>{{ item.text }}</h3>
              <span v-if="todos.activeId === item.id" class="active-pill">专注中</span>
            </div>
            <p v-if="item.note" class="memo-note">{{ item.note }}</p>
            <TodoAttachmentList
              v-if="item.attachments.length"
              class="memo-attachments"
              :attachments="item.attachments"
              mode="list"
              @open-error="attachmentOpenError"
            />
            <div v-if="item.subtasks.length" class="sub-progress">
              <span :style="{ width: subtaskProgress(item) + '%' }" />
            </div>
            <div class="memo-tags">
              <span v-for="tag in item.tags" :key="tag">#{{ tag }}</span>
            </div>
          </div>
          <div class="memo-side">
            <div class="hover-actions">
              <button
                v-if="item.kind === 'task'"
                class="mini-act"
                :title="todos.activeId === item.id ? '解除绑定' : '绑定番茄钟开始专注'"
                @click.stop="startFocus(item)"
              >
                <AppIcon name="play" :size="12" />
              </button>
              <button
                class="mini-act"
                :class="{ on: item.pinned }"
                :title="item.pinned ? '取消置顶' : '置顶'"
                @click.stop="todos.togglePin(item.id)"
              >
                <AppIcon name="pin" :size="12" />
              </button>
            </div>
            <span v-if="item.priority > 0" class="flag" :style="{ background: priColor(item.priority) }" />
            <span v-if="item.due" class="due" :class="{ over: isOverdue(item) }">{{ dueLabel(item.due) }}</span>
            <span v-if="item.reminderAt" class="reminder" :class="{ armed: reminderPending(item) }">
              <AppIcon name="bell" :size="11" />{{ formatReminder(item.reminderAt) }}
            </span>
            <span v-if="item.pomodoros || item.estimatePomodoros" class="pomodoros">
              <AppIcon name="tomato" :size="11" />{{ item.pomodoros }}{{ item.estimatePomodoros ? ` / ${item.estimatePomodoros}` : '' }}
            </span>
          </div>
        </article>
      </TransitionGroup>
    </template>
    <section v-else class="card">
      <EmptyState
        icon="note"
        :title="tab === 'done' ? '还没有已完成记录' : '这里很清爽'"
        desc="添加任务、备忘或灵感，必要时设置标签、提醒、子任务和预计番茄数。"
      />
    </section>

    <AppModal v-if="showEdit" title="编辑记录" @close="showEdit = false">
      <div class="form">
        <div class="kind-grid">
          <button
            v-for="kind in kindOptions"
            :key="kind.value"
            type="button"
            class="kind-card"
            :class="{ active: editing.kind === kind.value }"
            @click="editing.kind = kind.value"
          >
            <strong>{{ kind.label }}</strong>
            <span>{{ kind.desc }}</span>
          </button>
        </div>
        <label class="fld">
          <span>标题</span>
          <input v-model="editing.text" class="input" />
        </label>
        <label class="fld">
          <span>备注正文</span>
          <textarea v-model="editing.note" class="input" rows="4" placeholder="写下上下文、链接、摘录或行动说明..." />
        </label>
        <section v-if="editing.kind !== 'task'" class="attachment-editor">
          <div class="attachment-editor-head">
            <div>
              <span>图片与文件</span>
              <small>图片会直接展示，其他文件点击后由系统应用打开</small>
            </div>
            <div class="attachment-actions">
              <button class="btn btn-secondary btn-sm" type="button" @click="chooseAttachments('editing', true)">
                <AppIcon name="image" :size="14" />图片
              </button>
              <button class="btn btn-secondary btn-sm" type="button" @click="chooseAttachments('editing', false)">
                <AppIcon name="paperclip" :size="14" />文件
              </button>
            </div>
          </div>
          <TodoAttachmentList
            v-if="editing.attachments.length"
            :attachments="editing.attachments"
            editable
            mode="editor"
            @remove="removeEditingAttachment"
            @open-error="attachmentOpenError"
          />
          <p v-else class="attachment-empty">尚未添加附件</p>
        </section>
        <div class="fld-row">
          <label class="fld">
            <span>优先级</span>
            <select v-model.number="editing.priority" class="input select">
              <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </label>
          <label class="fld">
            <span>截止日期</span>
            <input v-model="editing.due" type="date" class="input" />
          </label>
          <label class="fld">
            <span>预计番茄</span>
            <input v-model.number="editing.estimatePomodoros" type="number" min="0" max="12" class="input" />
          </label>
        </div>
        <div class="fld-row">
          <label class="fld">
            <span>重复</span>
            <select v-model="editing.repeat" class="input select">
              <option v-for="r in REPEATS" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </label>
          <label class="fld">
            <span>提醒时间（到点系统通知）</span>
            <input v-model="editing.reminderAt" type="datetime-local" class="input" />
          </label>
        </div>
        <div class="fld-row">
          <label class="fld check-fld">
            <input v-model="editing.pinned" type="checkbox" />
            <span>置顶显示</span>
          </label>
          <p v-if="editing.pomodoros" class="pomo-fact">已投入 {{ editing.pomodoros }} 个番茄</p>
        </div>
        <label class="fld">
          <span>标签</span>
          <input v-model="tagText" class="input" placeholder="用空格或逗号分隔，如 数学 周报 灵感" />
        </label>
        <div class="subtask-editor">
          <span class="subtask-title">子任务</span>
          <div class="subtask-add">
            <input v-model="newSubtask" class="input" placeholder="添加子任务..." @keyup.enter="addEditingSubtask" />
            <button class="btn btn-secondary btn-sm" type="button" @click="addEditingSubtask">添加</button>
          </div>
          <div v-if="editing.subtasks.length" class="subtask-list">
            <label v-for="subtask in editing.subtasks" :key="subtask.id" class="subtask-row">
              <input v-model="subtask.done" type="checkbox" />
              <span>{{ subtask.text }}</span>
              <button type="button" @click.prevent="removeEditingSubtask(subtask.id)">删除</button>
            </label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-danger btn-sm" @click="delEdit">删除</button>
        <button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button>
        <button class="btn btn-sm" @click="saveEdit">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.memo-page {
  max-width: 1040px;
}
.memo-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px 140px;
  gap: 12px;
  align-items: stretch;
  margin-bottom: 14px;
}
.memo-hero > div:first-child {
  padding: 10px 4px;
}
.eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 6px;
}
.memo-hero h2 {
  font-size: 27px;
  line-height: 1.18;
}
.memo-hero p:last-child {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13.5px;
}
.memo-score {
  border: 1px solid var(--separator);
  border-radius: 16px;
  background: var(--bg-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.memo-score strong {
  font-size: 28px;
}
.memo-score span {
  color: var(--text-secondary);
  font-size: 12px;
}
.memo-score.warn strong {
  color: #ff453a;
}
.focus-banner {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid color-mix(in srgb, var(--accent) 36%, transparent);
  background: var(--accent-soft);
  border-radius: 14px;
  padding: 10px 14px;
  margin-bottom: 14px;
  cursor: pointer;
}
.focus-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}
.focus-dot.running {
  background: #30d158;
  box-shadow: 0 0 0 4px rgba(48, 209, 88, 0.22);
  animation: pulse 1.6s infinite;
}
@keyframes pulse {
  50% {
    box-shadow: 0 0 0 7px rgba(48, 209, 88, 0.08);
  }
}
.focus-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.focus-text strong {
  color: var(--text-primary);
}
.focus-text small {
  margin-left: 9px;
  color: var(--text-tertiary);
}
.memo-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.memo-tab {
  border: 1px solid var(--separator);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 12px;
  padding: 8px 13px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: all 0.15s var(--ease);
}
.memo-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.memo-tab span {
  font-size: 11px;
  opacity: 0.8;
}
.quick-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 108px auto auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  margin-bottom: 12px;
}
.quick-attachment-panel {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--separator);
}
.attachment-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.attachment-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.kind-switch {
  display: inline-flex;
  background: var(--bg-input);
  border-radius: 10px;
  padding: 3px;
}
.kind-switch button {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 8px;
  height: 28px;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 700;
}
.kind-switch button.active {
  background: var(--accent);
  color: #fff;
}
.quick-input {
  min-width: 200px;
}
.pri-sel {
  width: 108px;
}
.due-quick {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.due-quick button {
  border: 1px solid var(--separator);
  background: var(--bg-input);
  color: var(--text-secondary);
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
}
.due-quick button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.due-quick .input {
  width: 128px;
}
.memo-tools {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.search {
  flex: 1;
}
.block-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 800;
  margin: 4px 4px 8px;
}
.pin-block,
.done-block {
  margin-bottom: 14px;
}
.memo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}
.memo-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px;
  cursor: pointer;
  transition: transform 0.14s var(--ease), border-color 0.14s var(--ease);
}
.memo-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.memo-item.pinned {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: linear-gradient(135deg, var(--accent-soft), var(--bg-card));
}
.memo-item.done {
  opacity: 0.72;
}
.list-enter-active,
.list-leave-active {
  transition: opacity 0.22s var(--ease), transform 0.22s var(--ease);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(14px);
}
.list-leave-active {
  position: absolute;
  width: 100%;
}
.list-move {
  transition: transform 0.25s var(--ease);
}
.check,
.kind-mark {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.check {
  border: 1.8px solid var(--text-tertiary);
  background: transparent;
  color: #fff;
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.check.on {
  background: var(--accent);
  border-color: var(--accent);
}
.check svg {
  width: 13px;
  height: 13px;
}
.kind-mark {
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}
.memo-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.kind-pill {
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}
.active-pill {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: #30d158;
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
}
.memo-main h3 {
  font-size: 15px;
  line-height: 1.35;
  min-width: 0;
}
.memo-note {
  margin-top: 7px;
  color: var(--text-secondary);
  line-height: 1.55;
  font-size: 12.5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.memo-attachments {
  margin-top: 9px;
}
.sub-progress {
  height: 5px;
  margin-top: 10px;
  max-width: 260px;
  background: var(--active);
  border-radius: 999px;
  overflow: hidden;
}
.sub-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #30d158;
  transition: width 0.3s var(--ease);
}
.memo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}
.memo-tags span {
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
}
.memo-side {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 6px;
  min-width: 92px;
}
.hover-actions {
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}
.memo-item:hover .hover-actions {
  opacity: 1;
}
.mini-act {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid var(--separator);
  background: var(--bg-card-strong);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mini-act:hover {
  background: var(--hover);
}
.mini-act.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.flag {
  width: 32px;
  height: 4px;
  border-radius: 999px;
}
.due,
.reminder,
.pomodoros {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-secondary);
  background: var(--bg-input);
  border-radius: 999px;
  padding: 3px 8px;
  white-space: nowrap;
}
.due.over {
  background: #ff453a;
  color: #fff;
}
.reminder.armed {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.kind-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.kind-card {
  border: 1px solid var(--separator);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 11px;
  text-align: left;
}
.kind-card strong,
.kind-card span {
  display: block;
}
.kind-card span {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11.5px;
}
.kind-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.fld > span,
.subtask-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
}
.fld-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.check-fld {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.check-fld > span {
  font-size: 13px;
  color: var(--text-primary);
}
.pomo-fact {
  color: var(--text-tertiary);
  font-size: 12px;
}
.subtask-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.attachment-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--separator);
  border-radius: 8px;
  background: var(--surface-muted);
}
.attachment-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.attachment-editor-head span,
.attachment-editor-head small {
  display: block;
}
.attachment-editor-head span {
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 750;
}
.attachment-editor-head small,
.attachment-empty {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.subtask-add {
  display: flex;
  gap: 8px;
}
.subtask-add .input {
  flex: 1;
}
.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.subtask-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 9px;
  background: var(--bg-input);
}
.subtask-row span {
  flex: 1;
}
.subtask-row button {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
}
@media (max-width: 980px) {
  .memo-hero,
  .quick-card {
    grid-template-columns: 1fr;
  }
  .memo-tools,
  .memo-tabs {
    flex-wrap: wrap;
  }
  .quick-attachment-panel {
    grid-template-columns: 1fr;
  }
}
</style>
