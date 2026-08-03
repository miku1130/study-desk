import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Priority,
  RepeatMode,
  TodoAttachment,
  TodoData,
  TodoItem,
  TodoKind,
  TodoSubtask
} from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'
import { attachmentKind, fileNameFromPath } from '@/lib/todoAttachments'

function dateKey(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 12)
}

function normalizeSubtasks(value: unknown): TodoSubtask[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.text === 'string' && x.text.trim())
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : uid(),
      text: String(x.text).trim(),
      done: Boolean(x.done)
    }))
}

function normalizeAttachments(value: unknown): TodoAttachment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => item as Record<string, unknown>)
    .filter((item) => typeof item.path === 'string' && item.path.trim())
    .map((item) => {
      const path = String(item.path).trim()
      const kind = item.kind === 'image' || item.kind === 'file' ? item.kind : attachmentKind(path)
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        kind,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : fileNameFromPath(path),
        path,
        addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now()
      }
    })
    .slice(0, 20)
}

function normalizeKind(value: unknown): TodoKind {
  if (value === 'memo' || value === 'idea' || value === 'task') return value
  return 'task'
}

function normalizeRepeat(value: unknown): RepeatMode {
  return value === 'daily' || value === 'weekly' ? value : 'none'
}

function normalizePriority(value: unknown): Priority {
  const n = Number(value ?? 0)
  if (n === 1 || n === 2 || n === 3) return n
  return 0
}

function normalizeItem(raw: Record<string, unknown>): TodoItem {
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    text: typeof raw.text === 'string' ? raw.text : '',
    done: Boolean(raw.done),
    pomodoros: typeof raw.pomodoros === 'number' ? raw.pomodoros : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    priority: normalizePriority(raw.priority),
    due: typeof raw.due === 'string' ? raw.due : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    repeat: normalizeRepeat(raw.repeat),
    kind: normalizeKind(raw.kind),
    tags: normalizeTags(raw.tags),
    reminderAt: typeof raw.reminderAt === 'string' ? raw.reminderAt : '',
    reminded: Boolean(raw.reminded),
    pinned: Boolean(raw.pinned),
    estimatePomodoros: Math.max(0, Math.min(12, Number(raw.estimatePomodoros ?? 0) || 0)),
    subtasks: normalizeSubtasks(raw.subtasks),
    attachments: normalizeAttachments(raw.attachments),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : undefined
  }
}

interface AddTodoOptions {
  kind?: TodoKind
  note?: string
  tags?: string[]
  reminderAt?: string
  estimatePomodoros?: number
  subtasks?: TodoSubtask[]
  attachments?: TodoAttachment[]
  repeat?: RepeatMode
}

