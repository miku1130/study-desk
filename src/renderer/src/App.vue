<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import WindowControls from '@/components/WindowControls.vue'
import SearchPalette from '@/components/SearchPalette.vue'
import UiFeedbackHost from '@/components/UiFeedbackHost.vue'
import UpdatePromptModal from '@/components/UpdatePromptModal.vue'
import LockView from '@/views/LockView.vue'
import WidgetView from '@/views/WidgetView.vue'
import ClockWidgetView from '@/views/ClockWidgetView.vue'
import { useSettingsStore } from '@/stores/settings'
import { useTimetableStore } from '@/stores/timetable'
import { useTodoStore } from '@/stores/todos'
import { useStatsStore } from '@/stores/stats'
import { useMusicStore } from '@/stores/music'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useWaterStore } from '@/stores/water'
import { useBooksStore } from '@/stores/books'
import { useCountdownStore } from '@/stores/countdowns'
import { useGardenStore } from '@/stores/garden'
import { useGlobalEffects } from '@/composables/useGlobalEffects'

const route = useRoute()
const isLock = computed(() => route.name === 'lock')
const isWidget = computed(() => route.name === 'widget')
const isClockWidget = computed(() => route.name === 'clockwidget')

const settings = useSettingsStore()
const timetable = useTimetableStore()
const todos = useTodoStore()
const stats = useStatsStore()
const music = useMusicStore()
const pomodoro = usePomodoroStore()
const water = useWaterStore()
const books = useBooksStore()
const countdowns = useCountdownStore()
const garden = useGardenStore()

const showSearch = ref(false)
const qqCopied = ref(false)
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

// 锁屏 / 浮窗 / 时钟浮窗子窗口跳过全局音效/托盘/奖励，避免重复触发
if (
  !window.location.hash.includes('/lock') &&
  !window.location.hash.includes('/widget') &&
  !window.location.hash.includes('/clockwidget')
) {
  useGlobalEffects()
}

async function loadAll(): Promise<void> {
  await settings.load()
  await Promise.all([
    timetable.load(),
    todos.load(),
    stats.load(),
    music.load(),
    water.load(),
    books.load(),
    countdowns.load(),
    garden.load(),
    pomodoro.init()
  ])
}

onMounted(() => {
  void loadAll()
  window.api.system.onReload(() => void loadAll())
  window.api.todos.onChanged(() => void todos.load())
  if (!isLock.value && !isWidget.value) {
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
  <div v-else class="app-shell">
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
      <div class="view-scroll">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
  <SearchPalette v-if="showSearch" @close="showSearch = false" />
  <UiFeedbackHost v-if="!isLock && !isWidget && !isClockWidget" />
  <UpdatePromptModal v-if="!isLock && !isWidget && !isClockWidget" />
</template>
