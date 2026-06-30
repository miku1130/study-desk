import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/timetable',
    name: 'timetable',
    component: () => import('@/views/TimetableView.vue'),
    meta: { title: '课表' }
  },
  {
    path: '/pomodoro',
    name: 'pomodoro',
    component: () => import('@/views/PomodoroView.vue'),
    meta: { title: '番茄钟' }
  },
  {
    path: '/music',
    name: 'music',
    component: () => import('@/views/MusicView.vue'),
    meta: { title: '背景音乐' }
  },
  {
    path: '/todo',
    name: 'todo',
    component: () => import('@/views/TodoView.vue'),
    meta: { title: '待办清单' }
  },
  {
    path: '/bookshelf',
    name: 'bookshelf',
    component: () => import('@/views/BookshelfView.vue'),
    meta: { title: '书架' }
  },
  {
    path: '/countdown',
    name: 'countdown',
    component: () => import('@/views/CountdownView.vue'),
    meta: { title: '倒数日' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '专注统计' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/lock',
    name: 'lock',
    component: () => import('@/views/LockView.vue'),
    meta: { title: '专注' }
  },
  {
    path: '/widget',
    name: 'widget',
    component: () => import('@/views/WidgetView.vue'),
    meta: { title: '桌面浮窗' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}
