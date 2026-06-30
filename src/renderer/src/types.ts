export type ThemeMode = 'system' | 'light' | 'dark'

export interface BellConfig {
  enabled: boolean
  onSound: string
  offSound: string
  volume: number
}

export interface PomodoroConfig {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
  autoStart: boolean
  lockscreen: boolean
  wallpaper: string
  sound: string
  volume: number
}

export interface HotkeyConfig {
  toggleTimer: string
  toggleWindow: string
}

export interface AppSettings {
  theme: ThemeMode
  accent: string
  bell: BellConfig
  pomodoro: PomodoroConfig
  autostart: boolean
  widget: boolean
  hotkeys: HotkeyConfig
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  accent: '#0a84ff',
  bell: { enabled: false, onSound: '', offSound: '', volume: 0.8 },
  pomodoro: {
    workMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    autoStart: false,
    lockscreen: false,
    wallpaper: '',
    sound: '',
    volume: 0.8
  },
  autostart: false,
  widget: false,
  hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' }
}

export interface Period {
  id: string
  name: string
  start: string
  end: string
}

export interface Lesson {
  id: string
  day: number
  periodId: string
  name: string
  teacher: string
  location: string
  color: string
}

export interface TimetableData {
  periods: Period[]
  lessons: Lesson[]
}

export interface MusicTrack {
  id: string
  name: string
  path: string
}

export type LoopMode = 'all' | 'one' | 'none'

export interface MusicData {
  tracks: MusicTrack[]
  volume: number
  loop: LoopMode
}

export interface TodoItem {
  id: string
  text: string
  done: boolean
  pomodoros: number
  createdAt: number
}

export interface TodoData {
  items: TodoItem[]
}

export interface DayStat {
  pomodoros: number
  focusMinutes: number
}

export interface StatsData {
  days: Record<string, DayStat>
}

export type PomodoroPhase = 'idle' | 'work' | 'short' | 'long'

export interface PomodoroState {
  phase: PomodoroPhase
  remaining: number
  total: number
  running: boolean
  completed: number
}

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const LESSON_COLORS = [
  '#0a84ff',
  '#30d158',
  '#ff9f0a',
  '#ff453a',
  '#bf5af2',
  '#5ac8fa',
  '#ff375f',
  '#64d2ff'
]

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
