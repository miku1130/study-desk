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

export interface StudyRoomCheerDTO {
  id: string
  emoji: string
  label: string
}

export interface StudyRoomMemberDTO {
  id: string
  nickname: string
  catId: string
  host: boolean
  phase: 'idle' | 'work' | 'short' | 'long'
  running: boolean
  remaining: number
  todayFocusMinutes: number
  todayPomodoros: number
  todayRoomFocusSeconds: number
  roomFocusSeconds: number
  roomPomodoros: number
  cheers: number
  joinedAt: number
  online: boolean
}

export interface StudyRoomSummaryDTO {
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

export interface StudyRoomStateDTO {
  status: 'idle' | 'hosting' | 'connecting' | 'joined' | 'error' | 'online'
  selfId: string
  nickname: string
  room: StudyRoomSummaryDTO | null
  members: StudyRoomMemberDTO[]
  error: string
}

/** 备份导入导出结果；canceled 表示用户主动放弃，不算失败 */
export interface BackupResultDTO {
  ok: boolean
  canceled?: boolean
  error?: string
}

/** 公网大厅里的一条房间摘要；不含昵称，公开自由文本只留房间名一处 */
export interface StudyRoomLobbyEntryDTO {
  id: string
  name: string
  memberCount: number
  maxMembers: number
  focusingCount: number
  focusMinutes: number
}

export interface StudyRoomDiscoveredDTO {
  room: StudyRoomSummaryDTO
  address: string
  port: number
}

export interface StudyRoomCheerEventDTO {
  id: string
  cheerId: string
  fromId: string
  fromNickname: string
  toId: string
  at: number
}

export interface StudyRoomNoticeDTO {
  kind: 'join' | 'leave' | 'goal' | 'closed' | 'error'
  text: string
}

export interface StudyRoomNameCheckDTO {
  ok: boolean
  value: string
  reason: string
}

export interface StudyRoomResultDTO {
  ok: boolean
  error?: string
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
  clockWidget: {
    toggle: () => Promise<boolean>
  }
  petWidget: {
    sync: (visible: boolean) => Promise<void>
    hide: () => Promise<void>
  }
  desktopWidgets: {
    close: (id: string) => Promise<boolean>
    beginDrag: (id: string) => Promise<{ x: number; y: number; width: number; height: number } | null>
    move: (id: string, x: number, y: number) => void
    endDrag: (id: string, x: number, y: number) => Promise<boolean>
    setPointerInteractive: (id: string, interactive: boolean) => Promise<boolean>
    onConfigChanged: (cb: () => void) => () => void
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
    download: (url: string) => Promise<string>
  }
  online: {
    search: (
      keyword: string
    ) => Promise<Array<{ name: string; artist: string; url: string; duration: number }>>
  }
  playlist: {
    import: (url: string) => Promise<{
      ok: boolean
      tracks?: Array<{ name: string; artist: string; url: string; duration: number }>
      server?: string
      error?: string
    }>
  }
  shell: {
    openPath: (p: string) => Promise<string>
  }
  fs: {
    exists: (p: string) => Promise<boolean>
  }
  todos: {
    onChanged: (cb: () => void) => () => void
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
  studyRoom: {
    getState: () => Promise<StudyRoomStateDTO>
    getCheers: () => Promise<StudyRoomCheerDTO[]>
    validateName: (kind: 'nickname' | 'room', text: string) => Promise<StudyRoomNameCheckDTO>
    setNickname: (nickname: string) => Promise<StudyRoomNameCheckDTO>
    host: (options: { name: string; goalMinutes: number }) => Promise<StudyRoomResultDTO>
    join: (target: { address?: string; port?: number; code?: string }) => Promise<StudyRoomResultDTO>
    leave: () => Promise<void>
    setGoal: (goalMinutes: number) => Promise<boolean>
    cheer: (toId: string, cheerId: string) => Promise<boolean>
    startDiscovery: () => Promise<void>
    stopDiscovery: () => Promise<void>
    watchLobby: (on: boolean) => Promise<void>
    getLobby: () => Promise<StudyRoomLobbyEntryDTO[]>
    hostOnline: (options: { name: string; goalMinutes: number }) => Promise<StudyRoomNameCheckDTO>
    joinOnline: (roomId: string) => Promise<void>
    quickJoin: () => Promise<void>
    goOffline: () => Promise<void>
    onState: (cb: (state: StudyRoomStateDTO) => void) => () => void
    onRooms: (cb: (rooms: StudyRoomDiscoveredDTO[]) => void) => () => void
    onLobby: (cb: (rooms: StudyRoomLobbyEntryDTO[]) => void) => () => void
    onCheer: (cb: (event: StudyRoomCheerEventDTO) => void) => () => void
    onNotice: (cb: (notice: StudyRoomNoticeDTO) => void) => () => void
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
  backup: {
    export: () => Promise<BackupResultDTO>
    import: () => Promise<BackupResultDTO>
  }
  system: {
    onReload: (cb: () => void) => () => void
  }
}

declare global {
  interface Window {
    api: StudyDeskApi
  }
}
