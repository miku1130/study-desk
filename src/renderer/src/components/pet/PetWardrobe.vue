<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import { PET_CATS, PET_FURNITURE, PET_ROOMS, type PetCatalogItem } from '@/stores/petCompanion'
import { PET_ITEM_IMAGES, PET_ROOM_IMAGES } from '@/lib/petAssets'

type WardrobeTab = 'cat' | 'room' | 'furniture'

const props = defineProps<{
  coins: number
  catId: string
  roomId: string
  furnitureId: string
  unlockedCats: string[]
  unlockedRooms: string[]
  unlockedFurniture: string[]
}>()

const emit = defineEmits<{
  choose: [kind: WardrobeTab, id: string]
}>()

const tab = shallowRef<WardrobeTab>('cat')
const catalog = computed(() =>
  tab.value === 'cat' ? PET_CATS : tab.value === 'room' ? PET_ROOMS : PET_FURNITURE
)
const unlocked = computed(() =>
  tab.value === 'cat'
    ? props.unlockedCats
    : tab.value === 'room'
      ? props.unlockedRooms
      : props.unlockedFurniture
)
const selected = computed(() =>
  tab.value === 'cat' ? props.catId : tab.value === 'room' ? props.roomId : props.furnitureId
)

function imageFor(item: PetCatalogItem): string {
  if (tab.value === 'room') return PET_ROOM_IMAGES[item.id] ?? PET_ROOM_IMAGES.sunroom
  return PET_ITEM_IMAGES[item.id] ?? ''
}
</script>

<template>
  <section class="wardrobe-panel">
    <header class="panel-header">
      <div>
        <h2>小屋布置</h2>
        <p>选中的物件会立刻出现在房间里</p>
      </div>
      <span class="coin-balance"><AppIcon name="coins" :size="15" />{{ coins }}</span>
    </header>
    <div class="seg wardrobe-tabs" role="tablist" aria-label="装扮分类">
      <button class="seg-btn" :class="{ active: tab === 'cat' }" @click="tab = 'cat'">猫咪</button>
      <button class="seg-btn" :class="{ active: tab === 'furniture' }" @click="tab = 'furniture'">家具</button>
      <button class="seg-btn" :class="{ active: tab === 'room' }" @click="tab = 'room'">背景</button>
    </div>
    <div class="wardrobe-grid">
      <button
        v-for="item in catalog"
        :key="item.id"
        class="wardrobe-item"
        :class="{ selected: selected === item.id }"
        :disabled="!unlocked.includes(item.id) && coins < item.cost"
        @click="emit('choose', tab, item.id)"
      >
        <span class="asset-frame" :class="`asset-${tab}`">
          <PetSpriteAnimation
            v-if="tab === 'cat'"
            class="wardrobe-cat-animation"
            animation="idle"
            :cat-id="item.id"
          />
          <img
            v-else
            :src="imageFor(item)"
            alt=""
          />
        </span>
        <span class="item-copy">
          <strong>{{ item.name }}</strong>
          <small>{{ item.description }}</small>
        </span>
        <span v-if="selected === item.id" class="item-state">使用中</span>
        <span v-else-if="unlocked.includes(item.id)" class="item-state">已拥有</span>
        <span v-else class="item-price"><AppIcon name="coins" :size="12" />{{ item.cost }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.wardrobe-panel {
  min-width: 0;
}
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
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
.coin-balance,
.item-price {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #9b6c1e;
  font-weight: 760;
}
.coin-balance {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(168, 117, 31, 0.2);
  border-radius: 7px;
  background: rgba(246, 200, 95, 0.14);
}
.wardrobe-tabs {
  margin-bottom: 12px;
}
.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.wardrobe-item {
  position: relative;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 92px;
  padding: 9px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  text-align: left;
  transition: border-color 140ms var(--ease), transform 140ms var(--ease), background 140ms var(--ease);
}
.wardrobe-item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--border-strong);
  background: var(--surface-raised);
}
.wardrobe-item.selected {
  border-color: color-mix(in srgb, var(--accent) 56%, var(--border-strong));
  box-shadow: inset 3px 0 var(--accent);
}
.wardrobe-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.asset-frame {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-muted);
}
.asset-frame img {
  width: 92%;
  height: 92%;
  object-fit: contain;
}
.wardrobe-cat-animation {
  width: 92%;
  height: 92%;
}
.asset-room img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.item-copy {
  min-width: 0;
  padding-bottom: 17px;
}
.item-copy strong,
.item-copy small {
  display: block;
}
.item-copy strong {
  font-size: 13px;
}
.item-copy small {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.35;
}
.item-state,
.item-price {
  position: absolute;
  right: 9px;
  bottom: 8px;
  font-size: 10.5px;
}
.item-state {
  color: var(--accent-strong);
  font-weight: 720;
}
@media (max-width: 720px) {
  .wardrobe-grid { grid-template-columns: 1fr; }
}
</style>
