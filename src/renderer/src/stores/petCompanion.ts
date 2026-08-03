import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { loadStore, saveStore } from '@/lib/persist'
import type {
  PetActiveClass,
  PetCompanionData,
  PetFocusSource,
  PetKeepsake,
  PetKeepsakeKind
} from '@/types'
import { uid } from '@/types'

export interface PetCatalogItem {
  id: string
  name: string
  cost: number
  description: string
}

export const PET_CATS: PetCatalogItem[] = [
  { id: 'mikan', name: '米柑', cost: 0, description: '好奇又勤快，会舔爪、看书和打哈欠' },
  { id: 'cloud', name: '云朵', cost: 48, description: '慢吞吞的灰白猫，喜欢压住书页打盹' },
  { id: 'sesame', name: '芝麻', cost: 76, description: '沉稳警觉的小黑猫，总在书边认真守着' }
]

export const PET_ROOMS: PetCatalogItem[] = [
  { id: 'sunroom', name: '晨光书房', cost: 0, description: '阳光落在木桌与纸页上' },
  { id: 'rainy', name: '雨声阁楼', cost: 64, description: '窗边细雨，适合长时间阅读' },
  { id: 'moonlit', name: '月夜自习室', cost: 92, description: '灯下很静，窗外有一弯月亮' }
]

export const PET_FURNITURE: PetCatalogItem[] = [
  { id: 'oak-desk', name: '橡木矮桌', cost: 0, description: '刚好够放一本书和一杯水' },
  { id: 'floor-lamp', name: '蘑菇台灯', cost: 36, description: '把正在写的那一页照得暖暖的' },
  { id: 'book-cart', name: '三层书车', cost: 54, description: '常读的资料都放在手边' },
  { id: 'window-cushion', name: '窗边软垫', cost: 68, description: '休息时猫会蜷在这里睡一会儿' }
]

export const PET_GIFTS: PetCatalogItem[] = [
  { id: 'paper-star', name: '纸折星星', cost: 0, description: '折痕里藏着一小段专心的时间' },
  { id: 'pressed-flower', name: '压花书签', cost: 0, description: '猫从书页间挑出的春天' },
  { id: 'lucky-button', name: '幸运纽扣', cost: 0, description: '像一枚小小的完成勋章' },
  { id: 'tiny-letter', name: '口袋便笺', cost: 0, description: '上面画着歪歪扭扭的猫爪印' }
]

export const PET_TRASH: PetCatalogItem[] = [
  { id: 'paper-ball', name: '揉皱的草稿', cost: 0, description: '没关系，下一页还很干净' },
  { id: 'pencil-shavings', name: '铅笔屑', cost: 0, description: '起过笔，就不算毫无进展' },
  { id: 'empty-wrapper', name: '空糖纸', cost: 0, description: '猫把它叼到了桌脚边' }
]

const DEFAULT_DATA: PetCompanionData = {
  coins: 12,
  catId: 'mikan',
  roomId: 'sunroom',
  furnitureId: 'oak-desk',
  unlockedCats: ['mikan'],
  unlockedRooms: ['sunroom'],
  unlockedFurniture: ['oak-desk'],
  keepsakes: [],
  completedSessions: 0,
  abandonedSessions: 0,
  activeClass: null,
  settledClasses: []
}

function pick<T>(items: T[], salt: number): T {
  return items[Math.abs(salt) % items.length]
}

