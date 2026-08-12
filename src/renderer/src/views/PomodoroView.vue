<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'
import { useTodoStore } from '@/stores/todos'
import UrlPromptModal from '@/components/UrlPromptModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import PetRoom from '@/components/pet/PetRoom.vue'
import PetCompanionView from '@/views/PetCompanionView.vue'
import GardenView from '@/views/GardenView.vue'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import type { PetVisualState } from '@/lib/petAssets'
import { CHIME_PRESETS, playChime } from '@/lib/audio'
import type { PomodoroMode } from '@/types'

const pomodoro = usePomodoroStore()
const settings = useSettingsStore()
const todos = useTodoStore()
const router = useRouter()
const route = useRoute()
const pet = usePetCompanionStore()
const timetable = useTimetableStatus()

type FocusSpaceTab = 'timer' | 'room' | 'garden'
const activeTab = computed<FocusSpaceTab>(() => {
  const tab = String(route.query.tab ?? 'timer')
  return tab === 'room' || tab === 'garden' ? tab : 'timer'
})
const petVisualState = computed<PetVisualState>(() => {
  if ((pomodoro.phase === 'work' && pomodoro.running) || timetable.current.value) return 'focus'
  if (pomodoro.phase === 'work') return 'paused'
  if (pomodoro.phase === 'short' || pomodoro.phase === 'long') return 'break'
  return 'idle'
})
const petStatus = computed(() => {
  if (timetable.current.value) return `正在陪你上「${timetable.current.value.name}」`
  if (pomodoro.phase === 'work' && pomodoro.running) return `一起写完这一页 · ${mm.value}:${ss.value}`
  if (pomodoro.phase === 'work') return '计时暂停，猫还在原地等你'
  return '猫已经把纸笔摆好了'
})

function setTab(tab: FocusSpaceTab): void {
  void router.replace({ path: '/pomodoro', query: tab === 'timer' ? {} : { tab } })
}

const showUrl = ref(false)
const urlTarget = ref<'wallpaper' | 'sound'>('wallpaper')

function toggleClockWidget(): void {
  window.api.clockWidget.toggle()
}

const C = 2 * Math.PI * 100

const MODE_OPTIONS: Array<{ key: PomodoroMode; label: string; hint: string }> = [
  { key: 'countdown', label: '倒计时', hint: '到点自动进入休息，标准番茄钟' },
  { key: 'countup', label: '正计时', hint: '不设终点，专注多久记多久' },
  { key: 'untimed', label: '不计时', hint: '不盯着数字，只记开始和结束' }
]
const DURATION_PRESETS = [15, 25, 45, 60, 90]

/** 空闲时随便切；已经开始的一段沿用起步时选的方式 */
const selectedMode = computed<PomodoroMode>(() =>
  pomodoro.phase === 'idle' ? (settings.s.pomodoro.mode ?? 'countdown') : pomodoro.mode
)
const plannedMinutes = computed(
  () => settings.s.pomodoro.lastMinutes || settings.s.pomodoro.workMin || 25
)
const customMinutes = ref(plannedMinutes.value)

function pickMode(mode: PomodoroMode): void {
  if (pomodoro.phase !== 'idle') return
  settings.s.pomodoro.mode = mode
  settings.save()
}

function pickMinutes(minutes: number): void {
  const value = Math.min(600, Math.max(1, Math.floor(minutes || 1)))
  customMinutes.value = value
  settings.s.pomodoro.lastMinutes = value
  settings.save()
}

async function onPlay(): Promise<void> {
  if (pomodoro.phase !== 'idle') {
    await pomodoro.toggle()
    return
  }
  await pomodoro.start({
    mode: selectedMode.value,
    minutes: plannedMinutes.value,
    targetId: todos.activeItem?.id ?? '',
    targetName: todos.activeItem?.text ?? ''
  })
}

