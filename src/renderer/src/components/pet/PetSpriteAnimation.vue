<script setup lang="ts">
import { computed } from 'vue'
import { PET_CAT_IDLE_ANIMATIONS, PET_CAT_IMAGES, catFilter } from '@/lib/petAssets'

type PetAnimation = 'idle' | 'writing'

const props = defineProps<{
  animation: PetAnimation
  catId: string
  label?: string
  /** 多只猫同屏的场景（如自习室座位）用轻量模式，避免同时解码多路视频 */
  lite?: boolean
}>()

/**
 * 写字动作没有可用的连续帧素材（原始素材是若干张彼此独立的画，逐帧播放会一卡一卡），
 * 因此改用单张立绘 + CSS 位移旋转来表现「正在写」，任何刷新率下都平滑。
 * 待机动作有真正逐帧绘制的循环动画，仍然用视频播放。
 */
const useStill = computed(() => props.animation === 'writing' || Boolean(props.lite))

const stillSource = computed(() =>
  props.animation === 'writing' ? PET_CAT_IMAGES.focus : PET_CAT_IMAGES.idle
)

const idleSource = computed(
  () => PET_CAT_IDLE_ANIMATIONS[props.catId] ?? PET_CAT_IDLE_ANIMATIONS.mikan
)

// 立绘只有米柑一种配色，靠滤镜换成其它品种；待机视频每只猫都有专属素材，无需上色
const tintStyle = computed(() => ({ filter: useStill.value ? catFilter(props.catId) : 'none' }))
</script>

<template>
  <span
    class="pet-sprite-animation"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <span v-if="useStill" class="pet-still-breathe">
      <img
        class="pet-animation-still"
        :class="animation === 'writing' ? 'is-writing' : 'is-idle'"
        :src="stillSource"
        :style="tintStyle"
        alt=""
        draggable="false"
      />
    </span>
    <video
      v-else
      :key="idleSource"
      class="pet-animation-video"
      :src="idleSource"
      aria-hidden="true"
      :style="tintStyle"
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

.pet-still-breathe {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 50% 92%;
  animation: pet-breathe 3.6s ease-in-out infinite;
}

.pet-animation-still {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: 50% 92%;
  will-change: transform;
  -webkit-user-drag: none;
}

/* 快频微动叠在慢频呼吸之上，读起来像笔尖在纸上走 */
.pet-animation-still.is-writing {
  animation: pet-scribble 0.66s ease-in-out infinite;
}

.pet-animation-still.is-idle {
  animation: pet-idle-sway 5.4s ease-in-out infinite;
}

@keyframes pet-breathe {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -1.8%, 0) scale(1.014);
  }
}

@keyframes pet-scribble {
  0%,
  100% {
    transform: translate3d(-0.45%, 0, 0) rotate(-0.75deg);
  }
  50% {
    transform: translate3d(0.45%, -0.35%, 0) rotate(0.75deg);
  }
}

@keyframes pet-idle-sway {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(-0.45deg);
  }
  50% {
    transform: translate3d(0, 0, 0) rotate(0.45deg);
  }
}
</style>
