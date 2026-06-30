import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TodoData, TodoItem } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

export const useTodoStore = defineStore('todos', () => {
  const items = ref<TodoItem[]>([])
  const loaded = ref(false)

  const remaining = computed(() => items.value.filter((i) => !i.done).length)

  async function load(): Promise<void> {
    const data = await loadStore<TodoData>('todos')
    items.value = data.items ?? []
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('todos', { items: items.value })
  }

  function add(text: string): void {
    const t = text.trim()
    if (!t) return
    items.value.unshift({ id: uid(), text: t, done: false, pomodoros: 0, createdAt: Date.now() })
    save()
  }

  function toggle(id: string): void {
    const it = items.value.find((i) => i.id === id)
    if (it) {
      it.done = !it.done
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

  return { items, loaded, remaining, load, add, toggle, remove, clearDone }
})