const displaySeconds = computed(() => {
  if (pomodoro.phase === 'idle') {
    return selectedMode.value === 'countdown' ? plannedMinutes.value * 60 : 0
  }
  return pomodoro.displaySeconds
})
/** 不计时模式的意义就是别盯着数字，所以只在休息段显示时间 */
const hideDigits = computed(() => selectedMode.value === 'untimed' && pomodoro.phase === 'work')
const mm = computed(() => String(Math.floor(displaySeconds.value / 60)).padStart(2, '0'))
const ss = computed(() => String(displaySeconds.value % 60).padStart(2, '0'))
const dashoffset = computed(() => (pomodoro.total > 0 ? C * (1 - pomodoro.progress) : C))

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
async function pickWallpaperOnline(): Promise<void> {
  const p = await window.api.media.download(`https://picsum.photos/1920/1080?random=${Date.now()}`)
  if (p) {
    settings.s.pomodoro.wallpaper = p
    settings.save()
  }
}
function clearWallpaper(): void {
  settings.s.pomodoro.wallpaper = ''
  settings.save()
}
function openUrl(target: 'wallpaper' | 'sound'): void {
  urlTarget.value = target
  showUrl.value = true
}
async function onUrlConfirm(url: string): Promise<void> {
  const p = await window.api.media.download(url)
  showUrl.value = false
  if (!p) return
  if (urlTarget.value === 'wallpaper') settings.s.pomodoro.wallpaper = p
  else settings.s.pomodoro.sound = p
  settings.save()
}

function soundLabel(v: string): string {
  if (v.startsWith('chime:')) {
    return '预设 · ' + (CHIME_PRESETS.find((p) => 'chime:' + p.id === v)?.label ?? '')
  }
  if (v) return v.split(/[\\/]/).pop() ?? v
  return '默认（清脆双音）'
}
function presetVal(): string {
  const v = settings.s.pomodoro.sound
  return v.startsWith('chime:') ? v.slice(6) : v ? '__file__' : ''
}
function onPreset(e: Event): void {
  const id = (e.target as HTMLSelectElement).value
  if (id === '__file__') return
  settings.s.pomodoro.sound = id ? `chime:${id}` : ''
  settings.save()
}
function testSound(): void {
  const v = settings.s.pomodoro.sound
  if (v.startsWith('chime:')) playChime(v.slice(6), settings.s.pomodoro.volume)
  else if (v) {
    const a = new Audio(window.api.media.url(v))
    a.volume = settings.s.pomodoro.volume
    void a.play().catch(() => playChime('ding', settings.s.pomodoro.volume))
  } else playChime('ding', settings.s.pomodoro.volume)
}
</script>

