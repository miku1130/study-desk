<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGardenStore, COINS_PER_POMODORO, PLOT_COUNT } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { DECOR_ITEMS, TREE_SPECIES, type GardenDecor, type GardenTree } from '@/types'

const garden = useGardenStore()
const ui = useUiStore()
const router = useRouter()

// 跨天后进入页面时刷新每日任务（不依赖重启）
onMounted(() => {
  if (garden.loaded) garden.refreshQuests()
})

type ShopTab = 'species' | 'decor'
const shopTab = ref<ShopTab>('species')
/** 摆放模式：待摆放的装饰 kind */
const placingKind = ref('')

interface PlotCell {
  index: number
  tree: GardenTree | null
  decor: GardenDecor | null
}

const plots = computed<PlotCell[]>(() =>
  Array.from({ length: PLOT_COUNT }, (_, index) => ({
    index,
    tree: garden.latestByPlot.get(index) ?? null,
    decor: garden.decorByPlot.get(index) ?? null
  }))
)

const recentTrees = computed(() => [...garden.trees].reverse().slice(0, 12))

function speciesOf(id: string) {
  return TREE_SPECIES.find((item) => item.id === id) ?? TREE_SPECIES[0]
}

function decorOf(kind: string) {
  return DECOR_ITEMS.find((item) => item.id === kind) ?? DECOR_ITEMS[0]
}

function moodClass(tree: GardenTree): string {
  return `mood-${tree.mood}`
}

function treeEmoji(tree: GardenTree): string {
  if (tree.mood === 'sprout') return '🌱'
  return speciesOf(tree.species).emoji
}

