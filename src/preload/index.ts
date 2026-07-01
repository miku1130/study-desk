import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type Listener = (...args: unknown[]) => void

function on(channel: string, cb: Listener): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    show: (): Promise<void> => ipcRenderer.invoke('window:show')
  },
  widget: {
    toggle: (): Promise<boolean> => ipcRenderer.invoke('widget:toggle'),
    close: (): Promise<void> => ipcRenderer.invoke('widget:close')
  },
  store: {
    get: (name: string): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:get', name),
    set: (name: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke('store:set', name, value)
  },
  dialog: {
    openFile: (filters?: unknown): Promise<string> => ipcRenderer.invoke('dialog:openFile', filters),
    openFiles: (filters?: unknown): Promise<string[]> =>
      ipcRenderer.invoke('dialog:openFiles', filters)
  },
  media: {
    url: (filePath: string): string =>
      filePath ? `studymedia://media/?p=${encodeURIComponent(filePath)}` : '',
    download: (url: string): Promise<string> => ipcRenderer.invoke('media:download', url)
  },
  online: {
    search: (
      keyword: string
    ): Promise<Array<{ name: string; artist: string; url: string; duration: number }>> =>
      ipcRenderer.invoke('online:search', keyword)
  },
  shell: {
    openPath: (p: string): Promise<string> => ipcRenderer.invoke('shell:openPath', p)
  },
  pomodoro: {
    start: (): Promise<void> => ipcRenderer.invoke('pomodoro:start'),
    pause: (): Promise<void> => ipcRenderer.invoke('pomodoro:pause'),
    toggle: (): Promise<void> => ipcRenderer.invoke('pomodoro:toggle'),
    reset: (): Promise<void> => ipcRenderer.invoke('pomodoro:reset'),
    skip: (): Promise<void> => ipcRenderer.invoke('pomodoro:skip'),
    getState: (): Promise<unknown> => ipcRenderer.invoke('pomodoro:getState'),
    onTick: (cb: (state: unknown) => void): (() => void) => on('pomodoro:tick', (s) => cb(s)),
    onEvent: (cb: (type: string) => void): (() => void) =>
      on('pomodoro:event', (t) => cb(t as string))
  },
  bell: {
    onRing: (cb: (kind: string) => void): (() => void) => on('bell:ring', (k) => cb(k as string))
  },
  classes: {
    onStart: (cb: (lesson: unknown) => void): (() => void) => on('class:start', (l) => cb(l))
  },
  lockscreen: {
    close: (): Promise<void> => ipcRenderer.invoke('lockscreen:close')
  },
  tray: {
    setIcon: (dataUrl: string): Promise<void> => ipcRenderer.invoke('tray:setIcon', dataUrl)
  },
  autostart: {
    get: (): Promise<boolean> => ipcRenderer.invoke('autostart:get'),
    set: (v: boolean): Promise<boolean> => ipcRenderer.invoke('autostart:set', v)
  },
  shortcuts: {
    update: (): Promise<void> => ipcRenderer.invoke('shortcuts:update')
  },
  timetable: {
    export: (): Promise<boolean> => ipcRenderer.invoke('timetable:export'),
    import: (): Promise<unknown> => ipcRenderer.invoke('timetable:import')
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  notify: {
    show: (title: string, body: string): Promise<void> =>
      ipcRenderer.invoke('notify:show', title, body)
  },
  update: {
    check: (): Promise<unknown> => ipcRenderer.invoke('update:check'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (status: unknown) => void): (() => void) => on('update:status', (s) => cb(s))
  },
  backup: {
    export: (): Promise<boolean> => ipcRenderer.invoke('backup:export'),
    import: (): Promise<boolean> => ipcRenderer.invoke('backup:import')
  },
  system: {
    onReload: (cb: () => void): (() => void) => on('data:reloaded', () => cb())
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore - 退化场景
  window.api = api
}

export type Api = typeof api
