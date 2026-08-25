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
    path: '/schedules',
    name: 'schedules',
    component: () => import('@/views/SchedulesView.vue'),
    meta: { title: '日程管理' }
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
    meta: { title: '备忘录中心' }
  },
  {
    path: '/bookshelf',
    name: 'bookshelf',
    component: () => import('@/views/BookshelfView.vue'),
    meta: { title: '学习资料库' }
  },
  {
    path: '/countdown',
    name: 'countdown',
    component: () => import('@/views/CountdownView.vue'),
    meta: { title: '倒数日' }
  },
  {
    path: '/widgets',
    name: 'desktop-widgets',
    component: () => import('@/views/DesktopWidgetsView.vue'),
    meta: { title: '桌面摆件' }
  },
  {
    path: '/study-room',
    name: 'study-room',
    component: () => import('@/views/StudyRoomView.vue'),
    meta: { title: '自习室' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '专注统计' }
  },
  {
    path: '/garden',
    redirect: { path: '/pomodoro', query: { tab: 'garden' } }
  },
  {
    path: '/breathe',
    name: 'breathe',
    component: () => import('@/views/BreatheView.vue'),
    meta: { title: '深呼吸' }
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
  },
  {
    path: '/clockwidget',
    name: 'clockwidget',
    component: () => import('@/views/ClockWidgetView.vue'),
    meta: { title: '时钟浮窗' }
  },
  {
    path: '/pet',
    redirect: { path: '/pomodoro', query: { tab: 'room' } }
  },
  {
    path: '/pet-widget',
    name: 'pet-widget',
    component: () => import('@/views/PetWidgetView.vue'),
    meta: { title: '猫咪伴学挂件' }
  },
  {
    path: '/desktop-widget/:id',
    name: 'desktop-widget',
    component: () => import('@/views/DesktopWidgetView.vue'),
    meta: { title: '桌面摆件' }
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