function plotTitle(cell: PlotCell): string {
  if (cell.tree) {
    const stage =
      cell.tree.mood === 'sprout'
        ? '幼苗'
        : cell.tree.mood === 'growing'
          ? '成长中'
          : cell.tree.golden
            ? '金树'
            : '已长成'
    return `${speciesOf(cell.tree.species).name} · ${stage} · ${formatTime(cell.tree.at)}`
  }
  if (cell.decor) return `${decorOf(cell.decor.kind).name}（点击收回）`
  if (garden.nextPlot === cell.index) return '下一棵树将种在这里'
  return placingKind.value ? '点击摆放装饰' : '空地块（点击指定下一棵树的位置）'
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function onPlotClick(cell: PlotCell): void {
  // 摆放模式优先
  if (placingKind.value) {
    if (cell.tree || cell.decor) {
      ui.error('这块地已被占用，换一块空地吧')
      return
    }
    if (garden.placeDecor(placingKind.value, cell.index)) {
      ui.success(`${decorOf(placingKind.value).name}已摆放`)
      if ((garden.decorOwned[placingKind.value] ?? 0) <= 0) placingKind.value = ''
    }
    return
  }
  if (cell.decor) {
    garden.pickUpDecor(cell.decor.id)
    ui.info(`${decorOf(cell.decor.kind).name}已收回到库存`)
    return
  }
  if (cell.tree) return
  // 指定/取消下一棵树位置
  garden.nextPlot = garden.nextPlot === cell.index ? -1 : cell.index
  if (garden.nextPlot >= 0) ui.info('已指定下一棵树的位置')
}

function unlockSpecies(id: string): void {
  const sp = speciesOf(id)
  if (garden.unlock(id)) ui.success(`已解锁${sp.name} ${sp.emoji}，自动切换为当前树种`)
}

function buyDecor(kind: string): void {
  const spec = decorOf(kind)
  if (garden.buyDecor(kind)) {
    ui.success(`已购买${spec.name} ${spec.emoji}，点击空地块摆放`)
    placingKind.value = kind
  }
}

function startPlacing(kind: string): void {
  placingKind.value = placingKind.value === kind ? '' : kind
}

function claim(id: string): void {
  const got = garden.claimQuest(id)
  if (got > 0) ui.success(`任务完成，金币 +${got}`)
}

function startFocus(): void {
  router.push('/pomodoro')
}
</script>

<template>
  <div class="page garden-page">
    <section class="garden-hero">
      <div class="garden-copy">
        <p class="eyebrow">专注花园</p>
        <h2>每一次番茄都会落成一块真实成长的学习地景</h2>
        <p>
          新树以幼苗落地，被后续的专注浇灌长大；完成每日任务攒金币，解锁树种、购买装饰，把花园布置成自己的样子。
        </p>
        <div class="hero-actions">
          <button class="btn" @click="startFocus">开始专注</button>
          <span>每个番茄 +{{ COINS_PER_POMODORO }} 金币 · 连续专注有加成 · 小概率种出金树</span>
        </div>
      </div>
      <div class="level-card card">
        <span class="level-label">当前等级</span>
        <strong>Lv.{{ garden.level }}</strong>
        <div class="level-bar"><span :style="{ width: garden.levelProgress + '%' }" /></div>
        <p>{{ garden.totalFocusMinutes }} 分钟累计专注 · 连续 {{ garden.streak }} 天</p>
      </div>
    </section>

    <section class="garden-stats">
      <div class="metric">
        <span>金币</span>
        <strong>{{ garden.coins }}</strong>
      </div>
      <div class="metric">
        <span>总树木</span>
        <strong>{{ garden.totalTrees }}</strong>
      </div>
      <div class="metric">
        <span>金树</span>
        <strong>{{ garden.goldenTrees }}</strong>
      </div>
      <div class="metric">
        <span>今日种下</span>
        <strong>{{ garden.todayTrees }}</strong>
      </div>
      <div class="metric">
        <span>已获成就</span>
        <strong>{{ garden.unlockedAchievements.length }}/{{ garden.achievements.length }}</strong>
      </div>
    </section>

    <section class="quest-card card">
      <div class="section-head compact">
        <div>
          <h3>每日任务</h3>
          <p>每天 0 点刷新，完成后手动领取金币奖励。</p>
        </div>
        <span v-if="garden.claimableQuests" class="claim-hint">{{ garden.claimableQuests }} 个可领取</span>
      </div>
      <div class="quest-list">
        <article v-for="q in garden.quests" :key="q.id" class="quest" :class="{ done: q.claimed }">
          <div class="quest-info">
            <strong>{{ q.title }}</strong>
            <div class="quest-bar">
              <span :style="{ width: Math.min(100, (q.progress / q.target) * 100) + '%' }" />
            </div>
            <small>{{ Math.min(q.progress, q.target) }} / {{ q.target }}</small>
          </div>
          <button
            v-if="!q.claimed"
            class="btn btn-sm"
            :disabled="q.progress < q.target"
            @click="claim(q.id)"
          >
            {{ q.progress >= q.target ? `领 ${q.reward} 金币` : `+${q.reward}` }}
          </button>
          <span v-else class="quest-done">已领取 ✓</span>
        </article>
      </div>
    </section>

    <div class="garden-layout">
      <section class="forest-card card">
        <div class="section-head">
          <div>
            <h3>{{ PLOT_COUNT }} 块专注地块</h3>
            <p>
              点击空地块指定下一棵树的位置；点击装饰可收回。幼苗 🌱 会随后续专注长成大树。
            </p>
          </div>
          <span class="current-species">{{ garden.currentSpecies.emoji }} {{ garden.currentSpecies.name }}</span>
        </div>
        <p v-if="placingKind" class="placing-tip">
          正在摆放 {{ decorOf(placingKind).emoji }} {{ decorOf(placingKind).name }}，点击空地块放置
          <button class="btn btn-secondary btn-sm" @click="placingKind = ''">取消</button>
        </p>
        <div class="plot-grid" :class="{ placing: !!placingKind }">
          <div
            v-for="cell in plots"
            :key="cell.index"
            class="plot"
            :class="[
              cell.tree ? moodClass(cell.tree) : cell.decor ? 'decor' : 'empty',
              { marked: garden.nextPlot === cell.index, golden: cell.tree?.golden }
            ]"
            :title="plotTitle(cell)"
            @click="onPlotClick(cell)"
          >
            <span v-if="cell.tree" class="plot-emoji" :class="`stage-${cell.tree.mood}`">
              {{ treeEmoji(cell.tree) }}
            </span>
            <span v-else-if="cell.decor" class="plot-emoji">{{ decorOf(cell.decor.kind).emoji }}</span>
            <span v-else-if="garden.nextPlot === cell.index" class="plot-mark">✦</span>
          </div>
        </div>
      </section>

      <aside class="side-stack">
        <section class="card shop-card">
          <div class="shop-tabs">
            <button :class="{ active: shopTab === 'species' }" @click="shopTab = 'species'">树种商店</button>
            <button :class="{ active: shopTab === 'decor' }" @click="shopTab = 'decor'">装饰商店</button>
          </div>

          <div v-if="shopTab === 'species'" class="shop-list">
            <article v-for="sp in TREE_SPECIES" :key="sp.id" class="shop-item" :class="sp.rarity">
              <span class="shop-icon">{{ sp.emoji }}</span>
              <div class="shop-info">
                <strong>{{ sp.name }}</strong>
                <span>{{ sp.biome }} · {{ sp.cost === 0 ? '初始' : `${sp.cost} 金币` }}</span>
              </div>
              <button v-if="garden.current === sp.id" class="btn btn-sm" disabled>使用中</button>
              <button
                v-else-if="garden.unlocked.includes(sp.id)"
                class="btn btn-secondary btn-sm"
                @click="garden.use(sp.id)"
              >
                使用
              </button>
              <button
                v-else
                class="btn btn-secondary btn-sm"
                :disabled="garden.coins < sp.cost"
                @click="unlockSpecies(sp.id)"
              >
                {{ garden.coins < sp.cost ? `差 ${sp.cost - garden.coins}` : '解锁' }}
              </button>
            </article>
          </div>

          <div v-else class="shop-list">
            <article v-for="d in DECOR_ITEMS" :key="d.id" class="shop-item">
              <span class="shop-icon">{{ d.emoji }}</span>
              <div class="shop-info">
                <strong>{{ d.name }}<em v-if="garden.decorOwned[d.id]"> ×{{ garden.decorOwned[d.id] }}</em></strong>
                <span>{{ d.desc }} · {{ d.cost }} 金币</span>
              </div>
              <div class="shop-btns">
                <button
                  v-if="(garden.decorOwned[d.id] ?? 0) > 0"
                  class="btn btn-sm"
                  :class="{ 'btn-secondary': placingKind !== d.id }"
                  @click="startPlacing(d.id)"
                >
                  {{ placingKind === d.id ? '摆放中…' : '摆放' }}
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="garden.coins < d.cost"
                  @click="buyDecor(d.id)"
                >
                  {{ garden.coins < d.cost ? `差 ${d.cost - garden.coins}` : '购买' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="card collection-card">
          <div class="section-head compact">
            <div>
              <h3>树种图鉴</h3>
              <p>记录每种树的收集数量与初遇时间。</p>
            </div>
          </div>
          <div class="collection-grid">
            <article
              v-for="c in garden.collection"
              :key="c.species.id"
              class="col-item"
              :class="{ locked: !c.count }"
            >
              <span class="col-emoji">{{ c.count ? c.species.emoji : '❔' }}</span>
              <strong>{{ c.species.name }}</strong>
              <small v-if="c.count">×{{ c.count }} · {{ formatDate(c.firstAt) }}</small>
              <small v-else>{{ c.unlockedSpecies ? '已解锁 · 待种植' : '未解锁' }}</small>
            </article>
          </div>
        </section>
      </aside>
    </div>

    <div class="garden-bottom">
      <section class="card achievements-card">
        <div class="section-head compact">
          <div>
            <h3>成就墙</h3>
            <p>成就会随树木、连续天数、金树、装饰与任务自动点亮。</p>
          </div>
        </div>
        <div class="ach-grid">
          <article
            v-for="achievement in garden.achievements"
            :key="achievement.id"
            class="ach"
            :class="{ unlocked: achievement.unlockedAt }"
          >
            <span>{{ achievement.icon }}</span>
            <strong>{{ achievement.title }}</strong>
            <p>{{ achievement.desc }}</p>
          </article>
        </div>
      </section>

      <section class="card timeline-card">
        <div class="section-head compact">
          <div>
            <h3>最近专注</h3>
            <p>查看近期每一次专注落下的树种和时长。</p>
          </div>
        </div>
        <div v-if="recentTrees.length" class="timeline">
          <article v-for="tree in recentTrees" :key="tree.id" class="timeline-row">
            <span class="timeline-icon">{{ speciesOf(tree.species).emoji }}</span>
            <div>
              <strong>{{ speciesOf(tree.species).name }}<em v-if="tree.golden" class="gold-tag">金树</em></strong>
              <p>{{ formatTime(tree.at) }} · {{ tree.focusMinutes }} 分钟</p>
            </div>
          </article>
        </div>
        <div v-else class="empty-state compact-empty">
          <div class="emoji">🌱</div>
          <h2>还没有专注记录</h2>
          <p>完成一个番茄后，这里会出现你的第一条成长记录。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.garden-page {
  max-width: 1120px;
}
.garden-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 14px;
}
.garden-copy {
  padding: 10px 4px 4px;
}
.eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 6px;
}
.garden-copy h2 {
  font-size: 28px;
  line-height: 1.16;
  max-width: 680px;
}
.garden-copy p {
  margin-top: 9px;
  color: var(--text-secondary);
  line-height: 1.65;
  max-width: 760px;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.hero-actions span {
  color: var(--text-tertiary);
  font-size: 12.5px;
}
.level-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.level-label {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}
.level-card strong {
  font-size: 36px;
  margin-top: 6px;
}
.level-card p {
  color: var(--text-secondary);
  font-size: 12.5px;
  margin-top: 10px;
}
.level-bar {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--active);
  margin-top: 12px;
}
.level-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #30d158, #0a84ff);
  transition: width 0.4s var(--ease);
}
.garden-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.metric {
  border: 1px solid var(--separator);
  border-radius: 15px;
  background: var(--bg-card);
  padding: 14px 15px;
}
.metric span {
  display: block;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 5px;
}
.metric strong {
  font-size: 24px;
}
.quest-card {
  margin-bottom: 16px;
}
.claim-hint {
  background: #30d158;
  color: #fff;
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.quest-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.quest {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--separator);
  border-radius: 13px;
  background: var(--bg-input);
}
.quest.done {
  opacity: 0.62;
}
.quest-info {
  flex: 1;
  min-width: 0;
}
.quest-info strong {
  display: block;
  font-size: 13px;
}
.quest-bar {
  height: 6px;
  margin: 8px 0 5px;
  border-radius: 999px;
  background: var(--active);
  overflow: hidden;
}
.quest-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #30d158, #0a84ff);
  transition: width 0.35s var(--ease);
}
.quest-info small {
  color: var(--text-tertiary);
  font-size: 11px;
}
.quest-done {
  color: #30d158;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.garden-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.section-head.compact {
  margin-bottom: 12px;
}
.section-head h3 {
  font-size: 16px;
}
.section-head p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12.5px;
}
.current-species {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-weight: 800;
  white-space: nowrap;
}
.placing-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 700;
}
.plot-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(34px, 1fr));
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(48, 209, 88, 0.13), rgba(90, 200, 250, 0.12)),
    var(--bg-input);
}
.plot {
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(48, 209, 88, 0.14);
  border: 1px solid rgba(48, 209, 88, 0.18);
  font-size: 22px;
  cursor: pointer;
  transition: transform 0.14s var(--ease), filter 0.14s var(--ease), box-shadow 0.2s var(--ease);
}
.plot:hover {
  transform: translateY(-2px) scale(1.04);
}
.plot.empty {
  background: rgba(127, 127, 127, 0.08);
  border-style: dashed;
}
.plot-grid.placing .plot.empty {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: inset 0 0 0 1px var(--accent-soft);
}
.plot.marked {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.plot-mark {
  color: var(--accent);
  font-size: 15px;
  font-weight: 900;
}
.plot.decor {
  background: rgba(255, 159, 10, 0.13);
  border-color: rgba(255, 159, 10, 0.28);
}
.plot.golden,
.mood-glow {
  box-shadow: 0 0 0 2px rgba(255, 204, 0, 0.24), 0 0 24px rgba(255, 204, 0, 0.22);
}
.plot-emoji {
  transition: transform 0.25s var(--ease);
}
.plot-emoji.stage-sprout {
  font-size: 15px;
  opacity: 0.9;
}
.plot-emoji.stage-growing {
  font-size: 18px;
  filter: saturate(1.1);
}
.plot-emoji.stage-mature,
.plot-emoji.stage-glow {
  font-size: 22px;
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.shop-tabs {
  display: flex;
  background: var(--bg-input);
  border-radius: 11px;
  padding: 3px;
  margin-bottom: 12px;
}
.shop-tabs button {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  height: 30px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 800;
}
.shop-tabs button.active {
  background: var(--accent);
  color: #fff;
}
.shop-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shop-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--separator);
  border-radius: 12px;
  background: var(--bg-input);
}
.shop-icon {
  font-size: 25px;
  text-align: center;
}
.shop-info strong,
.shop-info span {
  display: block;
}
.shop-info strong {
  font-size: 13.5px;
}
.shop-info strong em {
  font-style: normal;
  color: var(--accent);
  font-size: 12px;
  margin-left: 3px;
}
.shop-info span {
  color: var(--text-secondary);
  font-size: 11.5px;
  margin-top: 2px;
}
.shop-btns {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.collection-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.col-item {
  border: 1px solid var(--separator);
  border-radius: 12px;
  background: var(--bg-input);
  padding: 10px 8px;
  text-align: center;
}
.col-item.locked {
  opacity: 0.5;
}
.col-emoji {
  display: block;
  font-size: 24px;
  margin-bottom: 5px;
}
.col-item strong {
  display: block;
  font-size: 12px;
}
.col-item small {
  display: block;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}
.garden-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  gap: 16px;
  margin-top: 16px;
}
.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.ach {
  min-height: 118px;
  border-radius: 13px;
  border: 1px solid var(--separator);
  background: var(--bg-input);
  padding: 12px;
  opacity: 0.48;
  transition: opacity 0.25s var(--ease);
}
.ach.unlocked {
  opacity: 1;
  border-color: color-mix(in srgb, var(--accent) 36%, transparent);
  background: linear-gradient(135deg, var(--accent-soft), var(--bg-input));
}
.ach span {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-card-strong);
  color: var(--accent);
  font-weight: 900;
  margin-bottom: 9px;
}
.ach strong {
  display: block;
  font-size: 13px;
}
.ach p {
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.45;
  margin-top: 5px;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.timeline-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px;
  border-radius: 12px;
  background: var(--bg-input);
}
.timeline-icon {
  font-size: 23px;
}
.timeline-row strong {
  font-size: 13.5px;
}
.gold-tag {
  font-style: normal;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 204, 0, 0.2);
  color: #b8860b;
  font-size: 10.5px;
  font-weight: 800;
}
.timeline-row p {
  color: var(--text-secondary);
  font-size: 11.5px;
  margin-top: 2px;
}
.compact-empty {
  padding: 28px 12px;
}
@media (max-width: 980px) {
  .garden-hero,
  .garden-layout,
  .garden-bottom {
    grid-template-columns: 1fr;
  }
  .garden-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .quest-list {
    grid-template-columns: 1fr;
  }
}
</style>
