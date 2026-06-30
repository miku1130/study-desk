<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import { useTodoStore } from '@/stores/todos'
import { PRIORITIES, REPEATS, type Priority, type TodoItem } from '@/types'

const todos = useTodoStore()

type Tab = 'today' | 'plan' | 'all' | 'done'
const tab = ref<Tab>('today')

function todayKey(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function tomorrowKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function sortFn(a: TodoItem, b: TodoItem): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  return (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99')
}

const counts = computed(() => {
  const tk = todayKey()
  const u = todos.items.filter((i) => !i.done)
  return {
    today: u.filter((i) => i.due && i.due <= tk).length,
    plan: u.filter((i) => !!i.due).length,
    all: u.length,
    done: todos.items.filter((i) => i.done).length
  }
})

const tabs: { key: Tab; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'plan', label: '计划' },
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' }
]

const filtered = computed<TodoItem[]>(() => {
  if (tab.value === 'done') {
    return todos.items.filter((i) => i.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  }
  const tk = todayKey()
  let list = todos.items.filter((i) => !i.done)
  if (tab.value === 'today') list = list.filter((i) => i.due && i.due <= tk)
  else if (tab.value === 'plan') list = list.filter((i) => !!i.due)
  return list.slice().sort(sortFn)
})

const text = ref('')
const quickPriority = ref<Priority>(0)
const quickDue = ref('')
function add(): void {
  if (!text.value.trim()) return
  const due = quickDue.value || (tab.value === 'today' ? todayKey() : '')
  todos.add(text.value, quickPriority.value, due)
  text.value = ''
  quickPriority.value = 0
  quickDue.value = ''
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
  repeat: 'none'
})
function openEdit(it: TodoItem): void {
  Object.assign(editing, it)
  showEdit.value = true
}
function saveEdit(): void {
  if (!editing.text.trim()) return
  todos.update({ ...editing })
  showEdit.value = false
}
function delEdit(): void {
  todos.remove(editing.id)
  showEdit.value = false
}

function priColor(p: Priority): string {
  return PRIORITIES.find((x) => x.value === p)?.color ?? '#8e8e93'
}
function isOverdue(it: TodoItem): boolean {
  return !!it.due && !it.done && it.due < todayKey()
}
function dueLabel(due: string): string {
  if (!due) return ''
  if (due === todayKey()) return '今天'
  if (due === tomorrowKey()) return '明天'
  return due.slice(5)
}
</script>

<template>
  <div class="page">
    <div class="todo-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tt-tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span class="tt-count">{{ counts[t.key] }}</span>
      </button>
    </div>

    <div v-if="tab !== 'done'" class="add-bar card">
      <input v-model="text" class="input add-input" placeholder="添加任务，回车确认…" @keyup.enter="add" />
      <select v-model.number="quickPriority" class="input input-sm select pri-sel">
        <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}优先级</option>
      </select>
      <input v-model="quickDue" type="date" class="input input-sm" />
      <button class="btn" @click="add">添加</button>
    </div>

    <div v-if="filtered.length" class="card list">
      <div
        v-for="it in filtered"
        :key="it.id"
        class="todo"
        :class="{ done: it.done }"
        @click="openEdit(it)"
      >
        <button class="check" :class="{ on: it.done }" @click.stop="todos.toggle(it.id)">
          <svg
            v-if="it.done"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 8.5l3.2 3.2L13 5" />
          </svg>
        </button>
        <span v-if="it.priority > 0" class="flag" :style="{ background: priColor(it.priority) }" />
        <span class="todo-text">{{ it.text }}</span>
        <span v-if="it.note" class="note-ico" title="有备注">✎</span>
        <span v-if="it.due" class="due" :class="{ over: isOverdue(it) }">{{ dueLabel(it.due) }}</span>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">{{ tab === 'done' ? '🎉' : '🗒️' }}</div>
        <h2>{{ tab === 'done' ? '还没有已完成任务' : '这里很清爽' }}</h2>
        <p>{{ tab === 'done' ? '完成任务后会出现在这里。' : '在上方添加任务，设置优先级与截止日期。' }}</p>
      </div>
    </div>

    <div v-if="tab !== 'done'" class="todo-foot">
      <span class="badge">{{ counts.all }} 项未完成</span>
      <button class="btn-link" @click="todos.clearDone()">清除已完成</button>
    </div>

    <AppModal v-if="showEdit" title="编辑任务" @close="showEdit = false">
      <div class="form">
        <label class="fld">
          <span>任务</span>
          <input v-model="editing.text" class="input" />
        </label>
        <label class="fld">
          <span>备注</span>
          <textarea v-model="editing.note" class="input" rows="3" placeholder="选填…" />
        </label>
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
        </div>
        <label class="fld">
          <span>重复</span>
          <select v-model="editing.repeat" class="input select">
            <option v-for="r in REPEATS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>
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
.todo-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}
.tt-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 9px;
  transition: all 0.15s var(--ease);
}
.tt-tab:hover {
  background: var(--hover);
}
.tt-tab.active {
  background: var(--accent);
  color: #fff;
}
.tt-count {
  font-size: 11.5px;
  opacity: 0.8;
  background: rgba(127, 127, 127, 0.2);
  border-radius: 100px;
  padding: 0 7px;
  min-width: 18px;
  text-align: center;
}
.tt-tab.active .tt-count {
  background: rgba(255, 255, 255, 0.25);
}

.add-bar {
  display: flex;
  gap: 10px;
  padding: 12px;
  margin-bottom: 14px;
  align-items: center;
}
.add-input {
  flex: 1;
}
.pri-sel {
  width: 110px;
}

.list {
  padding: 8px;
}
.todo {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.todo:hover {
  background: var(--hover);
}
.check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.8px solid var(--text-tertiary);
  background: transparent;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.check svg {
  width: 13px;
  height: 13px;
}
.check.on {
  background: var(--accent);
  border-color: var(--accent);
}
.flag {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
}
.todo-text {
  flex: 1;
  font-size: 14px;
}
.todo.done .todo-text {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.note-ico {
  color: var(--text-tertiary);
  font-size: 13px;
}
.due {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-input);
  border-radius: 100px;
  padding: 2px 10px;
}
.due.over {
  color: #fff;
  background: #ff453a;
}
.todo-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 4px 0;
}
.btn-link {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
}
.btn-link:hover {
  color: var(--accent);
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
</style>
