<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{ close: [] }>()
const pomodoro = usePomodoroStore()
const settings = useSettingsStore()

const displaySeconds = computed(() =>
  pomodoro.phase === 'idle' ? settings.s.pomodoro.workMin * 60 : pomodoro.remaining
)
const mm = computed(() => String(Math.floor(displaySeconds.value / 60)).padStart(2, '0'))
const ss = computed(() => String(displaySeconds.value % 60).padStart(2, '0'))
const mmss = computed(() => `${mm.value}:${ss.value}`)
const digits = computed(() => [mm.value[0], mm.value[1], ss.value[0], ss.value[1]])
const style = computed(() => settings.s.pomodoro.lockStyle || 'minimal')

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="clock-fade" appear>
      <div class="clock-overlay">
        <button class="close-x" aria-label="关闭" @click="emit('close')">✕</button>
        <div class="clock-inner">
          <p class="c-phase">{{ pomodoro.phaseLabel }}</p>

          <p v-if="style === 'minimal'" class="c-time minimal">{{ mmss }}</p>

          <div v-else-if="style === 'flip'" class="flip">
            <span class="flip-card">{{ digits[0] }}</span>
            <span class="flip-card">{{ digits[1] }}</span>
            <span class="flip-colon">:</span>
            <span class="flip-card">{{ digits[2] }}</span>
            <span class="flip-card">{{ digits[3] }}</span>
          </div>

          <p v-else-if="style === 'pixel'" class="c-time pixel">{{ mmss }}</p>

          <div v-else class="breath">
            <span class="breath-glow" />
            <span class="breath-time">{{ mmss }}</span>
          </div>

          <p class="c-meta">今日已完成 {{ pomodoro.completed }} 个番茄</p>
          <div class="c-actions">
            <button class="c-btn primary" @click="pomodoro.toggle()">
              {{ pomodoro.running ? '暂停' : '开始' }}
            </button>
            <button class="c-btn" @click="emit('close')">关闭</button>
          </div>
          <p class="c-hint">按 Esc 关闭弹窗</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.clock-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 35%, #2b2b40, #050509 70%);
  color: #fff;
  user-select: none;
}
.close-x {
  position: absolute;
  top: 22px;
  right: 26px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 16px;
  transition: background 0.15s ease;
}
.close-x:hover {
  background: rgba(255, 255, 255, 0.22);
}
.clock-inner {
  text-align: center;
  padding: 60px;
}
.c-phase {
  font-size: 22px;
  letter-spacing: 2px;
  opacity: 0.85;
  margin-bottom: 12px;
}

.c-time.minimal {
  font-size: 140px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.5);
}

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

.c-time.pixel {
  font-family: 'DS-Digital', 'Courier New', ui-monospace, monospace;
  font-size: 132px;
  font-weight: 700;
  letter-spacing: 10px;
  line-height: 1;
  color: #35ff9b;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(53, 255, 155, 0.9), 0 0 26px rgba(53, 255, 155, 0.55);
}

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

.c-meta {
  margin-top: 24px;
  font-size: 15px;
  opacity: 0.7;
}
.c-actions {
  margin-top: 26px;
  display: flex;
  gap: 14px;
  justify-content: center;
}
.c-btn {
  padding: 11px 26px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s ease, filter 0.15s ease;
}
.c-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
.c-btn.primary {
  background: var(--accent);
  border-color: transparent;
}
.c-btn.primary:hover {
  filter: brightness(1.1);
}
.c-hint {
  margin-top: 16px;
  font-size: 12.5px;
  opacity: 0.5;
}

.clock-fade-enter-active,
.clock-fade-leave-active {
  transition: opacity 0.2s var(--ease);
}
.clock-fade-enter-from,
.clock-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .breath-glow {
    animation: none;
  }
}
</style>