<template>
  <div class="page focus-space">
    <nav class="focus-space-nav" aria-label="专注空间分区">
      <button :class="{ active: activeTab === 'timer' }" @click="setTab('timer')">
        <AppIcon name="timer" :size="16" />计时
      </button>
      <button :class="{ active: activeTab === 'room' }" @click="setTab('room')">
        <AppIcon name="sparkle" :size="16" />猫咪小屋
      </button>
      <button :class="{ active: activeTab === 'garden' }" @click="setTab('garden')">
        <AppIcon name="tree" :size="16" />专注花园
      </button>
    </nav>

    <div v-if="activeTab === 'timer'" class="timer-pane">
      <div class="timer-focus-grid">
        <div class="timer-card card">
      <div v-if="todos.activeItem" class="bound-task">
        <span class="bound-label">正在专注</span>
        <strong>{{ todos.activeItem.text }}</strong>
        <span class="bound-count">
          <AppIcon name="tomato" :size="12" />{{ todos.activeItem.pomodoros }}{{ todos.activeItem.estimatePomodoros ? ` / ${todos.activeItem.estimatePomodoros}` : '' }}
        </span>
        <button class="bound-clear" title="解除绑定" @click="todos.focusOn(todos.activeId)">
          <AppIcon name="x" :size="12" />
        </button>
      </div>
      <button v-else class="bound-empty" @click="router.push('/todo')">
        绑定一个任务，完成的番茄会自动记到它头上 →
      </button>

      <div class="mode-picker" role="group" aria-label="计时方式">
        <button
          v-for="item in MODE_OPTIONS"
          :key="item.key"
          type="button"
          class="mode-btn"
          :class="{ active: selectedMode === item.key }"
          :disabled="pomodoro.phase !== 'idle'"
          :title="pomodoro.phase === 'idle' ? item.hint : '这一段结束后才能换计时方式'"
          @click="pickMode(item.key)"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="selectedMode === 'countdown' && pomodoro.phase === 'idle'" class="dur-picker">
        <button
          v-for="min in DURATION_PRESETS"
          :key="min"
          type="button"
          class="dur-chip"
          :class="{ active: plannedMinutes === min }"
          @click="pickMinutes(min)"
        >
          {{ min }}
        </button>
        <input
          v-model.number="customMinutes"
          class="input input-sm dur-custom"
          type="number"
          min="1"
          max="600"
          aria-label="自定义分钟数"
          @change="pickMinutes(customMinutes)"
        />
        <span class="unit">分</span>
      </div>
      <p v-else-if="pomodoro.phase === 'idle'" class="mode-hint">
        {{ MODE_OPTIONS.find((m) => m.key === selectedMode)?.hint }}
      </p>

      <div class="ring-wrap">
        <svg viewBox="0 0 220 220" class="ring">
          <circle class="ring-bg" :class="{ open: pomodoro.total === 0 && pomodoro.running }" cx="110" cy="110" r="100" />
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
          <p v-if="hideDigits" class="time untimed">在学</p>
          <p v-else class="time">{{ mm }}:{{ ss }}</p>
          <p class="cycles">今日 {{ pomodoro.completed }} 个番茄</p>
        </div>
      </div>
      <div class="controls">
        <button class="btn-icon lg" aria-label="重置" title="重置" @click="pomodoro.reset()">
          <AppIcon name="rotate-ccw" :size="18" />
        </button>
        <button class="btn play" @click="onPlay">
          <AppIcon :name="pomodoro.running ? 'pause' : 'play'" :size="15" :stroke-width="2.1" />
          {{ pomodoro.running ? '暂停' : '开始' }}
        </button>
        <button
          v-if="pomodoro.needsManualFinish"
          class="btn-icon lg"
          aria-label="结束本段"
          title="结束这一段并记账"
          @click="pomodoro.finish()"
        >
          <AppIcon name="check" :size="18" />
        </button>
        <button
          v-else
          class="btn-icon lg"
          aria-label="跳过"
          title="跳过当前阶段"
          @click="pomodoro.skip()"
        >
          <AppIcon name="skip-forward" :size="18" />
        </button>
      </div>
      <button class="btn btn-secondary btn-sm clock-summon" @click="toggleClockWidget">
        呼出时钟小浮窗
      </button>
        </div>
        <PetRoom
          :state="petVisualState"
          :cat-id="pet.catId"
          :room-id="pet.roomId"
          :furniture-id="pet.furnitureId"
          :cat-name="pet.selectedCat.name"
          :status="petStatus"
          :keepsake="pet.lastKeepsake"
        />
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
          <p class="s-title">锁屏时钟样式</p>
          <p class="s-sub">全屏专注时的时钟外观</p>
        </div>
        <select
          class="input input-sm select"
          v-model="settings.s.pomodoro.lockStyle"
          @change="save"
        >
          <option value="minimal">极简</option>
          <option value="flip">翻页钟</option>
          <option value="pixel">像素 LED</option>
          <option value="breathing">呼吸光</option>
        </select>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">专注壁纸</p>
          <p class="s-sub">{{ fileName(settings.s.pomodoro.wallpaper) }}</p>
        </div>
        <div class="row wrap">
          <button class="btn btn-secondary btn-sm" @click="pickWallpaperOnline">随机在线</button>
          <button class="btn btn-secondary btn-sm" @click="openUrl('wallpaper')">从链接</button>
          <button class="btn btn-secondary btn-sm" @click="pickWallpaper">本地</button>
          <button class="btn btn-secondary btn-sm" @click="clearWallpaper">默认</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">完成提示音</p>
          <p class="s-sub">{{ soundLabel(settings.s.pomodoro.sound) }}</p>
        </div>
        <div class="row wrap">
          <select class="input input-sm select" :value="presetVal()" @change="onPreset($event)">
            <option value="">默认</option>
            <option v-for="p in CHIME_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
            <option value="__file__" disabled>自定义文件</option>
          </select>
          <button class="btn btn-secondary btn-sm" @click="testSound">试听</button>
          <button class="btn btn-secondary btn-sm" @click="openUrl('sound')">链接</button>
          <button class="btn btn-secondary btn-sm" @click="pickSound">本地</button>
        </div>
      </div>
    </div>

    <UrlPromptModal
      v-if="showUrl"
      :title="urlTarget === 'wallpaper' ? '在线壁纸链接' : '在线提示音链接'"
      :placeholder="urlTarget === 'wallpaper' ? '图片直链 (jpg/png/webp)…' : '音频直链 (mp3/ogg/wav)…'"
      @confirm="onUrlConfirm"
      @close="showUrl = false"
    />
    </div>
    <PetCompanionView v-else-if="activeTab === 'room'" />
    <GardenView v-else />
  </div>
