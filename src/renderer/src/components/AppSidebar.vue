<script setup lang="ts">
import TrafficLights from './TrafficLights.vue'

interface NavItem {
  to: string
  label: string
  icon: string
}

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

const items: NavItem[] = [
  {
    to: '/',
    label: '仪表盘',
    icon: svg(
      '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'
    )
  },
  {
    to: '/timetable',
    label: '课表',
    icon: svg('<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>')
  },
  {
    to: '/pomodoro',
    label: '番茄钟',
    icon: svg('<path d="M10 2h4"/><path d="M12 14l2.5-2.5"/><circle cx="12" cy="14" r="8"/>')
  },
  {
    to: '/music',
    label: '背景音乐',
    icon: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>')
  },
  {
    to: '/todo',
    label: '待办清单',
    icon: svg(
      '<rect x="3" y="4.5" width="6" height="6" rx="1.5"/><path d="m3.5 14.5 1.8 1.8 3.2-3.2"/><path d="M13 7h8M13 16h8"/>'
    )
  },
  {
    to: '/stats',
    label: '专注统计',
    icon: svg('<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-9"/>')
  },
  {
    to: '/settings',
    label: '设置',
    icon: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    )
  }
]
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <TrafficLights />
    </div>
    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="active"
        exact-active-class="active"
      >
        <!-- 图标为硬编码可信 SVG，使用 v-html 注入 -->
        <span class="nav-icon" v-html="item.icon" />
        <span class="nav-label">{{ item.label }}</span>
      </RouterLink>
    </nav>
    <div class="sidebar-footer">学习桌面 · v0.1</div>
  </aside>
</template>
