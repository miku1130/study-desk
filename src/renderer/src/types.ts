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
  petWidget: {
    enabled: boolean
    duringPomodoro: boolean
    duringClass: boolean
  }
}

export const defaultSettings: AppSettings = {
  theme: 'light',
  accent: '#4fae98',
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
  musicApi: '',
  petWidget: { enabled: false, duringPomodoro: true, duringClass: true }
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
export type TodoKind = 'task' | 'memo' | 'idea'

export interface TodoSubtask {
  id: string
  text: string
  done: boolean
}

export type TodoAttachmentKind = 'image' | 'file'

export interface TodoAttachment {
  id: string
  kind: TodoAttachmentKind
  name: string
  path: string
  addedAt: number
}

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
  { value: 3, label: '高', color: '#e2736b' },
  { value: 2, label: '中', color: '#e2a33e' },
  { value: 1, label: '低', color: '#5c9fd8' },
  { value: 0, label: '无', color: '#8c9c94' }
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
  kind: TodoKind
  tags: string[]
  reminderAt: string
  /** 到点提醒是否已触发（主进程置位，防止重复通知） */
  reminded: boolean
  pinned: boolean
  estimatePomodoros: number
  subtasks: TodoSubtask[]
  attachments: TodoAttachment[]
  completedAt?: number
}

