<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGardenStore, COINS_PER_POMODORO, PLOT_COUNT } from '@/stores/garden'
import { useUiStore } from '@/stores/ui'
import { DECOR_ITEMS, TREE_SPECIES, type GardenDecor, type GardenTree } from '@/types'
import { decorSvg, treeSvg, type TreeStage } from '@/lib/sprites'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'

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

function stageOf(tree: GardenTree): TreeStage {
  if (tree.golden) return 'mature'
  if (tree.growth <= 0) return 'sprout'
  if (tree.growth < 3) return 'young'
  return 'mature'
}

function treeSprite(tree: GardenTree): string {
  return treeSvg(tree.species, stageOf(tree), tree.golden)
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
  if (garden.unlock(id)) ui.success(`已解锁${sp.name}，自动切换为当前树种`)
}

function buyDecor(kind: string): void {
  const spec = decorOf(kind)
  if (garden.buyDecor(kind)) {
    ui.success(`已购买${spec.name}，点击空地块摆放`)
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
  router.push('/pomodoro?tab=timer')
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
        <span class="metric-head"><AppIcon name="coins" :size="13" />金币</span>
        <strong>{{ garden.coins }}</strong>
      </div>
      <div class="metric">
        <span class="metric-head"><AppIcon name="tree" :size="13" />总树木</span>
        <strong>{{ garden.totalTrees }}</strong>
      </div>
      <div class="metric">
        <span class="metric-head"><AppIcon name="sparkle" :size="13" />金树</span>
        <strong>{{ garden.goldenTrees }}</strong>
      </div>
      <div class="metric">
        <span class="metric-head"><AppIcon name="sun" :size="13" />今日种下</span>
        <strong>{{ garden.todayTrees }}</strong>
      </div>
      <div class="metric">
        <span class="metric-head"><AppIcon name="medal" :size="13" />已获成就</span>
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
          <span v-else class="quest-done"><AppIcon name="check" :size="13" />已领取</span>
        </article>
      </div>
    </section>

    <div class="garden-layout">
      <section class="forest-card card">
        <div class="section-head">
          <div>
            <h3>{{ PLOT_COUNT }} 块专注地块</h3>
            <p>点击空地块指定下一棵树的位置；点击装饰可收回。幼苗会随后续专注长成大树。</p>
          </div>
          <span class="current-species">
            <span class="cs-sprite" v-html="treeSvg(garden.currentSpecies.id, 'mature')" />
            {{ garden.currentSpecies.name }}
          </span>
        </div>
        <p v-if="placingKind" class="placing-tip">
          <span class="pt-sprite" v-html="decorSvg(placingKind)" />
          正在摆放「{{ decorOf(placingKind).name }}」，点击空地块放置
          <button class="btn btn-secondary btn-sm" @click="placingKind = ''">取消</button>
        </p>
        <div class="plot-grid" :class="{ placing: !!placingKind }">
          <div
            v-for="cell in plots"
            :key="cell.index"
            class="plot"
            :class="[
              cell.tree ? 'planted' : cell.decor ? 'decor' : 'empty',
              { marked: garden.nextPlot === cell.index, golden: cell.tree?.golden }
            ]"
            :title="plotTitle(cell)"
            @click="onPlotClick(cell)"
          >
            <span v-if="cell.tree" class="plot-sprite" v-html="treeSprite(cell.tree)" />
            <span v-else-if="cell.decor" class="plot-sprite" v-html="decorSvg(cell.decor.kind)" />
            <AppIcon v-else-if="garden.nextPlot === cell.index" class="plot-mark" name="locate" :size="15" />
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
              <span class="shop-sprite" v-html="treeSvg(sp.id, 'mature')" />
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
              <span class="shop-sprite" v-html="decorSvg(d.id)" />
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
              <span v-if="c.count" class="col-sprite" v-html="treeSvg(c.species.id, 'mature')" />
              <span v-else class="col-unknown"><AppIcon name="help" :size="22" :stroke-width="1.6" /></span>
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
            <span class="ach-badge"><AppIcon :name="achievement.icon" :size="15" /></span>
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
            <span class="timeline-sprite" v-html="treeSprite(tree)" />
            <div>
              <strong>{{ speciesOf(tree.species).name }}<em v-if="tree.golden" class="gold-tag">金树</em></strong>
              <p>{{ formatTime(tree.at) }} · {{ tree.focusMinutes }} 分钟</p>
            </div>
          </article>
        </div>
        <div v-else class="card-empty">
          <EmptyState icon="seed" title="还没有专注记录" desc="完成一个番茄后，这里会出现你的第一条成长记录。" />
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
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 16px;
  padding: 22px 22px 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background:
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--brand-sun) 20%, transparent), transparent 22%),
    radial-gradient(circle at 72% 100%, color-mix(in srgb, var(--brand-peach) 14%, transparent), transparent 26%),
    linear-gradient(128deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 50%),
    var(--surface-card);
  box-shadow: var(--shadow-card);
}
.garden-hero::after {
  content: '';
  position: absolute;
  width: 260px;
  height: 150px;
  right: -54px;
  bottom: -100px;
  border: 1px solid color-mix(in srgb, var(--accent) 17%, transparent);
  border-radius: 50%;
  box-shadow:
    0 0 0 18px color-mix(in srgb, var(--accent) 4%, transparent),
    0 0 0 42px color-mix(in srgb, var(--accent) 3%, transparent);
  pointer-events: none;
}
.garden-copy {
  position: relative;
  z-index: 1;
  padding: 2px 4px;
}
.eyebrow {
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}
.garden-copy h2 {
  font-size: 27px;
  line-height: 1.2;
  letter-spacing: -0.025em;
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
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: color-mix(in srgb, var(--surface-raised) 82%, transparent);
  box-shadow: none;
}
.level-label {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}
.level-card strong {
  font-size: 34px;
  letter-spacing: -0.03em;
  margin-top: 6px;
}
.level-card p {
  color: var(--text-secondary);
  font-size: 12.5px;
  margin-top: 10px;
}
.level-bar {
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-pressed);
  margin-top: 12px;
}
.level-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--brand-peach), var(--brand-sun), var(--accent));
  transition: width 0.4s var(--ease);
}
.garden-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.metric {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-card);
  padding: 13px 15px;
  box-shadow: 0 1px 2px rgba(26, 35, 31, 0.025);
}
.metric::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: color-mix(in srgb, var(--accent) 48%, transparent);
}
.metric:nth-child(2)::before {
  background: var(--brand-sky);
}
.metric:nth-child(3)::before {
  background: var(--brand-sun);
}
.metric:nth-child(4)::before {
  background: var(--brand-peach);
}
.metric:nth-child(5)::before {
  background: var(--brand-lilac);
}
.metric:nth-child(2)::before {
  background: var(--brand-sky);
}
.metric:nth-child(3)::before {
  background: var(--brand-sun);
}
.metric:nth-child(4)::before {
  background: var(--brand-peach);
}
.metric:nth-child(5)::before {
  background: var(--brand-lilac);
}
.metric-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 6px;
}
.metric strong {
  display: block;
  font-size: 23px;
  font-variant-numeric: tabular-nums;
}
.quest-card {
  margin-bottom: 16px;
}
.claim-hint {
  background: color-mix(in srgb, var(--status-success) 12%, transparent);
  color: var(--status-success);
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
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
  border: 1px solid var(--border-subtle);
  border-radius: 11px;
  background: var(--surface-muted);
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
  background: var(--surface-pressed);
  overflow: hidden;
}
.quest-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand-highlight), var(--accent));
  transition: width 0.35s var(--ease);
}
.quest:nth-child(2) .quest-bar span {
  background: linear-gradient(90deg, var(--brand-sky), var(--accent));
}
.quest:nth-child(3) .quest-bar span {
  background: linear-gradient(90deg, var(--brand-peach), var(--brand-sun));
}
.quest:nth-child(2) .quest-bar span {
  background: linear-gradient(90deg, var(--brand-sky), var(--accent));
}
.quest:nth-child(3) .quest-bar span {
  background: linear-gradient(90deg, var(--brand-peach), var(--brand-sun));
}
.quest-info small {
  color: var(--text-tertiary);
  font-size: 11px;
}
.quest-done {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--status-success);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border-radius: 999px;
  padding: 4px 12px 4px 5px;
  font-size: 12.5px;
  font-weight: 800;
  white-space: nowrap;
}
.cs-sprite {
  display: inline-flex;
  width: 24px;
  height: 24px;
}
.placing-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 7px 12px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 12.5px;
  font-weight: 700;
}
.pt-sprite {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}
.plot-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, minmax(34px, 1fr));
  gap: 6px;
  padding: 16px;
  border-radius: 16px;
  background:
    linear-gradient(30deg, color-mix(in srgb, var(--accent) 3%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--accent) 3%, transparent) 87.5%),
    linear-gradient(150deg, color-mix(in srgb, var(--accent) 3%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--accent) 3%, transparent) 87.5%),
    radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--accent) 17%, transparent), transparent 42%),
    radial-gradient(circle at 84% 88%, color-mix(in srgb, var(--brand-sky) 15%, transparent), transparent 46%),
    var(--surface-muted);
  background-size: 28px 48px, 28px 48px, auto, auto, auto;
  border: 1px solid var(--border-strong);
  box-shadow: inset 0 1px 8px rgba(25, 39, 31, 0.04);
}
.plot {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-card));
  border: 1px solid color-mix(in srgb, var(--accent) 15%, var(--border-subtle));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--surface-raised) 72%, transparent);
  cursor: pointer;
  padding: 6%;
  transition: transform 0.14s var(--ease), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease);
}
.plot:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
  box-shadow: 0 4px 10px rgba(29, 45, 36, 0.09);
}
.plot:hover .plot-sprite {
  transform: translateY(-1px) scale(1.05);
}
.plot.empty {
  background: color-mix(in srgb, var(--text-tertiary) 3%, transparent);
  border-style: dashed;
  border-color: color-mix(in srgb, var(--text-tertiary) 20%, transparent);
  box-shadow: none;
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
}
.plot.decor {
  background: color-mix(in srgb, var(--brand-peach) 12%, var(--surface-card));
  border-color: color-mix(in srgb, var(--brand-peach) 32%, transparent);
}
.plot.golden {
  border-color: rgba(212, 168, 66, 0.5);
  box-shadow: 0 0 0 2px rgba(226, 181, 79, 0.22), 0 4px 18px rgba(226, 181, 79, 0.25);
}
.plot-sprite {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  transition: transform 180ms var(--ease);
}
.plot-sprite :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 3px 2px rgba(29, 45, 36, 0.14));
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.shop-tabs {
  display: flex;
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
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
  background: var(--surface-raised);
  color: var(--accent-strong);
  box-shadow: 0 1px 3px rgba(18, 27, 23, 0.09);
}
.shop-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shop-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-muted);
}
.shop-item.rare {
  background: color-mix(in srgb, var(--brand-sky) 8%, var(--surface-raised));
}
.shop-item.epic {
  background: color-mix(in srgb, var(--brand-lilac) 9%, var(--surface-raised));
}
.shop-sprite {
  display: inline-flex;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 11%, transparent);
  padding: 3px;
}
.shop-sprite :deep(svg) {
  width: 100%;
  height: 100%;
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
  color: var(--accent-strong);
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
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-muted);
  padding: 10px 8px 9px;
  text-align: center;
}
.col-item.locked {
  opacity: 0.55;
}
.col-sprite,
.col-unknown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-bottom: 5px;
}
.col-unknown {
  color: var(--text-tertiary);
}
.col-sprite :deep(svg) {
  width: 100%;
  height: 100%;
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
  border-radius: 11px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  padding: 12px;
  opacity: 0.48;
  transition: opacity 0.25s var(--ease);
}
.ach.unlocked {
  opacity: 1;
  border-color: color-mix(in srgb, var(--accent) 36%, transparent);
  background: linear-gradient(135deg, var(--accent-soft), var(--bg-input));
}
.ach-badge {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
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
  padding: 8px 9px;
  border-radius: 10px;
  background: var(--surface-muted);
}
.timeline-sprite {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}
.timeline-sprite :deep(svg) {
  width: 100%;
  height: 100%;
}
.timeline-row strong {
  font-size: 13.5px;
}
.gold-tag {
  font-style: normal;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(226, 181, 79, 0.2);
  color: #a8802a;
  font-size: 10.5px;
  font-weight: 800;
}
.timeline-row p {
  color: var(--text-secondary);
  font-size: 11.5px;
  margin-top: 2px;
}
.card-empty {
  padding: 16px 0;
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
