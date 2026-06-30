<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTimetableStore } from '@/stores/timetable'
import UrlPromptModal from '@/components/UrlPromptModal.vue'
import type { ThemeMode, TimetableData } from '@/types'

const settings = useSettingsStore()
const timetable = useTimetableStore()

const themes: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]
const accents = ['#0a84ff', '#30d158', '#ff453a', '#ff9f0a', '#bf5af2', '#ff375f']

const version = ref('0.1.0')
const updateState = ref('')
const updateText = ref('点击检查是否有新版本')
let unsubUpdate: (() => void) | null = null

onMounted(async () => {
  version.value = await window.api.app.getVersion()
  unsubUpdate = window.api.update.onStatus((s) => {
    const st = s as { state: string; version?: string; percent?: number }
    updateState.value = st.state
    if (st.state === 'checking') updateText.value = '正在检查更新…'
    else if (st.state === 'available') updateText.value = `发现新版本 ${st.version}，正在下载…`
    else if (st.state === 'downloading') updateText.value = `下载中 ${st.percent}%`
    else if (st.state === 'downloaded') updateText.value = `新版本 ${st.version} 已就绪`
    else if (st.state === 'none') updateText.value = '已是最新版本'
    else if (st.state === 'error') updateText.value = '检查更新失败'
  })
})
onUnmounted(() => unsubUpdate?.())

async function checkUpdate(): Promise<void> {
  const r = (await window.api.update.check()) as { state?: string }
  if (r?.state === 'dev') updateText.value = '开发模式不检查更新（打包安装后生效）'
  else if (r?.state === 'error') updateText.value = '检查更新失败'
}
function installUpdate(): void {
  window.api.update.install()
}

function setTheme(t: ThemeMode): void {
  settings.s.theme = t
  settings.save()
}
function setAccent(c: string): void {
  settings.s.accent = c
  settings.save()
}
function save(): void {
  settings.save()
}
function saveWater(): void {
  const w = settings.s.water
  w.intervalMin = Math.max(5, Math.floor(w.intervalMin || 60))
  w.goalCups = Math.max(1, Math.floor(w.goalCups || 8))
  settings.save()
}
function saveHealth(): void {
  const h = settings.s.health
  h.sitIntervalMin = Math.max(5, Math.floor(h.sitIntervalMin || 45))
  h.eyeIntervalMin = Math.max(5, Math.floor(h.eyeIntervalMin || 30))
  settings.save()
}
async function doBackupExport(): Promise<void> {
  await window.api.backup.export()
}
async function doBackupImport(): Promise<void> {
  await window.api.backup.import()
}

