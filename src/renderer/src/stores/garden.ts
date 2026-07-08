import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DailyQuest, GardenAchievement, GardenData, GardenDecor, GardenTree, QuestMetric, TreeMood } from '@/types'
import { DECOR_ITEMS, TREE_SPECIES, uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

export const COINS_PER_POMODORO = 5
export const GOLDEN_BONUS = 20
export const PLOT_COUNT = 48
/** 金树掉落概率 */
const GOLDEN_CHANCE = 0.06

export const ACHIEVEMENT_CATALOG: GardenAchievement[] = [
  { id: 'first-seed', title: '第一颗种子', desc: '完成第 1 个番茄并种下第一棵树', icon: '✦' },
  { id: 'ten-trees', title: '小小林地', desc: '累计种下 10 棵树', icon: '◆' },
  { id: 'fifty-trees', title: '成片森林', desc: '累计种下 50 棵树', icon: '❖' },
  { id: 'one-day-streak', title: '今日开张', desc: '今天至少完成一次专注', icon: '●' },
  { id: 'seven-streak', title: '七日守林人', desc: '连续 7 天完成专注', icon: '▲' },
  { id: 'collector', title: '树种收藏家', desc: '解锁 4 种不同树种', icon: '◇' },
  { id: 'deep-focus', title: '深度专注', desc: '累计专注 600 分钟', icon: '✧' },
  { id: 'golden-tree', title: '黄金之枝', desc: '幸运种下 1 棵金树', icon: '★' },
  { id: 'decorator', title: '花园设计师', desc: '摆放 3 件装饰', icon: '⬟' },
  { id: 'quest-master', title: '任务达人', desc: '累计完成 10 个每日任务', icon: '✪' }
]

interface QuestTemplate {
  id: string
  title: string
  metric: QuestMetric
  target: number
  reward: number
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'pomo-2', title: '完成 2 个番茄', metric: 'pomodoros', target: 2, reward: 8 },
  { id: 'pomo-4', title: '完成 4 个番茄', metric: 'pomodoros', target: 4, reward: 18 },
  { id: 'min-50', title: '累计专注 50 分钟', metric: 'minutes', target: 50, reward: 12 },
  { id: 'min-100', title: '累计专注 100 分钟', metric: 'minutes', target: 100, reward: 25 },
  { id: 'tree-1', title: '种下 1 棵树', metric: 'trees', target: 1, reward: 5 },
  { id: 'tree-3', title: '种下 3 棵树', metric: 'trees', target: 3, reward: 15 }
]

function dateKey(date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

/** 由日期种子确定当日 3 个任务，保证同一天刷新结果一致 */
function questsForDate(key: string): DailyQuest[] {
  let seed = 0
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const pool = [...QUEST_TEMPLATES]
  const picked: QuestTemplate[] = []
  while (picked.length < 3 && pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0
    picked.push(pool.splice(seed % pool.length, 1)[0])
  }
  return picked.map((t) => ({ ...t, progress: 0, claimed: false }))
}

function moodOf(growth: number, golden: boolean): TreeMood {
  if (golden) return 'glow'
  if (growth <= 0) return 'sprout'
  if (growth < 3) return 'growing'
  return 'mature'
}

function normalizeTree(raw: Record<string, unknown>, index: number): GardenTree {
  const golden = Boolean(raw.golden) || raw.mood === 'glow'
  const growth =
    typeof raw.growth === 'number'
      ? Math.max(0, Math.floor(raw.growth))
      : raw.mood === 'mature' || raw.mood === 'glow'
        ? 3
        : raw.mood === 'growing'
          ? 1
          : 3 // 旧数据无 growth 视为已长成
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    species: typeof raw.species === 'string' ? raw.species : 'evergreen',
    at: typeof raw.at === 'number' ? raw.at : Date.now(),
    focusMinutes: typeof raw.focusMinutes === 'number' ? raw.focusMinutes : 25,
    mood: moodOf(growth, golden),
    plot: typeof raw.plot === 'number' ? raw.plot : index % PLOT_COUNT,
    growth,
    golden
  }
}

