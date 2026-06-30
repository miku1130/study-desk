import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DayStat, StatsData } from '@/types'
import { loadStore } from '@/lib/persist'

export const useStatsStore = defineStore('stats', () => {
  const days = ref<Record<string, DayStat>>({})

  async function load(): Promise<void> {
    const data = await loadStore<StatsData>('stats')
    days.value = data.days ?? {}
  }

  return { days, load }
})