</template>

<style scoped>
.row.wrap {
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>

<style scoped>
.focus-space {
  max-width: 1180px;
}
.focus-space-nav {
  display: inline-flex;
  gap: 3px;
  margin-bottom: 14px;
  padding: 3px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-muted);
}
.focus-space-nav button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 690;
}
.focus-space-nav button.active {
  background: var(--surface-raised);
  color: var(--accent-strong);
  box-shadow: 0 1px 3px rgba(18, 27, 23, 0.09);
}
.timer-focus-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.78fr) minmax(500px, 1.22fr);
  gap: 16px;
  align-items: stretch;
  margin-bottom: 20px;
}
.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  margin-bottom: 0;
}
.bound-task {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  margin-bottom: 18px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  background: var(--accent-soft);
  font-size: 12.5px;
}
.bound-label {
  color: var(--accent);
  font-weight: 800;
  flex-shrink: 0;
}
.bound-task strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bound-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.bound-clear {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  flex-shrink: 0;
  padding: 2px;
}
.bound-clear:hover {
  color: #ff453a;
}
.bound-empty {
  border: 1px dashed var(--separator);
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 999px;
  padding: 8px 14px;
  margin-bottom: 18px;
  font-size: 12.5px;
  font-weight: 600;
}
.bound-empty:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.mode-picker {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  margin-bottom: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-muted);
}
.mode-btn {
  min-height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 680;
}
.mode-btn.active {
  background: var(--surface-raised);
  color: var(--accent-strong);
  box-shadow: 0 1px 3px rgba(18, 27, 23, 0.09);
}
.mode-btn:disabled {
  opacity: 0.55;
}
.dur-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 14px;
}
.dur-chip {
  min-width: 42px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--separator);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.dur-chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.dur-custom {
  width: 66px;
  text-align: center;
}
.mode-hint {
  margin-bottom: 14px;
  color: var(--text-tertiary);
  font-size: 12px;
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
/* 没有终点的模式画不出进度，用一圈呼吸表示还在走 */
.ring-bg.open {
  stroke: var(--accent);
  animation: ring-breathe 4s ease-in-out infinite;
}
@keyframes ring-breathe {
  50% {
    opacity: 0.42;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ring-bg.open {
    animation: none;
    opacity: 0.6;
  }
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
.time.untimed {
  font-size: 40px;
  letter-spacing: 0.08em;
  color: var(--accent-strong);
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
.clock-summon {
  margin-top: 18px;
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
@media (max-width: 1050px) {
  .timer-focus-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 650px) {
  .focus-space-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }
  .focus-space-nav button {
    padding-inline: 8px;
  }
}
</style>