export interface TodoData {
  items: TodoItem[]
  /** 当前绑定到番茄钟的任务 id（专注完成自动累计到该任务） */
  activeId: string
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

export type BookStatus = 'unread' | 'reading' | 'finished' | 'reference'

export interface BookNote {
  id: string
  text: string
  /** 关联页码，0 表示未标注 */
  page: number
  createdAt: number
}

export interface ReadSession {
  id: string
  /** 会话结束时间戳 */
  at: number
  minutes: number
}

export interface Book {
  id: string
  name: string
  path: string
  category: string
  addedAt: number
  author: string
  status: BookStatus
  progress: number
  rating: number
  tags: string[]
  note: string
  lastOpenedAt: number
  openCount: number
  favorite: boolean
  /** 总页数 / 当前页，两者都大于 0 时进度按页码换算 */
  totalPages: number
  currentPage: number
  notes: BookNote[]
  readLog: ReadSession[]
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

export type DesktopWidgetKind = 'countdown' | 'timetable' | 'memo'
export type DesktopWidgetSize = 'small' | 'medium' | 'large'
export type DesktopWidgetMemoMode = 'list' | 'image'
export type DesktopWidgetFont =
  | 'system'
  | 'serif'
  | 'rounded'
  | 'mono'
  | 'handwriting'
  | 'literary'
  | 'display'

export interface DesktopWidgetConfig {
  id: string
  kind: DesktopWidgetKind
  sourceId: string
  title: string
  enabled: boolean
  launchOnStartup: boolean
  locked: boolean
  alwaysOnTop: boolean
  size: DesktopWidgetSize
  background: string
  backgroundColor: string
  overlayOpacity: number
  surfaceOpacity: number
  font: DesktopWidgetFont
  fontColor: string
  accentColor: string
  memoDisplayMode: DesktopWidgetMemoMode
  memoImageAttachmentId: string
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface DesktopWidgetsData {
  items: DesktopWidgetConfig[]
}

export interface TreeSpecies {
  id: string
  name: string
  cost: number
  biome: string
  rarity: 'common' | 'rare' | 'epic'
}

export const TREE_SPECIES: TreeSpecies[] = [
  { id: 'evergreen', name: '常青树', cost: 0, biome: '晨雾林地', rarity: 'common' },
  { id: 'pine', name: '松树', cost: 30, biome: '山脊针叶林', rarity: 'common' },
  { id: 'sakura', name: '樱花树', cost: 40, biome: '春日溪谷', rarity: 'rare' },
  { id: 'palm', name: '椰子树', cost: 60, biome: '海风沙洲', rarity: 'rare' },
  { id: 'maple', name: '枫树', cost: 60, biome: '秋色坡地', rarity: 'rare' },
  { id: 'xmas', name: '圣诞树', cost: 90, biome: '雪夜营地', rarity: 'epic' }
]

export type TreeMood = 'sprout' | 'growing' | 'mature' | 'glow'

export interface GardenTree {
  id: string
  species: string
  at: number
  focusMinutes: number
  mood: TreeMood
  plot: number
  /** 被后续专注浇灌的次数，决定成长阶段 */
  growth: number
  /** 稀有金树（种下时小概率触发，永久发光并额外奖励） */
  golden: boolean
}

export interface GardenAchievement {
  id: string
  title: string
  desc: string
  icon: string
  unlockedAt?: number
}

export interface DecorSpec {
  id: string
  name: string
  cost: number
  desc: string
}

export const DECOR_ITEMS: DecorSpec[] = [
  { id: 'lantern', name: '石灯笼', cost: 25, desc: '夜里为花园留一盏灯' },
  { id: 'bench', name: '木长椅', cost: 30, desc: '坐下来看看自己种的树' },
  { id: 'windchime', name: '风铃', cost: 40, desc: '风吹过便有清脆铃声' },
  { id: 'pond', name: '莲花池', cost: 45, desc: '水面倒映着专注时光' },
  { id: 'fountain', name: '喷泉', cost: 60, desc: '花园的中心景观' },
  { id: 'tent', name: '露营帐篷', cost: 80, desc: '在森林里过夜的浪漫' }
]

export interface GardenDecor {
  id: string
  kind: string
  plot: number
}

export type QuestMetric = 'pomodoros' | 'minutes' | 'trees'

export interface DailyQuest {
  id: string
  title: string
  metric: QuestMetric
  target: number
  reward: number
  progress: number
  claimed: boolean
}

export interface GardenData {
  coins: number
  trees: GardenTree[]
  unlocked: string[]
  current: string
  streak: number
  lastRewardDate: string
  achievements: GardenAchievement[]
  decors: GardenDecor[]
  /** 已购买未摆放的装饰库存：kind -> 数量 */
  decorOwned: Record<string, number>
  quests: DailyQuest[]
  questsDate: string
  questsCompletedTotal: number
}

export type PetFocusSource = 'pomodoro' | 'class'
export type PetKeepsakeKind = 'gift' | 'trash'

export interface PetKeepsake {
  id: string
  itemId: string
  kind: PetKeepsakeKind
  source: PetFocusSource
  at: number
}

export interface PetActiveClass {
  id: string
  name: string
  startedAt: number
  endAt: number
}

export interface PetCompanionData {
  coins: number
  catId: string
  roomId: string
  furnitureId: string
  unlockedCats: string[]
  unlockedRooms: string[]
  unlockedFurniture: string[]
  keepsakes: PetKeepsake[]
  completedSessions: number
  abandonedSessions: number
  activeClass: PetActiveClass | null
  settledClasses: string[]
}

export type PomodoroPhase = 'idle' | 'work' | 'short' | 'long'

export interface PomodoroState {
  phase: PomodoroPhase
  remaining: number
  total: number
  running: boolean
  completed: number
}

export type StudyRoomStatus = 'idle' | 'hosting' | 'connecting' | 'joined' | 'error'

export interface StudyRoomCheer {
  id: string
  emoji: string
  label: string
}

export interface StudyRoomMember {
  id: string
  nickname: string
  catId: string
  host: boolean
  phase: PomodoroPhase
  running: boolean
  remaining: number
  todayFocusMinutes: number
  todayPomodoros: number
  /** 今天在自习室里累计的专注秒数（跨房间、跨重连，由成员本地按日累计） */
  todayRoomFocusSeconds: number
  /** 本次在当前自习室的专注秒数，由房主计时，用于集体目标与排行 */
  roomFocusSeconds: number
  roomPomodoros: number
  cheers: number
  joinedAt: number
  online: boolean
}

export interface StudyRoomSummary {
  roomId: string
  name: string
  code: string
  hostNickname: string
  memberCount: number
  maxMembers: number
  goalMinutes: number
  focusMinutes: number
  createdAt: number
}

export interface StudyRoomState {
  status: StudyRoomStatus
  selfId: string
  nickname: string
  room: StudyRoomSummary | null
  members: StudyRoomMember[]
  error: string
}

export interface StudyRoomDiscovered {
  room: StudyRoomSummary
  address: string
  port: number
}

export interface StudyRoomCheerEvent {
  id: string
  cheerId: string
  fromId: string
  fromNickname: string
  toId: string
  at: number
}

export interface StudyRoomNotice {
  kind: 'join' | 'leave' | 'goal' | 'closed' | 'error'
  text: string
}

export interface StudyRoomNameCheck {
  ok: boolean
  value: string
  reason: string
}

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const LESSON_COLORS = [
  '#77b5e8',
  '#67bfa4',
  '#f6c85f',
  '#f28b82',
  '#a88ad8',
  '#5bc0d1',
  '#e887b0',
  '#8bc6a3'
]

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