const showAppBgUrl = ref(false)
async function pickAppBgLocal(): Promise<void> {
  const p = await window.api.dialog.openFile([
    { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
  ])
  if (p) {
    settings.s.appBg = p
    settings.save()
  }
}
async function pickAppBgOnline(): Promise<void> {
  const p = await window.api.media.download(`https://picsum.photos/1920/1080?random=${Date.now()}`)
  if (p) {
    settings.s.appBg = p
    settings.save()
  }
}
async function onAppBgUrl(url: string): Promise<void> {
  const p = await window.api.media.download(url)
  showAppBgUrl.value = false
  if (p) {
    settings.s.appBg = p
    settings.save()
  }
}
function clearAppBg(): void {
  settings.s.appBg = ''
  settings.save()
}
function onAppBgOpacity(e: Event): void {
  settings.s.appBgOpacity = (e.target as HTMLInputElement).valueAsNumber
  settings.save()
}

function fileName(p: string): string {
  return p ? (p.split(/[\\/]/).pop() ?? p) : '未选择'
}
async function pickBellSound(which: 'onSound' | 'offSound'): Promise<void> {
  const p = await window.api.dialog.openFile([
    { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }
  ])
  if (p) {
    settings.s.bell[which] = p
    settings.save()
  }
}

const showBellUrl = ref(false)
const bellTarget = ref<'onSound' | 'offSound'>('onSound')
function openBellUrl(which: 'onSound' | 'offSound'): void {
  bellTarget.value = which
  showBellUrl.value = true
}
async function onBellUrl(url: string): Promise<void> {
  const p = await window.api.media.download(url)
  showBellUrl.value = false
  if (p) {
    settings.s.bell[bellTarget.value] = p
    settings.save()
  }
}
function onBellVolume(e: Event): void {
  settings.s.bell.volume = (e.target as HTMLInputElement).valueAsNumber
  settings.save()
}

async function exportTimetable(): Promise<void> {
  await window.api.timetable.export()
}
async function importTimetable(): Promise<void> {
  const data = (await window.api.timetable.import()) as TimetableData | null
  if (data) timetable.replaceAll(data)
}
</script>

<template>
  <div class="page">
    <h3 class="section-title">外观</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">主题</p>
          <p class="s-sub">选择浅色、深色，或跟随系统</p>
        </div>
        <div class="seg">
          <button
            v-for="t in themes"
            :key="t.value"
            class="seg-btn"
            :class="{ active: settings.s.theme === t.value }"
            @click="setTheme(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">强调色</p>
          <p class="s-sub">用于高亮、按钮与选中态</p>
        </div>
        <div class="swatches">
          <button
            v-for="c in accents"
            :key="c"
            class="swatch"
            :class="{ active: settings.s.accent === c }"
            :style="{ background: c }"
            :aria-label="c"
            @click="setAccent(c)"
          />
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">应用背景图</p>
          <p class="s-sub">{{ settings.s.appBg ? '已设置（半透明叠加于界面）' : '未设置' }}</p>
        </div>
        <div class="row wrap">
          <button class="btn btn-secondary btn-sm" @click="pickAppBgOnline">随机在线</button>
          <button class="btn btn-secondary btn-sm" @click="showAppBgUrl = true">从链接</button>
          <button class="btn btn-secondary btn-sm" @click="pickAppBgLocal">本地</button>
          <button class="btn btn-secondary btn-sm" @click="clearAppBg">清除</button>
        </div>
      </div>
      <div v-if="settings.s.appBg" class="setting-row">
        <div>
          <p class="s-title">背景不透明度</p>
          <p class="s-sub">{{ Math.round(settings.s.appBgOpacity * 100) }}%</p>
        </div>
        <input
          type="range"
          min="0.03"
          max="0.6"
          step="0.01"
          :value="settings.s.appBgOpacity"
          @input="onAppBgOpacity"
        />
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">上下课铃声</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">启用铃声</p>
          <p class="s-sub">到点按课表自动响铃</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.bell.enabled" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">上课铃</p>
          <p class="s-sub">{{ fileName(settings.s.bell.onSound) }}</p>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-sm" @click="openBellUrl('onSound')">从链接</button>
          <button class="btn btn-secondary btn-sm" @click="pickBellSound('onSound')">本地</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">下课铃</p>
          <p class="s-sub">{{ fileName(settings.s.bell.offSound) }}</p>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-sm" @click="openBellUrl('offSound')">从链接</button>
          <button class="btn btn-secondary btn-sm" @click="pickBellSound('offSound')">本地</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">铃声音量</p>
          <p class="s-sub">{{ Math.round(settings.s.bell.volume * 100) }}%</p>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settings.s.bell.volume"
          @input="onBellVolume"
        />
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">喝水提醒</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">启用提醒</p>
          <p class="s-sub">按间隔弹出系统通知，记得补水</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.water.enabled" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">提醒间隔</p>
          <p class="s-sub">每隔多少分钟提醒一次</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.water.intervalMin"
            class="input input-sm num"
            type="number"
            min="5"
            @change="saveWater"
          />
          <span class="unit">分</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">每日目标</p>
          <p class="s-sub">仪表盘据此计算饮水进度</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.water.goalCups"
            class="input input-sm num"
            type="number"
            min="1"
            @change="saveWater"
          />
          <span class="unit">杯</span>
        </div>
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">健康提醒</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">久坐提醒</p>
          <p class="s-sub">久坐后提醒起身活动</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.health.sitEnabled" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">久坐间隔</p>
          <p class="s-sub">每隔多少分钟提醒</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.health.sitIntervalMin"
            class="input input-sm num"
            type="number"
            min="5"
            @change="saveHealth"
          />
          <span class="unit">分</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">护眼提醒</p>
          <p class="s-sub">20-20-20，定时远眺放松眼睛</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.health.eyeEnabled" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">护眼间隔</p>
          <p class="s-sub">每隔多少分钟提醒</p>
        </div>
        <div class="row">
          <input
            v-model.number="settings.s.health.eyeIntervalMin"
            class="input input-sm num"
            type="number"
            min="5"
            @change="saveHealth"
          />
          <span class="unit">分</span>
        </div>
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">通用</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">开机自启动</p>
          <p class="s-sub">登录系统后自动运行</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.autostart" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">桌面浮窗</p>
          <p class="s-sub">常驻置顶小窗：时钟 / 下节课 / 番茄计时（也可在托盘切换）</p>
        </div>
        <label class="switch">
          <input v-model="settings.s.widget" type="checkbox" @change="save" />
          <span class="slider" />
        </label>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">番茄钟开始/暂停热键</p>
          <p class="s-sub">全局快捷键，如 CommandOrControl+Alt+P</p>
        </div>
        <input
          v-model="settings.s.hotkeys.toggleTimer"
          class="input input-sm hk"
          @change="save"
        />
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">显示/隐藏窗口热键</p>
          <p class="s-sub">全局快捷键，如 CommandOrControl+Alt+S</p>
        </div>
        <input
          v-model="settings.s.hotkeys.toggleWindow"
          class="input input-sm hk"
          @change="save"
        />
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">课表数据</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">导入 / 导出课表</p>
          <p class="s-sub">以 JSON 备份或迁移课表与作息</p>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-sm" @click="importTimetable">导入</button>
          <button class="btn btn-secondary btn-sm" @click="exportTimetable">导出</button>
        </div>
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">数据备份</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">备份 / 恢复全部数据</p>
          <p class="s-sub">导出设置、课表、待办、统计、音乐、书架、倒数日等为单个 JSON</p>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-sm" @click="doBackupImport">导入恢复</button>
          <button class="btn btn-secondary btn-sm" @click="doBackupExport">导出备份</button>
        </div>
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 22px">关于与更新</h3>
    <div class="card">
      <div class="setting-row">
        <div>
          <p class="s-title">学习桌面 · StudyDesk</p>
          <p class="s-sub">版本 {{ version }} · Electron + Vue 3</p>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <p class="s-title">软件更新</p>
          <p class="s-sub">{{ updateText }}</p>
        </div>
        <button
          v-if="updateState !== 'downloaded'"
          class="btn btn-secondary btn-sm"
          @click="checkUpdate"
        >
          检查更新
        </button>
        <button v-else class="btn btn-sm" @click="installUpdate">立即重启更新</button>
      </div>
    </div>

    <UrlPromptModal
      v-if="showBellUrl"
      title="在线铃声链接"
      placeholder="音频直链 (mp3 / ogg / wav)…"
      @confirm="onBellUrl"
      @close="showBellUrl = false"
    />
    <UrlPromptModal
      v-if="showAppBgUrl"
      title="应用背景图链接"
      placeholder="图片直链 (jpg / png / webp)…"
      @confirm="onAppBgUrl"
      @close="showAppBgUrl = false"
    />
  </div>
</template>

<style scoped>
.swatches {
  display: flex;
  gap: 10px;
}
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px var(--separator);
  transition: transform 0.12s var(--ease);
}
.swatch:hover {
  transform: scale(1.12);
}
.swatch.active {
  box-shadow: 0 0 0 2px var(--accent);
}
.hk {
  width: 240px;
  text-align: center;
}
.num {
  width: 64px;
  text-align: center;
}
.unit {
  font-size: 12.5px;
  color: var(--text-secondary);
}
.row.wrap {
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
