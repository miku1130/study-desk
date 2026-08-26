import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type Listener = (...args: unknown[]) => void

export interface HotkeyFailureDTO {
  action: 'toggleTimer' | 'toggleWindow'
  accelerator: string
  reason: 'taken' | 'invalid'
}

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
  clockWidget: {
    toggle: (): Promise<boolean> => ipcRenderer.invoke('clockwidget:toggle')
  },
  petWidget: {
    sync: (visible: boolean): Promise<void> => ipcRenderer.invoke('pet-widget:sync', visible),
    hide: (): Promise<void> => ipcRenderer.invoke('pet-widget:hide')
  },
  desktopWidgets: {
    close: (id: string): Promise<boolean> => ipcRenderer.invoke('desktop-widget:close', id),
    beginDrag: (id: string): Promise<{ x: number; y: number; width: number; height: number } | null> =>
      ipcRenderer.invoke('desktop-widget:begin-drag', id),
    move: (id: string, x: number, y: number): void =>
      ipcRenderer.send('desktop-widget:move', id, x, y),
    endDrag: (id: string, x: number, y: number): Promise<boolean> =>
      ipcRenderer.invoke('desktop-widget:end-drag', id, x, y),
    setPointerInteractive: (id: string, interactive: boolean): Promise<boolean> =>
      ipcRenderer.invoke('desktop-widget:set-pointer-interactive', id, interactive),
    onConfigChanged: (cb: () => void): (() => void) => on('desktop-widget:config-changed', () => cb())
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
  playlist: {
    import: (
      url: string
    ): Promise<{
      ok: boolean
      tracks?: Array<{ name: string; artist: string; url: string; duration: number }>
      server?: string
      error?: string
    }> => ipcRenderer.invoke('playlist:import', url)
  },
  shell: {
    openPath: (p: string): Promise<string> => ipcRenderer.invoke('shell:openPath', p)
  },
  fs: {
    exists: (p: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', p)
  },
  todos: {
    onChanged: (cb: () => void): (() => void) => on('todos:changed', () => cb())
  },
  pomodoro: {
    start: (options?: unknown): Promise<void> => ipcRenderer.invoke('pomodoro:start', options),
    pause: (): Promise<void> => ipcRenderer.invoke('pomodoro:pause'),
    toggle: (): Promise<void> => ipcRenderer.invoke('pomodoro:toggle'),
    reset: (): Promise<void> => ipcRenderer.invoke('pomodoro:reset'),
    skip: (): Promise<void> => ipcRenderer.invoke('pomodoro:skip'),
    finish: (): Promise<void> => ipcRenderer.invoke('pomodoro:finish'),
    getState: (): Promise<unknown> => ipcRenderer.invoke('pomodoro:getState'),
    onTick: (cb: (state: unknown) => void): (() => void) => on('pomodoro:tick', (s) => cb(s)),
    onEvent: (cb: (type: string) => void): (() => void) =>
      on('pomodoro:event', (t) => cb(t as string))
  },
  studyRoom: {
    getState: (): Promise<unknown> => ipcRenderer.invoke('study-room:get-state'),
    getCheers: (): Promise<unknown[]> => ipcRenderer.invoke('study-room:get-cheers'),
    validateName: (kind: 'nickname' | 'room', text: string): Promise<unknown> =>
      ipcRenderer.invoke('study-room:validate-name', kind, text),
    setNickname: (nickname: string): Promise<unknown> =>
      ipcRenderer.invoke('study-room:set-nickname', nickname),
    host: (options: { name: string; goalMinutes: number }): Promise<unknown> =>
      ipcRenderer.invoke('study-room:host', options),
    join: (target: { address?: string; port?: number; code?: string }): Promise<unknown> =>
      ipcRenderer.invoke('study-room:join', target),
    leave: (): Promise<void> => ipcRenderer.invoke('study-room:leave'),
    setGoal: (goalMinutes: number): Promise<boolean> =>
      ipcRenderer.invoke('study-room:set-goal', goalMinutes),
    cheer: (toId: string, cheerId: string): Promise<boolean> =>
      ipcRenderer.invoke('study-room:cheer', toId, cheerId),
    startDiscovery: (): Promise<void> => ipcRenderer.invoke('study-room:discover-start'),
    stopDiscovery: (): Promise<void> => ipcRenderer.invoke('study-room:discover-stop'),
    // 公网自习室：online* 是成员关系与房间，两组语义不同别混用
    onlineConnect: (): Promise<void> => ipcRenderer.invoke('study-room:online-connect'),
    onlineSnapshot: (): Promise<unknown> => ipcRenderer.invoke('study-room:online-snapshot'),
    watchBrowse: (on: boolean): Promise<void> =>
      ipcRenderer.invoke('study-room:watch-browse', on),
    goOffline: (): Promise<void> => ipcRenderer.invoke('study-room:go-offline'),
    setIntro: (intro: string): Promise<void> => ipcRenderer.invoke('study-room:set-intro', intro),
    checkIn: (kind: 'wake' | 'sleep', time: string): Promise<void> =>
      ipcRenderer.invoke('study-room:checkin', kind, time),
    createRoom: (options: { name: string; intro: string; goalMinutes: number }): Promise<void> =>
      ipcRenderer.invoke('study-room:create', options),
    joinStudyRoom: (params: { roomId?: string; code?: string }): Promise<void> =>
      ipcRenderer.invoke('study-room:join-room', params),
    quitStudyRoom: (roomId: string): Promise<void> =>
      ipcRenderer.invoke('study-room:quit-room', roomId),
    dissolveStudyRoom: (roomId: string): Promise<void> =>
      ipcRenderer.invoke('study-room:dissolve', roomId),
    updateStudyRoom: (
      roomId: string,
      patch: { name?: string; intro?: string; goalMinutes?: number }
    ): Promise<void> => ipcRenderer.invoke('study-room:update-room', roomId, patch),
    enterRoom: (roomId: string): Promise<void> => ipcRenderer.invoke('study-room:enter', roomId),
    exitRoom: (): Promise<void> => ipcRenderer.invoke('study-room:exit'),
    setRange: (range: string): Promise<void> => ipcRenderer.invoke('study-room:set-range', range),
    addWish: (text: string): Promise<void> => ipcRenderer.invoke('study-room:wish-add', text),
    reportWish: (id: number): Promise<void> => ipcRenderer.invoke('study-room:wish-report', id),
    deleteWish: (id: number): Promise<void> => ipcRenderer.invoke('study-room:wish-delete', id),
    createLinkCode: (): Promise<void> => ipcRenderer.invoke('study-room:link-create'),
    claimLinkCode: (code: string): Promise<void> =>
      ipcRenderer.invoke('study-room:link-claim', code),
    listPendingWishes: (): Promise<void> => ipcRenderer.invoke('study-room:wish-pending'),
    restoreWish: (id: number): Promise<void> => ipcRenderer.invoke('study-room:wish-restore', id),
    onOnline: (cb: (snapshot: unknown) => void): (() => void) =>
      on('study-room:online', (s) => cb(s)),
    onState: (cb: (state: unknown) => void): (() => void) => on('study-room:state', (s) => cb(s)),
    onRooms: (cb: (rooms: unknown) => void): (() => void) => on('study-room:rooms', (r) => cb(r)),
    onCheer: (cb: (event: unknown) => void): (() => void) =>
      on('study-room:cheer-event', (e) => cb(e)),
    onNotice: (cb: (notice: unknown) => void): (() => void) =>
      on('study-room:notice', (n) => cb(n))
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
    update: (): Promise<HotkeyFailureDTO[]> => ipcRenderer.invoke('shortcuts:update'),
    status: (): Promise<HotkeyFailureDTO[]> => ipcRenderer.invoke('shortcuts:status'),
    onStatus: (cb: (failures: HotkeyFailureDTO[]) => void): (() => void) =>
      on('hotkeys:status', (list) => cb((list as HotkeyFailureDTO[]) ?? []))
  },
  timetable: {
    export: (): Promise<boolean> => ipcRenderer.invoke('timetable:export'),
    import: (): Promise<unknown> => ipcRenderer.invoke('timetable:import')
  },
  schedules: {
    export: (): Promise<boolean> => ipcRenderer.invoke('schedules:export'),
    exportDayPdf: (date: string): Promise<boolean> => ipcRenderer.invoke('schedules:export-day-pdf', date),
    import: (): Promise<unknown> => ipcRenderer.invoke('schedules:import')
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    openProject: (): Promise<void> => ipcRenderer.invoke('app:openProject')
  },
  announcement: {
    get: (): Promise<unknown> => ipcRenderer.invoke('announcement:get')
  },
  notify: {
    show: (title: string, body: string): Promise<void> =>
      ipcRenderer.invoke('notify:show', title, body)
  },
  update: {
    check: (mode: 'automatic' | 'manual' = 'manual'): Promise<unknown> =>
      ipcRenderer.invoke('update:check', mode),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (status: unknown) => void): (() => void) => on('update:status', (s) => cb(s))
  },
  backup: {
    export: (): Promise<unknown> => ipcRenderer.invoke('backup:export'),
    import: (): Promise<unknown> => ipcRenderer.invoke('backup:import')
  },
  system: {
    onReload: (cb: () => void): (() => void) => on('data:reloaded', () => cb()),
    /** 别的窗口改了设置；改动窗口自己不会收到 */
    onSettingsChanged: (cb: () => void): (() => void) => on('settings:changed', () => cb())
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
