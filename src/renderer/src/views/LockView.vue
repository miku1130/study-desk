<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'

const pomodoro = usePomodoroStore()
const settings = useSettingsStore()

const mmss = computed(
  () => `${String(pomodoro.minutes).padStart(2, '0')}:${String(pomodoro.seconds).padStart(2, '0')}`
)
const digits = computed(() => {
  const m = String(pomodoro.minutes).padStart(2, '0')
  const s = String(pomodoro.seconds).padStart(2, '0')
  return [m[0], m[1], s[0], s[1]]
})
const style = computed(() => settings.s.pomodoro.lockStyle || 'minimal')

const bgStyle = computed(() => {
  const wp = settings.s.pomodoro.wallpaper
  return wp ? { backgroundImage: `url("${window.api.media.url(wp)}")` } : {}
})

// 暂停 / 结束都会让计时停止，主进程随即关闭锁屏窗口（不再被每秒重新弹出）
function pause(): void {
  window.api.pomodoro.pause()
}
function end(): void {
  window.api.pomodoro.reset()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') pause()
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

      <!-- 极简 -->
      <p v-if="style === 'minimal'" class="lock-time minimal">{{ mmss }}</p>

      <!-- 翻页钟 -->
      <div v-else-if="style === 'flip'" class="flip">
        <span class="flip-card">{{ digits[0] }}</span>
        <span class="flip-card">{{ digits[1] }}</span>
        <span class="flip-colon">:</span>
        <span class="flip-card">{{ digits[2] }}</span>
        <span class="flip-card">{{ digits[3] }}</span>
      </div>

      <!-- 像素 LED -->
      <p v-else-if="style === 'pixel'" class="lock-time pixel">{{ mmss }}</p>

      <!-- 呼吸光 -->
      <div v-else class="breath">
        <span class="breath-glow" />
        <span class="breath-time">{{ mmss }}</span>
      </div>

      <p class="lock-meta">今日已完成 {{ pomodoro.completed }} 个番茄 · 专注，别分心</p>
      <div class="lock-actions">
        <button class="lock-btn" @click="pause">暂停</button>
        <button class="lock-btn primary" @click="end">结束专注</button>
      </div>
      <p class="lock-hint">按 Esc 暂停并退出</p>
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

/* 极简 */
.lock-time.minimal {
  font-size: 140px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.5);
}

/* 翻页钟 */
.flip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.flip-card {
  position: relative;
  width: 92px;
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 96px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f5f5f7;
  background: linear-gradient(180deg, #3a3a42, #202027);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.flip-card::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: rgba(0, 0, 0, 0.5);
  transform: translateY(-1px);
}
.flip-colon {
  font-size: 72px;
  font-weight: 700;
  opacity: 0.85;
}

/* 像素 LED */
.lock-time.pixel {
  font-family: 'DS-Digital', 'Courier New', ui-monospace, monospace;
  font-size: 132px;
  font-weight: 700;
  letter-spacing: 10px;
  line-height: 1;
  color: #35ff9b;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(53, 255, 155, 0.9), 0 0 26px rgba(53, 255, 155, 0.55);
}

/* 呼吸光 */
.breath {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.breath-glow {
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent), transparent 68%);
  filter: blur(6px);
  animation: breathe 8s ease-in-out infinite;
}
.breath-time {
  position: relative;
  font-size: 100px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}

.lock-meta {
  margin-top: 24px;
  font-size: 15px;
  opacity: 0.7;
}
.lock-actions {
  margin-top: 30px;
  display: flex;
  gap: 14px;
  justify-content: center;
}
.lock-btn {
  padding: 11px 26px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s ease;
}
.lock-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
.lock-btn.primary {
  background: #ff453a;
  border-color: transparent;
}
.lock-btn.primary:hover {
  filter: brightness(1.1);
}
.lock-hint {
  margin-top: 16px;
  font-size: 12.5px;
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .breath-glow {
    animation: none;
  }
}
</style>
