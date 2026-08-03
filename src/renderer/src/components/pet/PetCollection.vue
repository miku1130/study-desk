<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { PetKeepsake, PetKeepsakeKind } from '@/types'
import { PET_GIFTS, PET_TRASH } from '@/stores/petCompanion'
import { PET_ITEM_IMAGES } from '@/lib/petAssets'

type CollectionFilter = 'all' | PetKeepsakeKind

const props = defineProps<{
  keepsakes: PetKeepsake[]
}>()

const filter = shallowRef<CollectionFilter>('all')
const gifts = computed(() => props.keepsakes.filter((item) => item.kind === 'gift'))
const trash = computed(() => props.keepsakes.filter((item) => item.kind === 'trash'))
const visible = computed(() =>
  (filter.value === 'all' ? props.keepsakes : props.keepsakes.filter((item) => item.kind === filter.value)).slice(0, 12)
)

function itemName(item: PetKeepsake): string {
  const catalog = item.kind === 'gift' ? PET_GIFTS : PET_TRASH
  return catalog.find((entry) => entry.id === item.itemId)?.name ?? '猫咪留下的小东西'
}

function sourceLabel(item: PetKeepsake): string {
  return item.source === 'class' ? '一堂课' : '一次番茄'
}

function dateLabel(at: number): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(at)
}
</script>

<template>
  <section class="collection-panel">
    <header class="panel-header">
      <div>
        <h2>猫咪留下的东西</h2>
        <p>礼物 {{ gifts.length }} · 小垃圾 {{ trash.length }}</p>
      </div>
      <div class="seg collection-tabs" role="tablist" aria-label="收藏筛选">
        <button class="seg-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button class="seg-btn" :class="{ active: filter === 'gift' }" @click="filter = 'gift'">礼物</button>
        <button class="seg-btn" :class="{ active: filter === 'trash' }" @click="filter = 'trash'">小垃圾</button>
      </div>
    </header>
    <div v-if="visible.length" class="collection-grid">
      <article v-for="item in visible" :key="item.id" class="collection-item" :class="item.kind">
        <div class="collection-image">
          <img :src="PET_ITEM_IMAGES[item.itemId]" alt="" />
        </div>
        <div class="collection-copy">
          <strong>{{ itemName(item) }}</strong>
          <span>{{ sourceLabel(item) }} · {{ dateLabel(item.at) }}</span>
        </div>
      </article>
    </div>
    <div v-else class="collection-empty">
      <img :src="PET_ITEM_IMAGES['paper-star']" alt="" />
      <strong>书架上还是空的</strong>
      <span>下一次认真写完，猫会悄悄放点东西在这里</span>
    </div>
  </section>
</template>

<style scoped>
.collection-panel {
  min-width: 0;
}
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.panel-header h2 {
  margin: 0;
  font-size: 16px;
}
.panel-header p {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
.collection-tabs .seg-btn {
  padding-inline: 10px;
  font-size: 11.5px;
}
.collection-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}
.collection-item {
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
}
.collection-item.trash {
  background: color-mix(in srgb, var(--surface-muted) 88%, #f2a477 12%);
}
.collection-image {
  display: grid;
  place-items: center;
  height: 84px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--surface-muted);
}
.collection-image img {
  width: 86%;
  height: 86%;
  object-fit: contain;
}
.collection-copy {
  display: block;
  margin-top: 7px;
}
.collection-copy strong,
.collection-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collection-copy strong {
  font-size: 11.5px;
}
.collection-copy span {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 9.5px;
}
.collection-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-tertiary);
}
.collection-empty img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  opacity: 0.65;
}
.collection-empty strong {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 13px;
}
.collection-empty span {
  max-width: 240px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
}
@media (max-width: 720px) {
  .panel-header { align-items: stretch; flex-direction: column; }
  .collection-tabs { align-self: flex-start; }
  .collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
