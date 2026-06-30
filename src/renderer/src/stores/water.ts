import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { WaterData } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

function todayKey(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const useWaterStore = defineStore('water', () => {
  const days = ref<Record<string, number>>({})
  const cupsToday = computed(() => days.value[todayKey()] ?? 0)

  async function load(): Promise<void> {
    const data = await loadStore<WaterData>('water')
    days.value = data.days ?? {}
  }

  async function addCup(): Promise<void> {
    const k = todayKey()
    days.value[k] = (days.value[k] ?? 0) + 1
    await saveStore('water', { days: days.value })
  }

  async function removeCup(): Promise<void> {
    const k = todayKey()
    days.value[k] = Math.max(0, (days.value[k] ?? 0) - 1)
    await saveStore('water', { days: days.value })
  }

  return { days, cupsToday, load, addCup, removeCup }
})
