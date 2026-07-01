import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { GardenData, GardenTree } from '@/types'
import { TREE_SPECIES, uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

/** 每完成一个番茄奖励的金币数 */
export const COINS_PER_POMODORO = 5

export const useGardenStore = defineStore('garden', () => {
  const coins = ref(0)
  const trees = ref<GardenTree[]>([])
  const unlocked = ref<string[]>(['evergreen'])
  const current = ref('evergreen')
  const loaded = ref(false)

  const totalTrees = computed(() => trees.value.length)
  const currentSpecies = computed(
    () => TREE_SPECIES.find((s) => s.id === current.value) ?? TREE_SPECIES[0]
  )

  async function load(): Promise<void> {
    const d = await loadStore<Partial<GardenData>>('garden')
    coins.value = d.coins ?? 0
    trees.value = d.trees ?? []
    unlocked.value = d.unlocked && d.unlocked.length ? d.unlocked : ['evergreen']
    current.value = d.current ?? 'evergreen'
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('garden', {
      coins: coins.value,
      trees: trees.value,
      unlocked: unlocked.value,
      current: current.value
    })
  }

  /** 完成一个专注番茄：发金币 + 种下一棵当前树种 */
  function reward(): void {
    coins.value += COINS_PER_POMODORO
    trees.value.push({ id: uid(), species: current.value, at: Date.now() })
    void persist()
  }

  /** 用金币解锁新树种，解锁后自动设为当前树种 */
  function unlock(id: string): boolean {
    const sp = TREE_SPECIES.find((s) => s.id === id)
    if (!sp || unlocked.value.includes(id) || coins.value < sp.cost) return false
    coins.value -= sp.cost
    unlocked.value.push(id)
    current.value = id
    void persist()
    return true
  }

  /** 切换当前种植的树种（需已解锁） */
  function use(id: string): void {
    if (!unlocked.value.includes(id)) return
    current.value = id
    void persist()
  }

  return {
    coins,
    trees,
    unlocked,
    current,
    loaded,
    totalTrees,
    currentSpecies,
    load,
    reward,
    unlock,
    use
  }
})