function normalizeDecors(raw: unknown): GardenDecor[] {
  if (!Array.isArray(raw)) return []
  const kinds = new Set(DECOR_ITEMS.map((d) => d.id))
  return (raw as Array<Record<string, unknown>>)
    .filter((x) => typeof x.kind === 'string' && kinds.has(x.kind) && typeof x.plot === 'number')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : uid(),
      kind: String(x.kind),
      plot: Number(x.plot)
    }))
}

function normalizeQuests(raw: unknown, key: string): DailyQuest[] {
  const fresh = questsForDate(key)
  if (!Array.isArray(raw)) return fresh
  const byId = new Map(
    (raw as Array<Record<string, unknown>>)
      .filter((x) => typeof x.id === 'string')
      .map((x) => [String(x.id), x])
  )
  return fresh.map((q) => {
    const saved = byId.get(q.id)
    if (!saved) return q
    return {
      ...q,
      progress: Math.max(0, Number(saved.progress ?? 0) || 0),
      claimed: Boolean(saved.claimed)
    }
  })
}

function mergeAchievements(raw: unknown): GardenAchievement[] {
  const source = Array.isArray(raw) ? raw : []
  const unlocked = new Map<string, number | undefined>()
  for (const item of source as Array<Record<string, unknown>>) {
    if (typeof item.id === 'string') {
      unlocked.set(item.id, typeof item.unlockedAt === 'number' ? item.unlockedAt : Date.now())
    }
  }
  return ACHIEVEMENT_CATALOG.map((item) => ({ ...item, unlockedAt: unlocked.get(item.id) }))
}

export interface RewardResult {
  coins: number
  golden: boolean
  species: string
  plot: number
}

