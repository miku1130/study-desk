<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'

const pomodoro = usePomodoroStore()
const settings = useSettingsStore()

const mmss = computed(
  () => `${String(pomodoro.minutes).padStart(2, '0')}:${String(pomodoro.seconds).padStart(2, '0')}`
)

const bgStyle = computed(() => {
  const wp = settings.s.pomodoro.wallpaper
  return wp ? { backgroundImage: `url("${window.api.media.url(wp)}")` } : {}
})

function exit(): void {
  window.api.lockscreen.close()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') exit()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void pomodoro.init()
})

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="lock" :class="{ wp: !!settings.s.pomodoro.wallpaper }" :style="bgStyle">
    <div class="lock-inner">
      <p class="lock-phase">{{ pomodoro.phaseLabel }}</p>
      <p class="lock-time">{{ mmss }}</p>
      <p class="lock-meta">今日已完成 {{ pomodoro.completed }} 个番茄 · 专注，别分心</p>
      <button class="lock-exit" @click="exit">退出专注（Esc）</button>
    </div>
  </div>
</template>

<style scoped>
.lock {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 35%, #2b2b40, #050509 70%);
  background-size: cover;
  background-position: center;
  color: #fff;
  user-select: none;
}
.lock-inner {
  position: relative;
  text-align: center;
  padding: 60px;
  border-radius: 28px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(18px);
}
.lock.wp .lock-inner {
  background: rgba(0, 0, 0, 0.45);
}
.lock-phase {
  font-size: 22px;
  letter-spacing: 2px;
  opacity: 0.85;
  margin-bottom: 10px;
}
.lock-time {
  font-size: 140px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.5);
}
.lock-meta {
  margin-top: 18px;
  font-size: 15px;
  opacity: 0.7;
}
.lock-exit {
  margin-top: 36px;
  padding: 10px 22px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 13.5px;
  transition: background 0.15s ease;
}
.lock-exit:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
