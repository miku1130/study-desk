<script setup lang="ts">
import { computed } from 'vue'
import { PET_CAT_IMAGES, catFilter } from '@/lib/petAssets'

type PetAnimation = 'idle' | 'writing'

const props = defineProps<{
  animation: PetAnimation
  catId: string
  label?: string
  /** 保留给调用方的语义标记；现在两种模式渲染方式一致 */
  lite?: boolean
}>()

/**
 * 全部用单帧立绘 + CSS 轻微晃动。
 *
 * 之前待机动作走的是逐帧 webm，实际效果不稳：多只猫同屏时要同时解码多路视频，
 * 循环接缝也会一顿。单帧加一点点位移旋转反而更像"活着"，任何刷新率下都平滑，
 * 而且 999 人的自习室里也不会有解码开销。
 */
const stillSource = computed(() =>
  props.animation === 'writing' ? PET_CAT_IMAGES.focus : PET_CAT_IMAGES.idle
)

// 立绘只有米柑一种配色，靠滤镜换成其它品种
const tintStyle = computed(() => ({ filter: catFilter(props.catId) }))
</script>

<template>
  <span
    class="pet-sprite-animation"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <span class="pet-still-breathe">
      <img
        class="pet-animation-still"
        :class="animation === 'writing' ? 'is-writing' : 'is-idle'"
        :src="stillSource"
        :style="tintStyle"
        alt=""
        draggable="false"
      />
    </span>
  </span>
</template>

<style scoped>
.pet-sprite-animation {
  display: block;
  overflow: hidden;
}

.pet-still-breathe {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 50% 92%;
  animation: pet-breathe 4.2s ease-in-out infinite;
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

/* 幅度刻意压得很小：晃动是为了让画面不死板，不该让人盯着看 */
.pet-animation-still.is-writing {
  animation: pet-scribble 1.1s ease-in-out infinite;
}

.pet-animation-still.is-idle {
  animation: pet-idle-sway 6s ease-in-out infinite;
}

/* 关掉动画偏好时保持静止，前庭敏感的人不至于难受 */
@media (prefers-reduced-motion: reduce) {
  .pet-still-breathe,
  .pet-animation-still.is-writing,
  .pet-animation-still.is-idle {
    animation: none;
  }
}

@keyframes pet-breathe {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -1.1%, 0) scale(1.008);
  }
}

@keyframes pet-scribble {
  0%,
  100% {
    transform: translate3d(-0.2%, 0, 0) rotate(-0.35deg);
  }
  50% {
    transform: translate3d(0.2%, -0.15%, 0) rotate(0.35deg);
  }
}

@keyframes pet-idle-sway {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(-0.3deg);
  }
  50% {
    transform: translate3d(0, 0, 0) rotate(0.3deg);
  }
}
</style>