export const useGardenStore = defineStore('garden', () => {
  const coins = ref(0)
  const trees = ref<GardenTree[]>([])
  const unlocked = ref<string[]>(['evergreen'])
  const current = ref('evergreen')
  const streak = ref(0)
  const lastRewardDate = ref('')
  const achievements = ref<GardenAchievement[]>(ACHIEVEMENT_CATALOG.map((a) => ({ ...a })))
  const decors = ref<GardenDecor[]>([])
  const decorOwned = ref<Record<string, number>>({})
  const quests = ref<DailyQuest[]>([])
  const questsDate = ref('')
  const questsCompletedTotal = ref(0)
  const loaded = ref(false)
  /** 下一棵树的指定地块（-1 = 自动），运行期状态 */
  const nextPlot = ref(-1)
  /** 最近一次奖励结果，供视图播报 */
  const lastReward = ref<RewardResult | null>(null)

  const totalTrees = computed(() => trees.value.length)
  const totalFocusMinutes = computed(() => trees.value.reduce((sum, tree) => sum + tree.focusMinutes, 0))
  const level = computed(() => Math.floor(totalFocusMinutes.value / 120) + 1)
  const levelProgress = computed(() => Math.round(((totalFocusMinutes.value % 120) / 120) * 100))
  const currentSpecies = computed(
    () => TREE_SPECIES.find((s) => s.id === current.value) ?? TREE_SPECIES[0]
  )
  const unlockedAchievements = computed(() => achievements.value.filter((a) => a.unlockedAt))
  const todayTrees = computed(() => {
    const today = dateKey()
    return trees.value.filter((tree) => dateKey(new Date(tree.at)) === today).length
  })
  const goldenTrees = computed(() => trees.value.filter((t) => t.golden).length)

  /** 每块地的最新树（后种覆盖先种） */
  const latestByPlot = computed(() => {
    const map = new Map<number, GardenTree>()
    for (const tree of trees.value) map.set(tree.plot, tree)
    return map
  })

  const decorByPlot = computed(() => {
    const map = new Map<number, GardenDecor>()
    for (const d of decors.value) map.set(d.plot, d)
    return map
  })

  /** 树种图鉴：每种的数量与首次种下时间 */
  const collection = computed(() =>
    TREE_SPECIES.map((sp) => {
      const owned = trees.value.filter((t) => t.species === sp.id)
      return {
        species: sp,
        count: owned.length,
        firstAt: owned.length ? Math.min(...owned.map((t) => t.at)) : 0,
        unlockedSpecies: unlocked.value.includes(sp.id)
      }
    })
  )

  const claimableQuests = computed(() => quests.value.filter((q) => !q.claimed && q.progress >= q.target).length)

  async function load(): Promise<void> {
    const d = await loadStore<Partial<GardenData>>('garden')
    coins.value = d.coins ?? 0
    trees.value = ((d.trees ?? []) as unknown as Array<Record<string, unknown>>).map(normalizeTree)
    unlocked.value = d.unlocked && d.unlocked.length ? d.unlocked : ['evergreen']
    current.value = d.current && unlocked.value.includes(d.current) ? d.current : unlocked.value[0] || 'evergreen'
    streak.value = d.streak ?? 0
    lastRewardDate.value = d.lastRewardDate ?? ''
    achievements.value = mergeAchievements(d.achievements)
    decors.value = normalizeDecors(d.decors)
    decorOwned.value = typeof d.decorOwned === 'object' && d.decorOwned ? { ...d.decorOwned } : {}
    questsCompletedTotal.value = Math.max(0, Number(d.questsCompletedTotal ?? 0) || 0)
    refreshQuests(d.questsDate, d.quests)
    checkAchievements()
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('garden', {
      coins: coins.value,
      trees: trees.value,
      unlocked: unlocked.value,
      current: current.value,
      streak: streak.value,
      lastRewardDate: lastRewardDate.value,
      achievements: achievements.value,
      decors: decors.value,
      decorOwned: decorOwned.value,
      quests: quests.value,
      questsDate: questsDate.value,
      questsCompletedTotal: questsCompletedTotal.value
    })
  }

  /** 跨天时重置每日任务 */
  function refreshQuests(savedDate?: string, savedQuests?: unknown): void {
    const today = dateKey()
    if (savedDate === today) {
      quests.value = normalizeQuests(savedQuests, today)
    } else if (questsDate.value !== today) {
      quests.value = questsForDate(today)
    }
    questsDate.value = today
  }

  function bumpQuests(metric: QuestMetric, amount: number): void {
    refreshQuests()
    for (const q of quests.value) {
      if (q.metric === metric && !q.claimed) q.progress = Math.min(q.target, q.progress + amount)
    }
  }

  function claimQuest(id: string): number {
    refreshQuests()
    const q = quests.value.find((x) => x.id === id)
    if (!q || q.claimed || q.progress < q.target) return 0
    q.claimed = true
    coins.value += q.reward
    questsCompletedTotal.value += 1
    checkAchievements()
    void persist()
    return q.reward
  }

  function refreshStreak(): void {
    const today = dateKey()
    if (lastRewardDate.value === today) return
    streak.value = lastRewardDate.value === yesterdayKey() ? streak.value + 1 : 1
    lastRewardDate.value = today
  }

  function pickPlot(): number {
    const occupied = new Set<number>([...latestByPlot.value.keys(), ...decorByPlot.value.keys()])
    if (nextPlot.value >= 0 && nextPlot.value < PLOT_COUNT && !occupied.has(nextPlot.value)) {
      const chosen = nextPlot.value
      nextPlot.value = -1
      return chosen
    }
    for (let i = 0; i < PLOT_COUNT; i++) {
      if (!occupied.has(i)) return i
    }
    return trees.value.length % PLOT_COUNT
  }

  /** 完成一个番茄：浇灌已有树 + 种新树 + 金币 + 任务进度 */
  function reward(focusMinutes = 25): void {
    refreshStreak()
    refreshQuests()
    // 浇灌：所有未长成的树 growth +1
    for (const tree of trees.value) {
      if (!tree.golden && tree.growth < 3) {
        tree.growth += 1
        tree.mood = moodOf(tree.growth, tree.golden)
      }
    }
    const golden = Math.random() < GOLDEN_CHANCE
    const streakBonus = Math.min(5, Math.max(0, streak.value - 1))
    const gained = COINS_PER_POMODORO + streakBonus + (golden ? GOLDEN_BONUS : 0)
    coins.value += gained
    const plot = pickPlot()
    trees.value.push({
      id: uid(),
      species: current.value,
      at: Date.now(),
      focusMinutes,
      mood: golden ? 'glow' : 'sprout',
      plot,
      growth: 0,
      golden
    })
    bumpQuests('pomodoros', 1)
    bumpQuests('minutes', focusMinutes)
    bumpQuests('trees', 1)
    lastReward.value = { coins: gained, golden, species: current.value, plot }
    checkAchievements()
    void persist()
  }

  function unlock(id: string): boolean {
    const sp = TREE_SPECIES.find((s) => s.id === id)
    if (!sp || unlocked.value.includes(id) || coins.value < sp.cost) return false
    coins.value -= sp.cost
    unlocked.value.push(id)
    current.value = id
    checkAchievements()
    void persist()
    return true
  }

  function use(id: string): void {
    if (!unlocked.value.includes(id)) return
    current.value = id
    void persist()
  }

  function buyDecor(kind: string): boolean {
    const spec = DECOR_ITEMS.find((d) => d.id === kind)
    if (!spec || coins.value < spec.cost) return false
    coins.value -= spec.cost
    decorOwned.value[kind] = (decorOwned.value[kind] ?? 0) + 1
    void persist()
    return true
  }

  /** 把库存装饰摆到空地块 */
  function placeDecor(kind: string, plot: number): boolean {
    if ((decorOwned.value[kind] ?? 0) <= 0) return false
    if (plot < 0 || plot >= PLOT_COUNT) return false
    if (latestByPlot.value.has(plot) || decorByPlot.value.has(plot)) return false
    decorOwned.value[kind] -= 1
    decors.value.push({ id: uid(), kind, plot })
    checkAchievements()
    void persist()
    return true
  }

  /** 收回装饰到库存 */
  function pickUpDecor(id: string): void {
    const d = decors.value.find((x) => x.id === id)
    if (!d) return
    decorOwned.value[d.kind] = (decorOwned.value[d.kind] ?? 0) + 1
    decors.value = decors.value.filter((x) => x.id !== id)
    void persist()
  }

  function unlockAchievement(id: string): void {
    const item = achievements.value.find((a) => a.id === id)
    if (item && !item.unlockedAt) item.unlockedAt = Date.now()
  }

  function checkAchievements(): void {
    if (trees.value.length >= 1) unlockAchievement('first-seed')
    if (trees.value.length >= 10) unlockAchievement('ten-trees')
    if (trees.value.length >= 50) unlockAchievement('fifty-trees')
    if (todayTrees.value >= 1) unlockAchievement('one-day-streak')
    if (streak.value >= 7) unlockAchievement('seven-streak')
    if (unlocked.value.length >= 4) unlockAchievement('collector')
    if (totalFocusMinutes.value >= 600) unlockAchievement('deep-focus')
    if (goldenTrees.value >= 1) unlockAchievement('golden-tree')
    if (decors.value.length >= 3) unlockAchievement('decorator')
    if (questsCompletedTotal.value >= 10) unlockAchievement('quest-master')
  }

  return {
    coins,
    trees,
    unlocked,
    current,
    streak,
    lastRewardDate,
    achievements,
    decors,
    decorOwned,
    quests,
    questsDate,
    questsCompletedTotal,
    loaded,
    nextPlot,
    lastReward,
    totalTrees,
    totalFocusMinutes,
    level,
    levelProgress,
    currentSpecies,
    unlockedAchievements,
    todayTrees,
    goldenTrees,
    latestByPlot,
    decorByPlot,
    collection,
    claimableQuests,
    load,
    refreshQuests,
    claimQuest,
    reward,
    unlock,
    use,
    buyDecor,
    placeDecor,
    pickUpDecor
  }
})
