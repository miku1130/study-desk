<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { usePomodoroStore } from '@/stores/pomodoro'

interface NavItem {
  to: string
  label: string
  icon: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const QQ_GROUP = '1076144676'

const router = useRouter()
const pomodoro = usePomodoroStore()
const version = shallowRef('')

onMounted(async () => {
  version.value = await window.api.app.getVersion()
})

const miniTime = computed(() => {
  const m = String(pomodoro.minutes).padStart(2, '0')
  const s = String(pomodoro.seconds).padStart(2, '0')
  return `${m}:${s}`
})

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

const groups: NavGroup[] = [
  {
    title: '今日工作台',
    items: [
      {
        to: '/',
        label: '仪表盘',
        icon: svg(
          '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'
        )
      },
      {
        to: '/todo',
        label: '备忘录中心',
        icon: svg(
          '<path d="M6 4h12a2 2 0 0 1 2 2v13.5L17 18H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h6"/>'
        )
      },
      {
        to: '/timetable',
        label: '课表',
        icon: svg('<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>')
      },
      {
        to: '/countdown',
        label: '倒数日',
        icon: svg(
          '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'
        )
      },
      {
        to: '/widgets',
        label: '桌面摆件',
        icon: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>')
      }
    ]
  },
  {
    title: '学习资料',
    items: [
      {
        to: '/bookshelf',
        label: '学习资料库',
        icon: svg(
          '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
        )
      },
      {
        to: '/music',
        label: '背景音乐',
        icon: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>')
      }
    ]
  },
  {
    title: '专注成长',
    items: [
      {
        to: '/pomodoro',
        label: '番茄钟',
        icon: svg('<path d="M10 2h4"/><path d="M12 14l2.5-2.5"/><circle cx="12" cy="14" r="8"/>')
      },
      {
        to: '/study-room',
        label: '自习室',
        icon: svg(
          '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16.5 3.13a4 4 0 0 1 0 7.75"/>'
        )
      },
      {
        to: '/stats',
        label: '专注统计',
        icon: svg('<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-9"/>')
      },
      {
        to: '/breathe',
        label: '深呼吸',
        icon: svg(
          '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>'
        )
      }
    ]
  },
  {
    title: '系统',
    items: [
      {
        to: '/settings',
        label: '设置与更新',
        icon: svg(
          '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
        )
      }
    ]
  }
]
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <AppLogo :size="38" />
      <div class="brand-lockup">
        <span class="brand">学习桌面</span>
        <span class="brand-sub">StudyDesk</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <section v-for="group in groups" :key="group.title" class="nav-group">
        <p class="nav-group-title">{{ group.title }}</p>
        <RouterLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="active"
          exact-active-class="active"
        >
          <span class="nav-icon" v-html="item.icon" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </section>
    </nav>
    <button
      v-if="pomodoro.phase !== 'idle'"
      class="mini-timer"
      :class="{ paused: !pomodoro.running }"
      @click="router.push('/pomodoro')"
    >
      <span class="mini-dot" />
      <span class="mini-phase">{{ pomodoro.phaseLabel }}</span>
      <strong>{{ miniTime }}</strong>
    </button>
    <div class="sidebar-footer">
      <span>交流 QQ 群 {{ QQ_GROUP }}</span>
      <small>学习桌面{{ version ? ` · v${version}` : '' }}</small>
    </div>
  </aside>
</template>

<style scoped>
.brand-lockup {
  min-width: 0;
}
.mini-timer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 8px;
  padding: 9px 11px;
  border: 1px solid var(--nav-active-border);
  border-radius: 9px;
  background: var(--nav-active-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 650;
  overflow: hidden;
}
.mini-timer::before {
  content: '';
  position: absolute;
  inset-block: 7px;
  inset-inline-start: 0;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}
.mini-timer strong {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.mini-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-success);
  animation: mini-pulse 1.6s infinite;
}
.mini-timer.paused .mini-dot {
  background: var(--status-warning);
  animation: none;
}
.mini-phase {
  color: var(--accent-strong);
}
@keyframes mini-pulse {
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--status-success) 18%, transparent);
  }
}
</style>
