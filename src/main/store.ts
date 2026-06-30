import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

/**
 * 轻量 JSON 持久化：每个实例对应 userData 下的一个文件。
 * 自实现以避免 electron-store 的 ESM/CJS 版本困扰。
 */
export class JsonStore<T extends Record<string, unknown>> {
  private readonly filePath: string
  private data: T

  constructor(fileName: string, defaults: T) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, fileName)
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<T>
        this.data = { ...defaults, ...parsed }
      } catch {
        this.data = { ...defaults }
      }
    } else {
      this.data = { ...defaults }
      this.persist()
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

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
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
  water: { enabled: false, intervalMin: 60, goalCups: 8 },
  autostart: false,
  widget: false,
  hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' }
}

export interface AppStores {
  settings: JsonStore<Record<string, unknown>>
  timetable: JsonStore<Record<string, unknown>>
  todos: JsonStore<Record<string, unknown>>
  stats: JsonStore<Record<string, unknown>>
  music: JsonStore<Record<string, unknown>>
  water: JsonStore<Record<string, unknown>>
  books: JsonStore<Record<string, unknown>>
}

export function createStores(): AppStores {
  return {
    settings: new JsonStore('settings.json', DEFAULT_SETTINGS),
    timetable: new JsonStore('timetable.json', { periods: DEFAULT_PERIODS, lessons: [] }),
    todos: new JsonStore('todos.json', { items: [] }),
    stats: new JsonStore('stats.json', { days: {} }),
    music: new JsonStore('music.json', { tracks: [], volume: 0.6, loop: 'all' }),
    water: new JsonStore('water.json', { days: {} }),
    books: new JsonStore('books.json', { items: [] })
  }
}
