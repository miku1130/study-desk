<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import WindowControls from '@/components/WindowControls.vue'
import LockView from '@/views/LockView.vue'
import WidgetView from '@/views/WidgetView.vue'
import { useSettingsStore } from '@/stores/settings'
import { useTimetableStore } from '@/stores/timetable'
import { useTodoStore } from '@/stores/todos'
import { useStatsStore } from '@/stores/stats'
import { useMusicStore } from '@/stores/music'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useWaterStore } from '@/stores/water'
import { useBooksStore } from '@/stores/books'
import { useGlobalEffects } from '@/composables/useGlobalEffects'

const route = useRoute()
const isLock = computed(() => route.name === 'lock')
const isWidget = computed(() => route.name === 'widget')

const settings = useSettingsStore()
const timetable = useTimetableStore()
const todos = useTodoStore()
const stats = useStatsStore()
const music = useMusicStore()
const pomodoro = usePomodoroStore()
const water = useWaterStore()
const books = useBooksStore()

// 锁屏 / 浮窗子窗口跳过全局音效/托盘，避免重复发声
if (!window.location.hash.includes('/lock') && !window.location.hash.includes('/widget')) {
  useGlobalEffects()
}

onMounted(async () => {
  await settings.load()
  await Promise.all([
    timetable.load(),
    todos.load(),
    stats.load(),
    music.load(),
    water.load(),
    books.load(),
    pomodoro.init()
  ])
})
</script>

<template>
    <LockView v-if="isLock" />
    <WidgetView v-else-if="isWidget" />
    <div v-else class="app-shell">
    <AppSidebar />
    <main class="content">
      <header class="toolbar">
        <h1 class="toolbar-title">{{ route.meta.title ?? '学习桌面' }}</h1>
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
</template>
