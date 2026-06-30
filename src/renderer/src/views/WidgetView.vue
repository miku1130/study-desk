<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useClock } from '@/composables/useClock'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { usePomodoroStore } from '@/stores/pomodoro'

const { now } = useClock()
const { current, next } = useTimetableStatus()
const pomodoro = usePomodoroStore()

const timeText = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
)
const mmss = computed(
  () => `${String(pomodoro.minutes).padStart(2, '0')}:${String(pomodoro.seconds).padStart(2, '0')}`
)
const classText = computed(() => {
  if (current.value) return `正在上：${current.value.name}`
  if (next.value) return `下节 ${next.value.period.start} ${next.value.name}`
  return '今日无更多课程'
})

onMounted(() => pomodoro.init())

function openMain(): void {
  window.api.window.show()
}
function close(): void {
  window.api.widget.close()
}
</script>

<template>
  <div class="widget">
    <div class="w-top">
      <span class="w-time">{{ timeText }}</span>
      <div class="w-actions">
        <button class="w-btn" title="打开主界面" @click="openMain">⬚</button>
        <button class="w-btn" title="关闭浮窗" @click="close">✕</button>
      </div>
    </div>
    <div class="w-class">{{ classText }}</div>
    <div class="w-pomo">
      <span class="w-pomo-time" :class="{ run: pomodoro.running }">
        {{ pomodoro.phase === 'idle' ? '番茄钟' : mmss }}
      </span>
      <button class="w-play" @click="pomodoro.toggle()">
        {{ pomodoro.running ? '暂停' : '开始' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.widget {
  height: 100vh;
  background: var(--app-bg);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  -webkit-app-region: drag;
  border: 1px solid var(--separator);
  border-radius: 14px;
  overflow: hidden;
}
.w-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.w-time {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.w-actions {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}
.w-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 11px;
}
.w-btn:hover {
  background: var(--hover);
}
.w-class {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 6px 0 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.w-pomo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: no-drag;
  margin-top: auto;
}
.w-pomo-time {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.w-pomo-time.run {
  color: var(--accent);
}
.w-play {
  height: 28px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
}
</style>
