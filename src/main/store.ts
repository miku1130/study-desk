import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'

/**
 * 轻量 JSON 持久化：每个实例对应 userData 下的一个文件。
 * 自实现以避免 electron-store 的 ESM/CJS 版本困扰。
 *
 * 写入必须是原子的：直接覆盖原文件时，断电或崩溃会留下半截 JSON，
 * 下次启动解析失败就等于用户数据凭空消失。
 */
export class JsonStore<T extends Record<string, unknown>> {
  private readonly filePath: string
  private data: T
  /** 最近一次写盘是否失败，供上层决定要不要提示用户 */
  private lastWriteFailed = false

  constructor(fileName: string, defaults: T) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, fileName)
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<T>
        this.data = { ...defaults, ...parsed }
      } catch (err) {
        // 不能直接回退默认值就完事：下一次 set 会把默认值写回去，
        // 原文件里那份还能人工抢救的数据就永久没了
        this.data = { ...defaults }
        this.quarantineCorruptFile(err)
      }
    } else {
      this.data = { ...defaults }
      this.persist()
    }
  }

  get healthy(): boolean {
    return !this.lastWriteFailed
  }

  private quarantineCorruptFile(err: unknown): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = `${this.filePath}.corrupt-${stamp}`
    try {
      renameSync(this.filePath, backup)
      console.error(`[store] ${this.filePath} 解析失败，已另存为 ${backup}`, err)
    } catch (renameErr) {
      console.error(`[store] ${this.filePath} 解析失败且无法备份`, err, renameErr)
    }
  }

  get all(): T {
    return this.data
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.persist()
  }

  replace(data: T): void {
    this.data = { ...data }
    this.persist()
  }

  /** 先写临时文件再 rename：同一文件系统上 rename 是原子的，永远不会留下半截文件 */
  private persist(): void {
    const tmp = `${this.filePath}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
      renameSync(tmp, this.filePath)
      this.lastWriteFailed = false
    } catch (err) {
      this.lastWriteFailed = true
      console.error(`[store] 写入 ${this.filePath} 失败`, err)
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* 临时文件清理失败不影响主流程 */
      }
    }
  }
}

export const DEFAULT_PERIODS = [
  { id: 'p1', name: '第 1 节', start: '08:00', end: '08:45' },
  { id: 'p2', name: '第 2 节', start: '08:55', end: '09:40' },
  { id: 'p3', name: '第 3 节', start: '10:00', end: '10:45' },
  { id: 'p4', name: '第 4 节', start: '10:55', end: '11:40' },
  { id: 'p5', name: '第 5 节', start: '14:00', end: '14:45' },
  { id: 'p6', name: '第 6 节', start: '14:55', end: '15:40' },
  { id: 'p7', name: '第 7 节', start: '16:00', end: '16:45' },
  { id: 'p8', name: '第 8 节', start: '19:00', end: '19:45' }
]

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  theme: 'system',
  accent: '#0a84ff',
  accentDark: '',
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
    volume: 0.8,
    mode: 'countdown',
    lastMinutes: 25,
    noise: { scene: '', volume: 0.5, duringBreak: false }
  },
  water: { enabled: false, intervalMin: 60, goalCups: 8 },
  health: { sitEnabled: false, sitIntervalMin: 45, eyeEnabled: false, eyeIntervalMin: 30 },
  autostart: false,
  widget: false,
  hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' },
  musicApi: '',
  petWidget: { enabled: false, duringPomodoro: true, duringClass: true }
}

export interface AppStores {
  settings: JsonStore<Record<string, unknown>>
  timetable: JsonStore<Record<string, unknown>>
  todos: JsonStore<Record<string, unknown>>
  stats: JsonStore<Record<string, unknown>>
  music: JsonStore<Record<string, unknown>>
  water: JsonStore<Record<string, unknown>>
  books: JsonStore<Record<string, unknown>>
  countdowns: JsonStore<Record<string, unknown>>
  desktopWidgets: JsonStore<Record<string, unknown>>
  garden: JsonStore<Record<string, unknown>>
  petCompanion: JsonStore<Record<string, unknown>>
  studyRoom: JsonStore<Record<string, unknown>>
  windowState: JsonStore<Record<string, unknown>>
}

export function createStores(): AppStores {
  return {
    settings: new JsonStore('settings.json', DEFAULT_SETTINGS),
    timetable: new JsonStore('timetable.json', { periods: DEFAULT_PERIODS, lessons: [] }),
    todos: new JsonStore('todos.json', { items: [], activeId: '' }),
    stats: new JsonStore('stats.json', { days: {} }),
    music: new JsonStore('music.json', { tracks: [], volume: 0.6, loop: 'all' }),
    water: new JsonStore('water.json', { days: {} }),
    books: new JsonStore('books.json', { items: [] }),
    countdowns: new JsonStore('countdowns.json', { items: [] }),
    desktopWidgets: new JsonStore('desktop-widgets.json', { items: [] }),
    garden: new JsonStore('garden.json', {
      coins: 0,
      trees: [],
      unlocked: ['evergreen'],
      current: 'evergreen',
      streak: 0,
      lastRewardDate: '',
      achievements: [],
      decors: [],
      decorOwned: {},
      quests: [],
      questsDate: '',
      questsCompletedTotal: 0
    }),
    petCompanion: new JsonStore('pet-companion.json', {
      coins: 12,
      catId: 'mikan',
      roomId: 'sunroom',
      furnitureId: 'oak-desk',
      unlockedCats: ['mikan'],
      unlockedRooms: ['sunroom'],
      unlockedFurniture: ['oak-desk'],
      keepsakes: [],
      completedSessions: 0,
      abandonedSessions: 0,
      activeClass: null,
      settledClasses: []
    }),
    studyRoom: new JsonStore('study-room.json', {
      nickname: '',
      lastRoomName: '',
      goalMinutes: 120,
      soundEnabled: true
    }),
    // 单独一个文件：settings 会被渲染层整体覆盖，放进去会被下一次保存抹掉
    windowState: new JsonStore('window-state.json', { main: null })
  }
}
