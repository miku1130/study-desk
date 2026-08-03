<script setup lang="ts">
import { computed } from 'vue'
import {
  PET_CAT_IDLE_ANIMATIONS,
  PET_CAT_WRITING_ANIMATION,
  catFilter
} from '@/lib/petAssets'

type PetAnimation = 'idle' | 'writing'

const props = defineProps<{
  animation: PetAnimation
  catId: string
  label?: string
}>()

const animationSource = computed(() => {
  if (props.animation === 'writing') return PET_CAT_WRITING_ANIMATION
  return PET_CAT_IDLE_ANIMATIONS[props.catId] ?? PET_CAT_IDLE_ANIMATIONS.mikan
})

const imageStyle = computed(() => ({
  filter: props.animation === 'writing' ? catFilter(props.catId) : 'none'
}))
</script>

<template>
  <span
    class="pet-sprite-animation"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <video
      :key="animationSource"
      class="pet-animation-video"
      :src="animationSource"
      aria-hidden="true"
      :style="imageStyle"
      autoplay
      loop
      muted
      playsinline
      preload="auto"
      disablepictureinpicture
    />
  </span>
</template>

<style scoped>
.pet-sprite-animation {
  display: block;
  overflow: hidden;
}

.pet-animation-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
