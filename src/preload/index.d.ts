export interface FileFilterDTO {
  name: string
  extensions: string[]
}

export interface PomodoroStateDTO {
  phase: 'idle' | 'work' | 'short' | 'long'
  remaining: number
  total: number
  running: boolean
  completed: number
}

export interface StudyDeskApi {
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<boolean>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    show: () => Promise<void>
  }
  widget: {
    toggle: () => Promise<boolean>
    close: () => Promise<void>
  }
  store: {
    get: <T = Record<string, unknown>>(name: string) => Promise<T>
    set: (name: string, value: unknown) => Promise<boolean>
  }
  dialog: {
    openFile: (filters?: FileFilterDTO[]) => Promise<string>
    openFiles: (filters?: FileFilterDTO[]) => Promise<string[]>
  }
  media: {
    url: (filePath: string) => string
  }
  pomodoro: {
    start: () => Promise<void>
    pause: () => Promise<void>
    toggle: () => Promise<void>
    reset: () => Promise<void>
    skip: () => Promise<void>
    getState: () => Promise<PomodoroStateDTO>
    onTick: (cb: (state: PomodoroStateDTO) => void) => () => void
    onEvent: (cb: (type: string) => void) => () => void
  }
  bell: {
    onRing: (cb: (kind: string) => void) => () => void
  }
  classes: {
    onStart: (cb: (lesson: unknown) => void) => () => void
  }
  lockscreen: {
    close: () => Promise<void>
  }
  tray: {
    setIcon: (dataUrl: string) => Promise<void>
  }
  autostart: {
    get: () => Promise<boolean>
    set: (v: boolean) => Promise<boolean>
  }
  shortcuts: {
    update: () => Promise<void>
  }
  timetable: {
    export: () => Promise<boolean>
    import: () => Promise<unknown>
  }
  app: {
    getVersion: () => Promise<string>
  }
  notify: {
    show: (title: string, body: string) => Promise<void>
  }
  update: {
    check: () => Promise<unknown>
    install: () => Promise<void>
    onStatus: (cb: (status: unknown) => void) => () => void
  }
}

declare global {
  interface Window {
    api: StudyDeskApi
  }
}
