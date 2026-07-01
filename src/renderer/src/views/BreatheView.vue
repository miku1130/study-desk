<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

interface Phase {
  name: string
  dur: number
  scale: number
}

// 4-4-6 舒缓呼吸法：吸气 4s → 屏息 4s → 呼气 6s
const phases: Phase[] = [
  { name: '吸气', dur: 4, scale: 1 },
  { name: '屏息', dur: 4, scale: 1 },
  { name: '呼气', dur: 6, scale: 0.5 }
]

const running = ref(false)
const idx = ref(0)
const scale = ref(0.6)
const remaining = ref(phases[0].dur)
const cycles = ref(0)
let timer: number | null = null

const phaseName = computed(() => (running.value ? phases[idx.value].name : '准备'))
const transSec = computed(() => (running.value ? phases[idx.value].dur : 0.6))
const hint = computed(() => {
  if (!running.value) return '跟随圆圈，慢慢呼吸，放松身心'
  const map: Record<string, string> = {
    吸气: '用鼻子缓缓吸气',
    屏息: '轻轻屏住呼吸',
    呼气: '用嘴巴慢慢呼出'
  }
  return map[phaseName.value] ?? ''
})

function applyPhase(): void {
  const p = phases[idx.value]
  scale.value = p.scale
  remaining.value = p.dur
}

function start(): void {
  if (running.value) return
  running.value = true
  cycles.value = 0
  idx.value = 0
  applyPhase()
  timer = window.setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      idx.value = (idx.value + 1) % phases.length
      if (idx.value === 0) cycles.value += 1
      applyPhase()
    }
  }, 1000)
}

function stop(): void {
  running.value = false
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
  scale.value = 0.6
}

function toggle(): void {
  if (running.value) stop()
  else start()
}

onUnmounted(stop)
</script>

<template>
  <div class="page narrow breathe">
    <div class="stage card">
      <div
        class="orb"
        :style="{ transform: `scale(${scale})`, transitionDuration: `${transSec}s` }"
      >
        <div class="orb-inner">
          <p class="phase">{{ phaseName }}</p>
          <p v-if="running" class="count">{{ remaining }}</p>
        </div>
      </div>
      <p class="hint">{{ hint }}</p>
      <p class="cycles">已完成 {{ cycles }} 组呼吸</p>
      <button class="btn play" @click="toggle">{{ running ? '结束' : '开始' }}</button>
    </div>
    <p class="tip">课间来几组深呼吸，缓解久坐疲劳、快速回到专注状态。</p>
  </div>
</template>

<style scoped>
.narrow {
  max-width: 560px;
}
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 32px 34px;
}
.orb {
  width: 220px;
  height: 220px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 50% 40%,
    color-mix(in srgb, var(--accent) 85%, white),
    var(--accent) 70%
  );
  box-shadow: 0 12px 40px color-mix(in srgb, var(--accent) 45%, transparent);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
  margin: 18px 0 8px;
}
.orb-inner {
  color: #fff;
  text-align: center;
}
.phase {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
}
.count {
  font-size: 15px;
  opacity: 0.85;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.hint {
  margin-top: 22px;
  font-size: 14px;
  color: var(--text-secondary);
  min-height: 20px;
}
.cycles {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.btn.play {
  margin-top: 20px;
  width: 140px;
  height: 44px;
  border-radius: 100px;
  font-size: 15px;
}
.tip {
  margin-top: 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-tertiary);
  line-height: 1.6;
}
@media (prefers-reduced-motion: reduce) {
  .orb {
    transition-duration: 0.4s !important;
  }
}
</style>
