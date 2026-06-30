import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Countdown, CountdownData } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

function todayMidnight(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function daysLeft(date: string): number {
  if (!date) return 0
  const t = new Date(`${date}T00:00:00`).getTime()
  return Math.round((t - todayMidnight()) / 86400000)
}

export const useCountdownStore = defineStore('countdowns', () => {
  const items = ref<Countdown[]>([])
  const loaded = ref(false)

  const sorted = computed(() => [...items.value].sort((a, b) => daysLeft(a.date) - daysLeft(b.date)))
  const upcoming = computed(() => sorted.value.filter((c) => daysLeft(c.date) >= 0))
  const nearest = computed(() => upcoming.value[0] ?? null)

  async function load(): Promise<void> {
    const d = await loadStore<CountdownData>('countdowns')
    items.value = d.items ?? []
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('countdowns', { items: items.value })
  }

  function add(title: string, date: string, color: string, bg = ''): void {
    if (!title.trim() || !date) return
    items.value.push({ id: uid(), title: title.trim(), date, color, bg })
    save()
  }

  function update(c: Countdown): void {
    const i = items.value.findIndex((x) => x.id === c.id)
    if (i >= 0) items.value[i] = { ...c }
    save()
  }

  function remove(id: string): void {
    items.value = items.value.filter((x) => x.id !== id)
    save()
  }

  return { items, loaded, sorted, upcoming, nearest, load, add, update, remove }
})
