<script setup lang="ts">
import { computed } from 'vue'
import { useGardenStore, COINS_PER_POMODORO } from '@/stores/garden'
import { TREE_SPECIES } from '@/types'

const garden = useGardenStore()

const emojiOf = (id: string): string =>
  TREE_SPECIES.find((s) => s.id === id)?.emoji ?? '🌳'

// 最新的种在前面，最多展示 120 棵，避免超长
const forest = computed(() => [...garden.trees].reverse().slice(0, 120))
</script>

<template>
  <div class="page garden">
    <section class="card hero">
      <div class="stat">
        <span class="s-emoji">🪙</span>
        <div>
          <p class="s-num">{{ garden.coins }}</p>
          <p class="s-cap">金币</p>
        </div>
      </div>
      <div class="stat">
        <span class="s-emoji">🌳</span>
        <div>
          <p class="s-num">{{ garden.totalTrees }}</p>
          <p class="s-cap">已种下</p>
        </div>
      </div>
      <div class="stat">
        <span class="s-emoji">{{ garden.currentSpecies.emoji }}</span>
        <div>
          <p class="s-num small">{{ garden.currentSpecies.name }}</p>
          <p class="s-cap">当前树种</p>
        </div>
      </div>
      <p class="earn">每完成 1 个番茄 +{{ COINS_PER_POMODORO }} 金币，并种下一棵树</p>
    </section>

    <h3 class="section-title">我的森林</h3>
    <section class="card">
      <div v-if="forest.length" class="forest">
        <span v-for="t in forest" :key="t.id" class="tree" :title="garden.currentSpecies.name">
          {{ emojiOf(t.species) }}
        </span>
      </div>
      <div v-else class="empty-state">
        <div class="emoji">🌱</div>
        <h2>森林还是空的</h2>
        <p>去番茄钟专注一个番茄，就能种下你的第一棵树。</p>
      </div>
    </section>

    <h3 class="section-title" style="margin-top: 22px">树种商店</h3>
    <section class="card shop">
      <div v-for="sp in TREE_SPECIES" :key="sp.id" class="shop-item">
        <span class="shop-emoji">{{ sp.emoji }}</span>
        <div class="shop-info">
          <p class="shop-name">{{ sp.name }}</p>
          <p class="shop-cost">{{ sp.cost === 0 ? '初始树种' : `${sp.cost} 金币` }}</p>
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
          @click="garden.unlock(sp.id)"
        >
          {{ garden.coins < sp.cost ? `差 ${sp.cost - garden.coins} 金币` : '解锁' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
  padding: 24px 28px;
  margin-bottom: 16px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
}
.s-emoji {
  font-size: 34px;
}
.s-num {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.s-num.small {
  font-size: 18px;
}
.s-cap {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.earn {
  flex-basis: 100%;
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.forest {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.tree {
  font-size: 30px;
  line-height: 1.2;
  transition: transform 0.15s var(--ease);
}
.tree:hover {
  transform: scale(1.25) translateY(-2px);
}
.shop {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shop-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 6px;
  border-bottom: 1px solid var(--separator);
}
.shop-item:last-child {
  border-bottom: none;
}
.shop-emoji {
  font-size: 28px;
  width: 34px;
  text-align: center;
}
.shop-info {
  flex: 1;
}
.shop-name {
  font-size: 14px;
  font-weight: 600;
}
.shop-cost {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>
