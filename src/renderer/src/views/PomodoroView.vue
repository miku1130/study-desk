<script setup lang="ts">
import { computed } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'

const pomodoro = usePomodoroStore()
const settings = useSettingsStore()

const C = 2 * Math.PI * 100

const displaySeconds = computed(() =>
  pomodoro.phase === 'idle' ? settings.s.pomodoro.workMin * 60 : pomodoro.remaining
)
const mm = computed(() => String(Math.floor(displaySeconds.value / 60)).padStart(2, '0'))
const ss = computed(() => String(displaySeconds.value % 60).padStart(2, '0'))
const dashoffset = computed(() => C * (1 - pomodoro.progress))

function save(): void {
  const p = settings.s.pomodoro
  p.workMin = Math.max(1, Math.floor(p.workMin || 1))
  p.shortBreakMin = Math.max(1, Math.floor(p.shortBreakMin || 1))
  p.longBreakMin = Math.max(1, Math.floor(p.longBreakMin || 1))
  p.longBreakEvery = Math.max(1, Math.floor(p.longBreakEvery || 1))
  settings.save()
}

function fileName(p: string): string {
  return p ? (p.split(/[\\/]/).pop() ?? p) : '未选择'
}
async function pickWallpaper(): Promise<void> {
  const p = await window.api.dialog.openFile([
    { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }
  ])
  if (p) {
    settings.s.pomodoro.wallpaper = p
    settings.save()
  }
}
async function pickSound(): Promise<void> {
  const p = await window.api.dialog.openFile([
    { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }
  ])
  if (p) {
    settings.s.pomodoro.sound = p
    settings.save()
  }
}
</script>

<template>
  <div class="page narrow">
    <div class="timer-card card">
      <div class="ring-wrap">
        <svg viewBox="0 0 220 220" class="ring">
          <circle class="ring-bg" cx="110" cy="110" r="100" />
          <circle
            class="ring-fg"
            cx="110"
            cy="110"
            r="100"
            :stroke-dasharray="C"
            :stroke-dashoffset="dashoffset"
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div class="ring-center">
          <p class="phase" :class="pomodoro.phase">{{ pomodoro.phaseLabel }}</p>
          <p class="time">{{ mm }}:{{ ss }}</p>
          <p class="cycles">今日 {{ pomodoro.completed }} 个番茄</p>
        </div>
      </div>
      <div class="controls">
        <button class="btn-icon lg" aria-label="重置" @click="pomodoro.reset()">↺</button>
        <button class="btn play" @click="pomodoro.toggle()">
          {{ pomodoro.running ? '暂停' : '开始' }}
        </button>
        <button class="btn-icon lg" aria-label="跳过" @click="pomodoro.skip()">⏭</button>
      </div>
    </div>

    <h3 class="section-title">番茄设置</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">专注时长</p>
          <p class="s-sub">每个番茄的工作分钟数</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.pomodoro.workMin"
            class="input input-sm num"
            type="number"
            min="1"
            @change="save"
          />
          <span class="unit">分</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">短休息</p>
          <p class="s-sub">每个番茄后的休息</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.pomodoro.shortBreakMin"
            class="input input-sm num"
            type="number"
            min="1"
            @change="save"
          />
          <span class="unit">分</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">长休息</p>
          <p class="s-sub">达到次数后的长休息</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.pomodoro.longBreakMin"
            class="input input-sm num"
            type="number"
            min="1"
            @change="save"
          />
          <span class="unit">分</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">长休息间隔</p>
          <p class="s-sub">每几个番茄触发一次长休息</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.pomodoro.longBreakEvery"
            class="input input-sm num"
            type="number"
            min="1"
            @change="save"
          />
          <span class="unit">个</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">自动开始下一阶段</p>
          <p class="s-sub">阶段结束后自动进入下一段</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.pomodoro.autoStart" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">锁屏壁纸专注</p>
          <p class="s-sub">专注时全屏显示倒计时，防止分心</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.pomodoro.lockscreen" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">专注壁纸</p>
          <p class="s-sub">{{ fileName(settings.s.pomodoro.wallpaper) }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="pickWallpaper">选择图片</button>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">完成提示音</p>
          <p class="s-sub">{{ fileName(settings.s.pomodoro.sound) }}（留空用默认提示音）</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="pickSound">选择音频</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.narrow {
  max-width: 600px;
}
.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  margin-bottom: 18px;
}
.ring-wrap {
  position: relative;
  width: 260px;
  height: 260px;
}
.ring {
  width: 100%;
  height: 100%;
}
.ring-bg {
  fill: none;
  stroke: var(--active);
  stroke-width: 14;
}
.ring-fg {
  fill: none;
  stroke: var(--accent);
  stroke-width: 14;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s var(--ease);
}
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.phase {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}
.phase.work {
  color: var(--accent);
}
.time {
  font-size: 56px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.cycles {
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 26px;
}
.btn-icon.lg {
  width: 46px;
  height: 46px;
  font-size: 18px;
  border-radius: 50%;
}
.btn.play {
  width: 130px;
  height: 46px;
  font-size: 15px;
  border-radius: 100px;
}
.num {
  width: 64px;
  text-align: center;
}
.unit {
  font-size: 12.5px;
  color: var(--text-secondary);
}
</style>