export const usePetCompanionStore = defineStore('petCompanion', () => {
  const coins = shallowRef(DEFAULT_DATA.coins)
  const catId = shallowRef(DEFAULT_DATA.catId)
  const roomId = shallowRef(DEFAULT_DATA.roomId)
  const furnitureId = shallowRef(DEFAULT_DATA.furnitureId)
  const unlockedCats = ref<string[]>([...DEFAULT_DATA.unlockedCats])
  const unlockedRooms = ref<string[]>([...DEFAULT_DATA.unlockedRooms])
  const unlockedFurniture = ref<string[]>([...DEFAULT_DATA.unlockedFurniture])
  const keepsakes = ref<PetKeepsake[]>([])
  const completedSessions = shallowRef(0)
  const abandonedSessions = shallowRef(0)
  const activeClass = shallowRef<PetActiveClass | null>(null)
  const settledClasses = ref<string[]>([])
  const loaded = shallowRef(false)
  const lastKeepsake = shallowRef<PetKeepsake | null>(null)

  const gifts = computed(() => keepsakes.value.filter((item) => item.kind === 'gift'))
  const trash = computed(() => keepsakes.value.filter((item) => item.kind === 'trash'))
  const selectedCat = computed(() => PET_CATS.find((item) => item.id === catId.value) ?? PET_CATS[0])
  const selectedRoom = computed(() => PET_ROOMS.find((item) => item.id === roomId.value) ?? PET_ROOMS[0])
  const selectedFurniture = computed(
    () => PET_FURNITURE.find((item) => item.id === furnitureId.value) ?? PET_FURNITURE[0]
  )

  async function load(): Promise<void> {
    const saved = (await loadStore<Partial<PetCompanionData>>('petCompanion')) ?? {}
    coins.value = Math.max(0, Number(saved.coins ?? DEFAULT_DATA.coins))
    unlockedCats.value = saved.unlockedCats?.length ? saved.unlockedCats : [...DEFAULT_DATA.unlockedCats]
    unlockedRooms.value = saved.unlockedRooms?.length ? saved.unlockedRooms : [...DEFAULT_DATA.unlockedRooms]
    unlockedFurniture.value = saved.unlockedFurniture?.length
      ? saved.unlockedFurniture
      : [...DEFAULT_DATA.unlockedFurniture]
    catId.value = unlockedCats.value.includes(saved.catId ?? '') ? saved.catId! : 'mikan'
    roomId.value = unlockedRooms.value.includes(saved.roomId ?? '') ? saved.roomId! : 'sunroom'
    furnitureId.value = unlockedFurniture.value.includes(saved.furnitureId ?? '')
      ? saved.furnitureId!
      : 'oak-desk'
    keepsakes.value = Array.isArray(saved.keepsakes) ? saved.keepsakes.slice(0, 240) : []
    completedSessions.value = Math.max(0, Number(saved.completedSessions ?? 0))
    abandonedSessions.value = Math.max(0, Number(saved.abandonedSessions ?? 0))
    activeClass.value = saved.activeClass ?? null
    settledClasses.value = Array.isArray(saved.settledClasses) ? saved.settledClasses.slice(-60) : []
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('petCompanion', {
      coins: coins.value,
      catId: catId.value,
      roomId: roomId.value,
      furnitureId: furnitureId.value,
      unlockedCats: unlockedCats.value,
      unlockedRooms: unlockedRooms.value,
      unlockedFurniture: unlockedFurniture.value,
      keepsakes: keepsakes.value.slice(0, 240),
      completedSessions: completedSessions.value,
      abandonedSessions: abandonedSessions.value,
      activeClass: activeClass.value,
      settledClasses: settledClasses.value.slice(-60)
    } satisfies PetCompanionData)
  }

  function addKeepsake(kind: PetKeepsakeKind, source: PetFocusSource): PetKeepsake {
    const pool = kind === 'gift' ? PET_GIFTS : PET_TRASH
    const spec = pick(pool, Date.now() + keepsakes.value.length * 13)
    const item: PetKeepsake = { id: uid(), itemId: spec.id, kind, source, at: Date.now() }
    keepsakes.value.unshift(item)
    keepsakes.value = keepsakes.value.slice(0, 240)
    lastKeepsake.value = item
    return item
  }

  function completeSession(source: PetFocusSource): { keepsake: PetKeepsake; coins: number } {
    const gained = source === 'class' ? 12 : 8
    coins.value += gained
    completedSessions.value += 1
    const keepsake = addKeepsake('gift', source)
    void persist()
    return { keepsake, coins: gained }
  }

  function abandonSession(source: PetFocusSource = 'pomodoro'): PetKeepsake {
    abandonedSessions.value += 1
    const keepsake = addKeepsake('trash', source)
    void persist()
    return keepsake
  }

  function buyAndUse(kind: 'cat' | 'room' | 'furniture', id: string): boolean {
    const config =
      kind === 'cat'
        ? { catalog: PET_CATS, unlocked: unlockedCats, selected: catId }
        : kind === 'room'
          ? { catalog: PET_ROOMS, unlocked: unlockedRooms, selected: roomId }
          : { catalog: PET_FURNITURE, unlocked: unlockedFurniture, selected: furnitureId }
    const item = config.catalog.find((entry) => entry.id === id)
    if (!item) return false
    if (!config.unlocked.value.includes(id)) {
      if (coins.value < item.cost) return false
      coins.value -= item.cost
      config.unlocked.value.push(id)
    }
    config.selected.value = id
    void persist()
    return true
  }

  function beginClass(next: PetActiveClass): void {
    if (settledClasses.value.includes(next.id) || activeClass.value?.id === next.id) return
    activeClass.value = next
    void persist()
  }

  function settleActiveClass(now = Date.now()): ReturnType<typeof completeSession> | null {
    const current = activeClass.value
    if (!current || current.endAt > now || settledClasses.value.includes(current.id)) return null
    settledClasses.value.push(current.id)
    activeClass.value = null
    const result = completeSession('class')
    void persist()
    return result
  }

  return {
    coins,
    catId,
    roomId,
    furnitureId,
    unlockedCats,
    unlockedRooms,
    unlockedFurniture,
    keepsakes,
    completedSessions,
    abandonedSessions,
    activeClass,
    loaded,
    lastKeepsake,
    gifts,
    trash,
    selectedCat,
    selectedRoom,
    selectedFurniture,
    load,
    completeSession,
    abandonSession,
    buyAndUse,
    beginClass,
    settleActiveClass
  }
})