export const useTodoStore = defineStore('todos', () => {
  const items = ref<TodoItem[]>([])
  const activeId = ref('')
  const loaded = ref(false)

  const remaining = computed(() => items.value.filter((i) => !i.done && i.kind === 'task').length)
  const memoCount = computed(() => items.value.filter((i) => i.kind !== 'task').length)
  const overdue = computed(() => items.value.filter((i) => !i.done && i.due && i.due < dateKey()).length)
  const dueToday = computed(() => items.value.filter((i) => !i.done && i.due && i.due <= dateKey()).length)
  const planned = computed(() => items.value.filter((i) => !i.done && !!i.due).length)
  const tags = computed(() => {
    const set = new Set<string>()
    for (const item of items.value) for (const tag of item.tags) set.add(tag)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })
  const activeItem = computed(() => items.value.find((i) => i.id === activeId.value && !i.done) ?? null)

  async function load(): Promise<void> {
    const data = await loadStore<TodoData>('todos')
    const raw = (data.items ?? []) as unknown as Array<Record<string, unknown>>
    items.value = raw.map(normalizeItem).filter((x) => x.text.trim())
    activeId.value = typeof data.activeId === 'string' ? data.activeId : ''
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('todos', { items: items.value, activeId: activeId.value })
  }

  function add(text: string, priority: Priority = 0, due = '', options: AddTodoOptions = {}): string {
    const t = text.trim()
    if (!t) return ''
    const item: TodoItem = {
      id: uid(),
      text: t,
      done: false,
      pomodoros: 0,
      createdAt: Date.now(),
      priority,
      due,
      note: options.note ?? '',
      repeat: options.repeat ?? 'none',
      kind: options.kind ?? 'task',
      tags: (options.tags ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 12),
      reminderAt: options.reminderAt ?? '',
      reminded: false,
      pinned: false,
      estimatePomodoros: Math.max(0, Math.min(12, Number(options.estimatePomodoros ?? 0) || 0)),
      subtasks: options.subtasks ?? [],
      attachments: normalizeAttachments(options.attachments)
    }
    items.value.unshift(item)
    void save()
    return item.id
  }

  function update(patch: TodoItem): void {
    const i = items.value.findIndex((x) => x.id === patch.id)
    if (i < 0) return
    const next = normalizeItem({ ...patch })
    // 修改提醒时间后重置已提醒标记，让新时间能再次触发
    if (next.reminderAt !== items.value[i].reminderAt) next.reminded = false
    items.value[i] = next
    void save()
  }

  function toggle(id: string): void {
    const it = items.value.find((i) => i.id === id)
    if (!it) return
    it.done = !it.done
    it.completedAt = it.done ? Date.now() : undefined
    if (it.done && activeId.value === it.id) activeId.value = ''
    if (it.done && it.kind === 'task' && it.repeat !== 'none') createNextRepeat(it)
    void save()
  }

  function togglePin(id: string): void {
    const it = items.value.find((i) => i.id === id)
    if (!it) return
    it.pinned = !it.pinned
    void save()
  }

  /** 绑定任务到番茄钟；再次对同一任务调用则解绑 */
  function focusOn(id: string): void {
    activeId.value = activeId.value === id ? '' : id
    void save()
  }

  /** 番茄完成时累计到当前绑定任务 */
  function addPomodoroToActive(): void {
    const it = items.value.find((i) => i.id === activeId.value)
    if (!it || it.done) return
    it.pomodoros += 1
    void save()
  }

  function createNextRepeat(it: TodoItem): void {
    const base = it.due ? new Date(`${it.due}T00:00:00`) : new Date()
    base.setDate(base.getDate() + (it.repeat === 'weekly' ? 7 : 1))
    const p = (n: number): string => String(n).padStart(2, '0')
    const nextDue = `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}`
    items.value.unshift({
      ...it,
      id: uid(),
      done: false,
      createdAt: Date.now(),
      due: nextDue,
      completedAt: undefined,
      subtasks: it.subtasks.map((s) => ({ ...s, id: uid(), done: false }))
    })
  }

  function remove(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
    if (activeId.value === id) activeId.value = ''
    void save()
  }

  function clearDone(): void {
    items.value = items.value.filter((i) => !i.done)
    void save()
  }

  function addSubtask(id: string, text: string): void {
    const it = items.value.find((i) => i.id === id)
    const t = text.trim()
    if (!it || !t) return
    it.subtasks.push({ id: uid(), text: t, done: false })
    void save()
  }

  function toggleSubtask(id: string, subId: string): void {
    const it = items.value.find((i) => i.id === id)
    const sub = it?.subtasks.find((s) => s.id === subId)
    if (!sub) return
    sub.done = !sub.done
    void save()
  }

  function removeSubtask(id: string, subId: string): void {
    const it = items.value.find((i) => i.id === id)
    if (!it) return
    it.subtasks = it.subtasks.filter((s) => s.id !== subId)
    void save()
  }

  function pinToToday(id: string): void {
    const it = items.value.find((i) => i.id === id)
    if (!it) return
    it.due = dateKey()
    void save()
  }

  return {
    items,
    activeId,
    loaded,
    remaining,
    memoCount,
    overdue,
    dueToday,
    planned,
    tags,
    activeItem,
    load,
    save,
    add,
    update,
    toggle,
    togglePin,
    focusOn,
    addPomodoroToActive,
    remove,
    clearDone,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    pinToToday,
    dateKey
  }
})
