<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'

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

onMounted(() => pomodoro.init())

function openMain(): void {
  window.api.window.show()
}
function close(): void {
  window.api.clockWidget.toggle()
}
</script>

<template>
  <div class="cw" :class="'st-' + style">
    <div class="cw-top">
      <span class="cw-phase">{{ pomodoro.phaseLabel }}</span>
      <div class="cw-actions">
        <button class="cw-btn" title="打开主界面" @click="openMain">⬚</button>
        <button class="cw-btn" title="关闭浮窗" @click="close">✕</button>
      </div>
    </div>

    <div class="cw-clock">
      <span v-if="style === 'minimal'" class="cw-time">{{ mmss }}</span>
      <span v-else-if="style === 'pixel'" class="cw-time pixel">{{ mmss }}</span>
      <div v-else-if="style === 'flip'" class="cw-flip">
        <span class="fc">{{ digits[0] }}</span>
        <span class="fc">{{ digits[1] }}</span>
        <span class="fcolon">:</span>
        <span class="fc">{{ digits[2] }}</span>
        <span class="fc">{{ digits[3] }}</span>
      </div>
      <div v-else class="cw-breath">
        <span class="bglow" />
        <span class="cw-time">{{ mmss }}</span>
      </div>
    </div>

    <div class="cw-bottom">
      <span class="cw-count">今日 {{ pomodoro.completed }} 🍅</span>
      <button class="cw-play" @click="pomodoro.toggle()">
        {{ pomodoro.running ? '暂停' : '开始' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cw {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 10px 14px 12px;
  color: #fff;
  background: radial-gradient(circle at 50% 20%, #2b2b40, #08080c 75%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  -webkit-app-region: drag;
  user-select: none;
}
.cw-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cw-phase {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.8;
}
.cw-actions {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}
.cw-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  border-radius: 6px;
  font-size: 11px;
}
.cw-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
.cw-clock {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cw-time {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
}
.cw-time.pixel {
  font-family: 'DS-Digital', 'Courier New', ui-monospace, monospace;
  letter-spacing: 4px;
  color: #35ff9b;
  text-shadow: 0 0 6px rgba(53, 255, 155, 0.9);
}
.cw-flip {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fc {
  width: 34px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, #3a3a42, #202027);
  border-radius: 7px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.fcolon {
  font-size: 26px;
  font-weight: 700;
  opacity: 0.85;
}
.cw-breath {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 60px;
}
.bglow {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent), transparent 68%);
  filter: blur(4px);
  animation: cwbreathe 8s ease-in-out infinite;
}
@keyframes cwbreathe {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}
.cw-bottom {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cw-count {
  font-size: 12px;
  opacity: 0.7;
}
.cw-play {
  height: 26px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.cw-play:hover {
  filter: brightness(1.1);
}
@media (prefers-reduced-motion: reduce) {
  .bglow {
    animation: none;
  }
}
</style>
