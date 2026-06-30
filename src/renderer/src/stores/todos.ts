import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Priority, TodoData, TodoItem } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

export const useTodoStore = defineStore('todos', () => {
  const items = ref<TodoItem[]>([])
  const loaded = ref(false)

  const remaining = computed(() => items.value.filter((i) => !i.done).length)

  async function load(): Promise<void> {
    const data = await loadStore<TodoData>('todos')
    // 迁移旧数据：逐字段补齐，缺失则用默认值
    const raw = (data.items ?? []) as unknown as Array<Record<string, unknown>>
    items.value = raw.map((i) => ({
      id: typeof i.id === 'string' ? i.id : uid(),
      text: typeof i.text === 'string' ? i.text : '',
      done: Boolean(i.done),
      pomodoros: typeof i.pomodoros === 'number' ? i.pomodoros : 0,
      createdAt: typeof i.createdAt === 'number' ? i.createdAt : Date.now(),
      priority: (typeof i.priority === 'number' ? i.priority : 0) as Priority,
      due: typeof i.due === 'string' ? i.due : '',
      note: typeof i.note === 'string' ? i.note : '',
      completedAt: typeof i.completedAt === 'number' ? i.completedAt : undefined
    }))
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('todos', { items: items.value })
  }

  function add(text: string, priority: Priority = 0, due = ''): void {
    const t = text.trim()
    if (!t) return
    items.value.unshift({
      id: uid(),
      text: t,
      done: false,
      pomodoros: 0,
      createdAt: Date.now(),
      priority,
      due,
      note: ''
    })
    save()
  }

  function update(patch: TodoItem): void {
    const i = items.value.findIndex((x) => x.id === patch.id)
    if (i >= 0) items.value[i] = { ...patch }
    save()
  }

  function toggle(id: string): void {
    const it = items.value.find((i) => i.id === id)
    if (it) {
      it.done = !it.done
      it.completedAt = it.done ? Date.now() : undefined
      save()
    }
  }

  function remove(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
    save()
  }

  function clearDone(): void {
    items.value = items.value.filter((i) => !i.done)
    save()
  }

  return { items, loaded, remaining, load, add, update, toggle, remove, clearDone }
})
