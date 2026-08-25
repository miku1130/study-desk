<script setup lang="ts">
import { computed, onMounted, shallowRef, type CSSProperties } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import WindowControls from '@/components/WindowControls.vue'
import SearchPalette from '@/components/SearchPalette.vue'
import UiFeedbackHost from '@/components/UiFeedbackHost.vue'
import UpdatePromptModal from '@/components/UpdatePromptModal.vue'
import StartupAnnouncementModal from '@/components/StartupAnnouncementModal.vue'
import LockView from '@/views/LockView.vue'
import WidgetView from '@/views/WidgetView.vue'
import ClockWidgetView from '@/views/ClockWidgetView.vue'
import DesktopWidgetView from '@/views/DesktopWidgetView.vue'
import PetWidgetView from '@/views/PetWidgetView.vue'
import { useSettingsStore } from '@/stores/settings'
import { useTimetableStore } from '@/stores/timetable'
import { useSchedulesStore } from '@/stores/schedules'
import { useTodoStore } from '@/stores/todos'
import { useStatsStore } from '@/stores/stats'
import { useMusicStore } from '@/stores/music'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useWaterStore } from '@/stores/water'
import { useBooksStore } from '@/stores/books'
import { useCountdownStore } from '@/stores/countdowns'
import { useGardenStore } from '@/stores/garden'
import { useDesktopWidgetsStore } from '@/stores/desktopWidgets'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useUiStore } from '@/stores/ui'
import { useGlobalEffects } from '@/composables/useGlobalEffects'
import { getGlassSurfaceAlphas } from '@/lib/appearance'

const route = useRoute()
const isLock = computed(() => route.name === 'lock')
const isWidget = computed(() => route.name === 'widget')
const isClockWidget = computed(() => route.name === 'clockwidget')
const isDesktopWidget = computed(() => route.name === 'desktop-widget')
const isPetWidget = computed(() => route.name === 'pet-widget')
const isDashboard = computed(() => route.name === 'dashboard' || route.path === '/')

const settings = useSettingsStore()
const timetable = useTimetableStore()
const schedules = useSchedulesStore()
const todos = useTodoStore()
const stats = useStatsStore()
const music = useMusicStore()
const pomodoro = usePomodoroStore()
const water = useWaterStore()
const books = useBooksStore()
const countdowns = useCountdownStore()
const garden = useGardenStore()
const desktopWidgets = useDesktopWidgetsStore()
const petCompanion = usePetCompanionStore()
const ui = useUiStore()

const appShellStyle = computed<CSSProperties>(() => {
  if (!settings.s.appBg) return {}

  const surfaces = getGlassSurfaceAlphas(settings.s.appBgOpacity)
  return {
    '--glass-sidebar-alpha': String(surfaces.sidebar),
    '--glass-content-alpha': String(surfaces.content),
    '--glass-card-alpha': String(surfaces.card),
    '--glass-raised-alpha': String(surfaces.raised),
    '--glass-muted-alpha': String(surfaces.muted),
    '--glass-sidebar-blur': `${surfaces.sidebarBlur}px`,
    '--glass-sidebar-saturation': `${surfaces.sidebarSaturation}%`,
    '--glass-toolbar-blur': `${surfaces.toolbarBlur}px`,
    '--glass-sidebar-shadow-alpha': String(surfaces.sidebarShadow)
  } as CSSProperties
})

const showSearch = shallowRef(false)
const qqCopied = shallowRef(false)
const QQ_GROUP = '1076144676'

function media(p: string): string {
  return window.api.media.url(p)
}

async function copyQQGroup(): Promise<void> {
  try {
    await navigator.clipboard.writeText(QQ_GROUP)
    qqCopied.value = true
    window.setTimeout(() => (qqCopied.value = false), 1400)
  } catch {
    qqCopied.value = false
  }
}

function openSearch(): void {
  showSearch.value = true
}

// 独立子窗口跳过全局音效、托盘与奖励，避免重复触发。
const initialHash = window.location.hash
const isIsolatedWindow =
  ['#/lock', '#/widget', '#/clockwidget'].includes(initialHash) ||
  initialHash.startsWith('#/desktop-widget/') ||
  initialHash === '#/pet-widget'
if (!isIsolatedWindow) {
  useGlobalEffects()
}

async function loadAll(): Promise<void> {
  // 设置读失败不能拦住整个应用：宁可用默认外观启动，也不能白屏
  try {
    await settings.load()
  } catch (err) {
    console.error('[app] 设置加载失败，先用默认值启动', err)
  }
  // 用 allSettled 而不是 all：任何一项失败都不该把其余已加载好的数据一起丢掉
  const results = await Promise.allSettled([
    timetable.load(),
    schedules.load(),
    todos.load(),
    stats.load(),
    music.load(),
    water.load(),
    books.load(),
    countdowns.load(),
    desktopWidgets.load(),
    garden.load(),
    petCompanion.load(),
    pomodoro.init()
  ])
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length) {
    for (const item of failed) console.error('[app] 数据加载失败', (item as PromiseRejectedResult).reason)
    ui.error(`有 ${failed.length} 项数据没能加载，重启应用试试`)
  }
}

onMounted(() => {
  void loadAll()
  window.api.system.onReload(() => void loadAll())
  window.api.system.onSettingsChanged(() => void settings.load())
  window.api.todos.onChanged(() => void todos.load())
  if (!isLock.value && !isWidget.value && !isDesktopWidget.value) {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        showSearch.value = true
      }
    })
  }
})
</script>

<template>
  <LockView v-if="isLock" />
  <WidgetView v-else-if="isWidget" />
  <ClockWidgetView v-else-if="isClockWidget" />
  <DesktopWidgetView v-else-if="isDesktopWidget" />
  <PetWidgetView v-else-if="isPetWidget" />
  <div v-else class="app-shell" :style="appShellStyle">
    <div
      v-if="settings.s.appBg"
      class="app-bg"
      :style="{
        backgroundImage: `url('${media(settings.s.appBg)}')`,
        opacity: settings.s.appBgOpacity
      }"
    />
    <AppSidebar />
    <main class="content">
      <header class="toolbar">
        <h1 class="toolbar-title">{{ route.meta.title ?? '学习桌面' }}</h1>
        <button class="toolbar-search" @click="openSearch">
          <span>搜索页面 / 资料 / 备忘</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button class="qq-chip" @click="copyQQGroup">
          {{ qqCopied ? '群号已复制' : `交流 QQ 群 ${QQ_GROUP}` }}
        </button>
        <div class="toolbar-spacer" />
        <WindowControls />
      </header>
      <div class="view-scroll" :class="{ 'view-scroll--dashboard': isDashboard }">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
  <SearchPalette v-if="showSearch" @close="showSearch = false" />
  <UiFeedbackHost v-if="!isLock && !isWidget && !isClockWidget && !isDesktopWidget" />
  <UpdatePromptModal v-if="!isLock && !isWidget && !isClockWidget && !isDesktopWidget" />
  <StartupAnnouncementModal v-if="!isLock && !isWidget && !isClockWidget && !isDesktopWidget && !isPetWidget" />
</template>
