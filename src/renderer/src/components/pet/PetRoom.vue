<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import type { PetKeepsake } from '@/types'
import { PET_CAT_IMAGES, PET_ITEM_IMAGES, PET_ROOM_IMAGES, catFilter, type PetVisualState } from '@/lib/petAssets'

const props = defineProps<{
  state: PetVisualState
  catId: string
  roomId: string
  furnitureId: string
  catName: string
  status: string
  keepsake?: PetKeepsake | null
}>()

const petted = shallowRef(false)
let petTimer = 0

const catImage = computed(() => PET_CAT_IMAGES[props.state])
const roomImage = computed(() => PET_ROOM_IMAGES[props.roomId] ?? PET_ROOM_IMAGES.sunroom)
const furnitureImage = computed(() =>
  props.furnitureId === 'oak-desk' ? '' : PET_ITEM_IMAGES[props.furnitureId] ?? ''
)
const keepsakeImage = computed(() => (props.keepsake ? PET_ITEM_IMAGES[props.keepsake.itemId] : ''))
const catStyle = computed(() => ({ filter: catFilter(props.catId) }))

function petCat(): void {
  petted.value = true
  window.clearTimeout(petTimer)
  petTimer = window.setTimeout(() => (petted.value = false), 1400)
}

onBeforeUnmount(() => window.clearTimeout(petTimer))
</script>

<template>
  <section class="pet-room" :class="[`state-${state}`, `furniture-${furnitureId}`]">
    <img class="room-background" :src="roomImage" alt="伴学小屋" />
    <div class="room-shade" />
    <div class="room-status">
      <span class="status-dot" />
      <span>{{ status }}</span>
    </div>
    <Transition name="bubble">
      <p v-if="petted" class="cat-bubble">呼噜... 我在这里</p>
    </Transition>
    <button class="cat-button" :aria-label="`摸摸${catName}`" @click="petCat">
      <PetSpriteAnimation
        v-if="state !== 'gift'"
        class="cat-image"
        :animation="state === 'focus' ? 'writing' : 'idle'"
        :cat-id="catId"
        :label="`${catName}正在陪伴学习`"
      />
      <img v-else class="cat-image cat-image-static" :src="catImage" :alt="`${catName}正在陪伴学习`" :style="catStyle" />
    </button>
    <img v-if="furnitureImage" class="furniture-image" :src="furnitureImage" alt="" />
    <Transition name="keepsake">
      <img v-if="keepsakeImage" :key="keepsake?.id" class="keepsake-image" :src="keepsakeImage" alt="最近得到的收藏" />
    </Transition>
    <div class="nameplate">
      <strong>{{ catName }}</strong>
      <span>{{ state === 'focus' ? '正陪你一起写' : state === 'gift' ? '有东西要送给你' : state === 'break' ? '也该伸个懒腰了' : state === 'paused' ? '安静等你回来' : '已经把纸笔摆好了' }}</span>
    </div>
  </section>
</template>

<style scoped>
.pet-room {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 8.6;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: #efe5d2;
  box-shadow: var(--shadow-raised);
  isolation: isolate;
}

.room-background,
.room-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.room-background {
  object-fit: cover;
}

.room-shade {
  box-shadow: inset 0 -90px 80px rgba(38, 42, 34, 0.12);
  pointer-events: none;
}

.room-status,
.nameplate,
.cat-bubble {
  position: absolute;
  z-index: 4;
  border: 1px solid rgba(62, 82, 70, 0.17);
  background: rgba(255, 252, 247, 0.9);
  color: #25332d;
  box-shadow: 0 7px 22px rgba(55, 69, 60, 0.13);
  backdrop-filter: blur(12px);
}

.room-status {
  top: 16px;
  left: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 720;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #38876d;
  box-shadow: 0 0 0 4px rgba(56, 135, 109, 0.13);
  animation: status-pulse 1.8s ease-in-out infinite;
}

.state-idle .status-dot,
.state-paused .status-dot,
.state-break .status-dot {
  background: #c38c25;
  box-shadow: 0 0 0 4px rgba(195, 140, 37, 0.13);
  animation: none;
}

.cat-button {
  position: absolute;
  z-index: 3;
  bottom: 2.5%;
  left: 50%;
  width: min(31%, 330px);
  height: 64%;
  padding: 0;
  border: none;
  background: transparent;
  transform: translateX(-50%);
}

.cat-image {
  width: 100%;
  height: 100%;
  transform-origin: center bottom;
  transition: filter 220ms var(--ease), transform 160ms var(--ease);
}

.cat-image-static {
  object-fit: contain;
  object-position: center bottom;
  animation: cat-breathe 3.2s ease-in-out infinite;
}

.cat-button:hover .cat-image {
  transform: translateY(-3px) rotate(0.5deg);
}

.state-gift .cat-image {
  animation: gift-arrive 700ms var(--ease) both, cat-breathe 3s 700ms ease-in-out infinite;
}

.furniture-image {
  position: absolute;
  z-index: 2;
  bottom: 2.5%;
  left: 8%;
  width: 20%;
  max-height: 42%;
  object-fit: contain;
  filter: drop-shadow(0 10px 9px rgba(66, 53, 34, 0.16));
}

.furniture-window-cushion .furniture-image {
  left: auto;
  right: 7%;
  width: 24%;
}

.furniture-floor-lamp .furniture-image {
  left: 18%;
  width: 15%;
}

.keepsake-image {
  position: absolute;
  z-index: 4;
  right: 24%;
  bottom: 8%;
  width: 8.5%;
  max-height: 18%;
  object-fit: contain;
  filter: drop-shadow(0 5px 4px rgba(65, 52, 35, 0.17));
}

.nameplate {
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  min-width: 170px;
  padding: 10px 13px;
  border-radius: 7px;
}

.nameplate strong {
  font-size: 14px;
}

.nameplate span {
  margin-top: 2px;
  color: #62736b;
  font-size: 11.5px;
}

.cat-bubble {
  left: 60%;
  bottom: 54%;
  margin: 0;
  padding: 8px 11px;
  border-radius: 8px 8px 8px 2px;
  font-size: 12px;
  font-weight: 650;
}

.bubble-enter-active,
.bubble-leave-active,
.keepsake-enter-active,
.keepsake-leave-active {
  transition: opacity 180ms var(--ease), transform 180ms var(--ease);
}

.bubble-enter-from,
.bubble-leave-to,
.keepsake-enter-from,
.keepsake-leave-to {
  opacity: 0;
  transform: translateY(7px) scale(0.96);
}

@keyframes cat-breathe {
  50% { transform: translateY(-2px) scaleY(1.008); }
}

@keyframes gift-arrive {
  from { opacity: 0; transform: translateY(18px) scale(0.84); }
}

@keyframes status-pulse {
  50% { opacity: 0.62; }
}

@media (max-width: 760px) {
  .pet-room { min-height: 330px; aspect-ratio: 4 / 3; }
  .room-background { object-position: 58% center; }
  .cat-button { width: 42%; height: 57%; }
  .nameplate { right: 10px; bottom: 10px; min-width: 0; }
  .room-status { top: 10px; left: 10px; }
}
</style>
