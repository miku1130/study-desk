export type ThemeMode = 'system' | 'light' | 'dark'

export interface BellConfig {
  enabled: boolean
  onSound: string
  offSound: string
  volume: number
}

export type LockStyle = 'minimal' | 'flip' | 'pixel' | 'breathing'

export interface PomodoroConfig {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
  autoStart: boolean
  lockscreen: boolean
  lockStyle: LockStyle
  wallpaper: string
  sound: string
  volume: number
}

export interface HotkeyConfig {
  toggleTimer: string
  toggleWindow: string
}

export interface WaterConfig {
  enabled: boolean
  intervalMin: number
  goalCups: number
}

export interface HealthConfig {
  sitEnabled: boolean
  sitIntervalMin: number
  eyeEnabled: boolean
  eyeIntervalMin: number
}

export interface AppSettings {
  theme: ThemeMode
  accent: string
  appBg: string
  appBgOpacity: number
  bell: BellConfig
  pomodoro: PomodoroConfig
  water: WaterConfig
  health: HealthConfig
  autostart: boolean
  widget: boolean
  hotkeys: HotkeyConfig
  musicApi: string
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  accent: '#0a84ff',
  appBg: '',
  appBgOpacity: 0.18,
  bell: { enabled: false, onSound: 'chime:school-bell', offSound: 'chime:westminster', volume: 0.8 },
  pomodoro: {
    workMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    autoStart: false,
    lockscreen: false,
    lockStyle: 'minimal',
    wallpaper: '',
    sound: '',
    volume: 0.8
  },
  water: { enabled: false, intervalMin: 60, goalCups: 8 },
  health: { sitEnabled: false, sitIntervalMin: 45, eyeEnabled: false, eyeIntervalMin: 30 },
  autostart: false,
  widget: false,
  hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' },
  musicApi: ''
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

export interface OnlineTrack {
  name: string
  artist: string
  url: string
  duration: number
}

export type LoopMode = 'all' | 'one' | 'none'

export interface MusicData {
  tracks: MusicTrack[]
  volume: number
  loop: LoopMode
}

export type RepeatMode = 'none' | 'daily' | 'weekly'

export const REPEATS: { value: RepeatMode; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' }
]

export type Priority = 0 | 1 | 2 | 3

export interface PriorityMeta {
  value: Priority
  label: string
  color: string
}

export const PRIORITIES: PriorityMeta[] = [
  { value: 3, label: '高', color: '#ff453a' },
  { value: 2, label: '中', color: '#ff9f0a' },
  { value: 1, label: '低', color: '#0a84ff' },
  { value: 0, label: '无', color: '#8e8e93' }
]

export interface TodoItem {
  id: string
  text: string
  done: boolean
  pomodoros: number
  createdAt: number
  priority: Priority
  due: string
  note: string
  repeat: RepeatMode
  completedAt?: number
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

export interface WaterData {
  days: Record<string, number>
}

export interface Book {
  id: string
  name: string
  path: string
  category: string
  addedAt: number
}

export interface BooksData {
  items: Book[]
}

export interface Countdown {
  id: string
  title: string
  date: string
  color: string
  bg: string
}

export interface CountdownData {
  items: Countdown[]
}

export interface TreeSpecies {
  id: string
  name: string
  emoji: string
  cost: number
}

export const TREE_SPECIES: TreeSpecies[] = [
  { id: 'evergreen', name: '常青树', emoji: '🌳', cost: 0 },
  { id: 'pine', name: '松树', emoji: '🌲', cost: 30 },
  { id: 'sakura', name: '樱花树', emoji: '🌸', cost: 40 },
  { id: 'palm', name: '椰子树', emoji: '🌴', cost: 60 },
  { id: 'maple', name: '枫树', emoji: '🍁', cost: 60 },
  { id: 'xmas', name: '圣诞树', emoji: '🎄', cost: 90 }
]

export interface GardenTree {
  id: string
  species: string
  at: number
}

export interface GardenData {
  coins: number
  trees: GardenTree[]
  unlocked: string[]
  current: string
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
