import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  protocol,
  net,
  Notification,
  dialog,
  globalShortcut,
  nativeImage,
  screen,
  type NativeImage
} from 'electron'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createStores, type AppStores } from './store'
import { isServableMediaPath } from './mediaPath'
import { PomodoroEngine } from './pomodoro'
import { dayTotals } from './focusStats'
import { BellScheduler } from './scheduler'
import { WaterReminder } from './water'
import { HealthReminder } from './health'
import { TodoReminder } from './reminders'
import { localDateKey } from './time'
import { openLock, closeLock } from './lockscreen'
import { resolveWindowBounds } from './windowBounds'
import { closePetWidget, hidePetWidget, setPetWidgetVisible } from './petWidget'
import {
  openWidget,
  closeWidget,
  toggleWidget,
  toggleClockWidget,
  syncDesktopWidgets,
  closeDesktopWidgets,
  setDesktopWidgetPointerInteractive,
  beginDesktopWidgetDrag,
  moveDesktopWidget,
  endDesktopWidgetDrag,
  type DesktopWidgetConfig
} from './widget'
import { setupTray, setupTrayFromDataUrl, type TrayHandlers } from './tray'
import { StudyRoomService } from './studyRoom/service'
import type { StudyRoomFocusReport } from './studyRoom/protocol'
import { autoUpdater } from 'electron-updater'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'studymedia',
    privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }
  }
])

// 默认歌单解析聚合接口（Meting-API 格式）；可在「设置 → 音乐接口」替换为自建地址以提升稳定性
const DEFAULT_MUSIC_API = 'https://metingapi.nanorocky.top'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let trayHintShown = false
let stores: AppStores
let engine: PomodoroEngine
let scheduler: BellScheduler
let waterReminder: WaterReminder
let healthReminder: HealthReminder
let todoReminder: TodoReminder
let studyRoom: StudyRoomService

function setAutostart(openAtLogin: boolean): void {
  // Development runs use Electron's executable directly. Registering it without
  // the packaged app would create a stray "electron.app.Electron" startup item.
  app.setLoginItemSettings({ openAtLogin: app.isPackaged && openAtLogin })
}

function getAutostart(): boolean {
  return app.isPackaged && app.getLoginItemSettings().openAtLogin
}

function desktopWidgetItems(): DesktopWidgetConfig[] {
  const value = stores.desktopWidgets.get('items')
  return Array.isArray(value) ? (value as unknown as DesktopWidgetConfig[]) : []
}

function syncAutostart(): void {
  const widgetAutostart = desktopWidgetItems().some(
    (item) => item.enabled !== false && Boolean(item.launchOnStartup)
  )
  setAutostart(Boolean(stores.settings.get('autostart')) || widgetAutostart)
}

function persistDesktopWidgetBounds(
  id: string,
  bounds: { x: number; y: number; width: number; height: number }
): void {
  const items = desktopWidgetItems()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return
  items[index] = { ...items[index], ...bounds }
  stores.desktopWidgets.set('items', items)
}

function sendToAll(channel: string, ...args: unknown[]): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, ...args)
  }
}

function guessExt(url: string, contentType: string): string {
  const m = url.split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/)
  if (m) return '.' + m[1].toLowerCase()
  if (contentType.includes('jpeg')) return '.jpg'
  if (contentType.includes('png')) return '.png'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('gif')) return '.gif'
  if (contentType.includes('mpeg')) return '.mp3'
  if (contentType.includes('wav')) return '.wav'
  if (contentType.includes('ogg')) return '.ogg'
  if (contentType.includes('mp4') || contentType.includes('m4a') || contentType.includes('aac'))
    return '.m4a'
  return '.bin'
}

/** 从任意文本/链接中识别歌单来源与 ID（网易云 / QQ 音乐） */
function detectPlaylist(s: string): { server: string; id: string } | null {
  if (!s) return null
  let server = ''
  if (/163\.com|163cn\.tv/.test(s)) server = 'netease'
  else if (/qq\.com/.test(s)) server = 'tencent'
  const m =
    s.match(/[?&]id=([A-Za-z0-9]+)/) ||
    s.match(/playlist[/_]?([A-Za-z0-9]{6,})/) ||
    s.match(/(\d{6,})/)
  const id = m ? m[1] : ''
  if (!server || !id) return null
  return { server, id }
}

/** 解析歌单链接（支持分享文案、短链跳转）为 {server,id} */
async function resolvePlaylist(input: string): Promise<{ server: string; id: string } | null> {
  let url = String(input || '').trim()
  const urlMatch = url.match(/https?:\/\/[^\s，,、]+/)
  if (urlMatch) url = urlMatch[0]
  let r = detectPlaylist(input) || detectPlaylist(url)
  if (r) return r
  if (/^https?:\/\//.test(url)) {
    try {
      const res = await net.fetch(url)
      r = detectPlaylist(res.url)
      if (!r) r = detectPlaylist(await res.text())
      if (r) return r
    } catch {
      /* 忽略短链解析失败 */
    }
  }
  return null
}

function resolveAppIcon(): NativeImage | undefined {
  const candidates = [
    join(process.resourcesPath, 'icon.png'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  const p = candidates.find((c) => existsSync(c))
  if (!p) return undefined
  const img = nativeImage.createFromPath(p)
  return img.isEmpty() ? undefined : img
}

const MAIN_WINDOW_SIZE = { width: 1180, height: 760, minWidth: 940, minHeight: 620 }

/** 尺寸位置每次变动都写盘太吵，攒一下再落 */
let boundsSaveTimer: NodeJS.Timeout | null = null

function persistMainWindowBounds(): void {
  const win = mainWindow
  if (!win || win.isDestroyed() || win.isMinimized()) return
  // 最大化时 getBounds 返回的是铺满屏幕的尺寸，存下来会让「还原」失去意义
  const maximized = win.isMaximized()
  const bounds = maximized ? win.getNormalBounds() : win.getBounds()
  stores.windowState.set('main', { bounds, maximized })
}

function scheduleBoundsSave(): void {
  if (boundsSaveTimer) clearTimeout(boundsSaveTimer)
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null
    persistMainWindowBounds()
  }, 500)
}

function createWindow(): void {
  const icon = resolveAppIcon()
  const restored = resolveWindowBounds(
    stores.windowState.get('main'),
    screen.getAllDisplays(),
    MAIN_WINDOW_SIZE
  )
  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.height,
    ...(restored.bounds ?? {}),
    minWidth: MAIN_WINDOW_SIZE.minWidth,
    minHeight: MAIN_WINDOW_SIZE.minHeight,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202925' : '#f5f5ef',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (restored.maximized) mainWindow.maximize()

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('resized', scheduleBoundsSave)
  mainWindow.on('moved', scheduleBoundsSave)
  mainWindow.on('maximize', scheduleBoundsSave)
  mainWindow.on('unmaximize', scheduleBoundsSave)
  // 关闭按钮：默认隐藏到托盘后台常驻，仅在托盘「退出」或应用真正退出时才销毁窗口
  mainWindow.on('close', (e) => {
    // 隐藏之后就取不到有效尺寸了，先把当前位置落盘
    persistMainWindowBounds()
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      if (!trayHintShown) {
        trayHintShown = true
        notify('学习桌面仍在后台运行', '已最小化到系统托盘，点击托盘图标可重新打开；右键托盘可退出。')
      }
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function trayHandlers(): TrayHandlers {
  return {
    onToggleWindow: () => toggleMainWindow(),
    onToggleTimer: () => engine.toggle(),
    onToggleWidget: () => {
      const open = toggleWidget()
      stores.settings.set('widget', open)
    },
    onQuit: () => app.quit()
  }
}

/** 启动即用内置图标创建托盘，保证关闭窗口隐藏到托盘后一定能恢复；找不到图标则回退到渲染层创建。 */
function initTray(): void {
  const img = resolveAppIcon()
  if (!img) return
  setupTray(img.resize({ width: 16, height: 16 }), trayHandlers())
}

function toggleMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide()
  else {
    mainWindow.show()
    mainWindow.focus()
  }
}

export interface HotkeyFailure {
  action: 'toggleTimer' | 'toggleWindow'
  accelerator: string
  /** taken：被别的程序占了；invalid：写法不合法 */
  reason: 'taken' | 'invalid'
}

let hotkeyFailures: HotkeyFailure[] = []

/**
 * 注册全局热键，并把失败的那些报给渲染层。
 *
 * 以前这里 catch 了就算完，用户改完热键按下去没反应，也不知道是被别的
 * 程序占了还是自己写错了——这种沉默比功能缺失更让人怀疑应用坏了。
 */
function registerShortcuts(): HotkeyFailure[] {
  globalShortcut.unregisterAll()
  const hk = stores.settings.get('hotkeys') as { toggleTimer: string; toggleWindow: string }
  const failures: HotkeyFailure[] = []

  const bind = (
    action: HotkeyFailure['action'],
    accelerator: string | undefined,
    handler: () => void
  ): void => {
    if (!accelerator) return
    try {
      // 被占用时 register 返回 false 而不抛异常，两种失败都要接住
      if (!globalShortcut.register(accelerator, handler)) {
        failures.push({ action, accelerator, reason: 'taken' })
      }
    } catch {
      failures.push({ action, accelerator, reason: 'invalid' })
    }
  }

  bind('toggleTimer', hk?.toggleTimer, () => engine.toggle())
  bind('toggleWindow', hk?.toggleWindow, () => toggleMainWindow())

  hotkeyFailures = failures
  sendToAll('hotkeys:status', failures)
  return failures
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

/** 自习室对外展示的专注画像：番茄钟当前状态 + 今日统计 */
function studyRoomFocus(): StudyRoomFocusReport {
  const state = engine.getState()
  // 与统计页同一个口径，免得自习室里显示的今日时长和统计页对不上
  const today = dayTotals(stores.stats)
  return {
    phase: state.phase,
    running: state.running,
    remaining: state.remaining,
    todayFocusMinutes: today.focusMinutes,
    todayPomodoros: today.pomodoros,
    // 占位：真实值由 StudyRoomService 用自己按日累计的本地计时覆盖
    todayRoomFocusSeconds: 0
  }
}

function setupUpdater(): void {
  autoUpdater.on('checking-for-update', () => sendToAll('update:status', { state: 'checking' }))
  autoUpdater.on('update-available', (i) =>
    sendToAll('update:status', { state: 'available', version: i.version })
  )
  autoUpdater.on('update-not-available', () => sendToAll('update:status', { state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    sendToAll('update:status', { state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (i) => {
    sendToAll('update:status', { state: 'downloaded', version: i.version })
    notify('更新已就绪', `新版本 ${i.version} 已下载完成，请在「设置 → 检查更新」点击「立即重启更新」完成安装`)
  })
  autoUpdater.on('error', (e) => sendToAll('update:status', { state: 'error', message: String(e) }))
}

function registerIpc(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('pet-widget:sync', (_e, visible: boolean) => setPetWidgetVisible(Boolean(visible)))
  ipcMain.handle('pet-widget:hide', () => hidePetWidget())

  ipcMain.handle('store:get', (_e, name: keyof AppStores) => stores[name]?.all)
  ipcMain.handle('store:set', (e, name: keyof AppStores, value: Record<string, unknown>) => {
    const s = stores[name]
    if (!s) return false
    s.replace(value)
    if (name === 'settings') {
      // 浮窗是常驻窗口，不通知它就会一直用旧设置；
      // 发起方自己不发，免得输入过程中被回灌打断
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.webContents.id !== e.sender.id) win.webContents.send('settings:changed')
      }
      nativeTheme.themeSource = (value.theme as 'system' | 'light' | 'dark') ?? 'system'
      scheduler.reload()
      waterReminder.reload()
      healthReminder.reload()
      registerShortcuts()
      syncAutostart()
      const pcfg = value.pomodoro as { lockscreen?: boolean } | undefined
      if (!pcfg?.lockscreen) closeLock()
      if (value.widget) openWidget()
      else closeWidget()
    }
    if (name === 'desktopWidgets') {
      syncDesktopWidgets(desktopWidgetItems(), persistDesktopWidgetBounds)
      syncAutostart()
    }
    if (name === 'timetable') scheduler.reload()
    if (name === 'todos') todoReminder.check()
    if (
      name === 'desktopWidgets' ||
      name === 'countdowns' ||
      name === 'timetable' ||
      name === 'todos'
    ) {
      sendToAll('data:reloaded')
    }
    return true
  })

  ipcMain.handle('dialog:openFile', async (_e, filters?: Electron.FileFilter[]) => {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: filters || [] })
    return res.canceled ? '' : res.filePaths[0]
  })
  ipcMain.handle('dialog:openFiles', async (_e, filters?: Electron.FileFilter[]) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: filters || []
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('online:search', async (_e, keyword: string) => {
    const term = String(keyword ?? '').trim()
    if (!term) return []
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const api = `https://itunes.apple.com/search?term=${encodeURIComponent(
        term
      )}&media=music&limit=25&country=CN`
      const res = await net.fetch(api, { signal: controller.signal })
      if (!res.ok) return []
      const data = (await res.json()) as { results?: Array<Record<string, unknown>> }
      return (data.results ?? [])
        .filter((r) => typeof r.previewUrl === 'string' && r.previewUrl)
        .map((r) => ({
          name: String(r.trackName ?? '未知曲目'),
          artist: String(r.artistName ?? ''),
          url: String(r.previewUrl),
          duration: Math.round(Number(r.trackTimeMillis ?? 30000) / 1000)
        }))
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  })

  ipcMain.handle('playlist:import', async (_e, rawUrl: string) => {
    const parsed = await resolvePlaylist(rawUrl)
    if (!parsed) {
      return { ok: false, error: '无法识别歌单链接，请粘贴网易云/QQ音乐的歌单分享链接' }
    }
    const endpoint = (stores.settings.get('musicApi') as string) || DEFAULT_MUSIC_API
    const api = `${endpoint}${endpoint.includes('?') ? '&' : '?'}server=${parsed.server}&type=playlist&id=${encodeURIComponent(parsed.id)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await net.fetch(api, { signal: controller.signal })
      if (!res.ok) return { ok: false, error: `歌单接口返回 ${res.status}，可在设置更换音乐接口` }
      const data = (await res.json()) as Array<Record<string, unknown>>
      if (!Array.isArray(data) || !data.length) {
        return { ok: false, error: '未解析到歌单曲目（可能私密/接口受限）' }
      }
      const tracks = data
        .map((x) => ({
          name: String(x.name ?? x.title ?? '未知曲目'),
          artist: String(x.artist ?? x.author ?? ''),
          url: String(x.url ?? ''),
          duration: 0
        }))
        .filter((t) => t.url)
      if (!tracks.length) return { ok: false, error: '歌单曲目均无可用播放地址（多为版权限制）' }
      return { ok: true, tracks, server: parsed.server }
    } catch (e) {
      return { ok: false, error: '歌单解析失败：' + String(e).slice(0, 60) }
    } finally {
      clearTimeout(timer)
    }
  })

  ipcMain.handle('media:download', async (_e, url: string) => {
    try {
      const res = await net.fetch(url)
      if (!res.ok) return ''
      const buf = Buffer.from(await res.arrayBuffer())
      const dir = join(app.getPath('userData'), 'media')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const ext = guessExt(url, res.headers.get('content-type') || '')
      const fp = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
      writeFileSync(fp, buf)
      return fp
    } catch {
      return ''
    }
  })

  ipcMain.handle('pomodoro:start', (_e, options?: unknown) => {
    const raw = (options ?? {}) as Record<string, unknown>
    const mode = raw.mode
    engine.start({
      mode: mode === 'countup' || mode === 'untimed' || mode === 'countdown' ? mode : undefined,
      minutes: Number(raw.minutes) > 0 ? Number(raw.minutes) : undefined,
      targetId: typeof raw.targetId === 'string' ? raw.targetId : '',
      targetName: typeof raw.targetName === 'string' ? raw.targetName : ''
    })
  })
  ipcMain.handle('pomodoro:finish', () => engine.finish())
  ipcMain.handle('pomodoro:pause', () => engine.pause())
  ipcMain.handle('pomodoro:toggle', () => engine.toggle())
  ipcMain.handle('pomodoro:reset', () => engine.reset())
  ipcMain.handle('pomodoro:skip', () => engine.skip())
  ipcMain.handle('pomodoro:getState', () => engine.getState())

  ipcMain.handle('study-room:get-state', () => studyRoom.getState())
  ipcMain.handle('study-room:get-cheers', () => studyRoom.getCheers())
  ipcMain.handle('study-room:validate-name', (_e, kind: 'nickname' | 'room', text: string) =>
    studyRoom.validateName(kind, String(text ?? ''))
  )
  ipcMain.handle('study-room:set-nickname', (_e, nickname: string) =>
    studyRoom.setNickname(String(nickname ?? ''))
  )
  ipcMain.handle('study-room:host', (_e, options: { name: string; goalMinutes: number }) =>
    studyRoom.host({
      name: String(options?.name ?? ''),
      goalMinutes: Number(options?.goalMinutes ?? 0)
    })
  )
  ipcMain.handle('study-room:join', (_e, target: { address?: string; port?: number; code?: string }) =>
    studyRoom.join(target ?? {})
  )
  ipcMain.handle('study-room:leave', () => studyRoom.leave())
  ipcMain.handle('study-room:set-goal', (_e, goalMinutes: number) =>
    studyRoom.setGoal(Number(goalMinutes))
  )
  ipcMain.handle('study-room:cheer', (_e, toId: string, cheerId: string) =>
    studyRoom.cheer(String(toId ?? ''), String(cheerId ?? ''))
  )
  ipcMain.handle('study-room:discover-start', () => studyRoom.startDiscovery())
  ipcMain.handle('study-room:discover-stop', () => studyRoom.stopDiscovery())

  // 公网自习室。注意「自习室」是成员关系，「房间」是今天来不来学，两组接口不要混用
  ipcMain.handle('study-room:online-connect', () => studyRoom.onlineConnect())
  ipcMain.handle('study-room:online-snapshot', () => studyRoom.getOnlineSnapshot())
  ipcMain.handle('study-room:watch-browse', (_e, on: boolean) => studyRoom.watchBrowse(Boolean(on)))
  ipcMain.handle('study-room:go-offline', () => studyRoom.goOffline())
  ipcMain.handle('study-room:set-intro', (_e, intro: string) =>
    studyRoom.setIntro(String(intro ?? ''))
  )
  ipcMain.handle('study-room:checkin', (_e, kind: unknown, time: string) =>
    studyRoom.checkIn(kind === 'sleep' ? 'sleep' : 'wake', String(time ?? ''))
  )
  ipcMain.handle(
    'study-room:create',
    (_e, options: { name: string; intro: string; goalMinutes: number }) =>
      studyRoom.createRoom(
        String(options?.name ?? ''),
        String(options?.intro ?? ''),
        Number(options?.goalMinutes ?? 0)
      )
  )
  ipcMain.handle('study-room:join-room', (_e, params: { roomId?: string; code?: string }) =>
    studyRoom.joinStudyRoom({ roomId: params?.roomId, code: params?.code })
  )
  ipcMain.handle('study-room:quit-room', (_e, roomId: string) =>
    studyRoom.quitStudyRoom(String(roomId ?? ''))
  )
  ipcMain.handle('study-room:dissolve', (_e, roomId: string) =>
    studyRoom.dissolveStudyRoom(String(roomId ?? ''))
  )
  ipcMain.handle(
    'study-room:update-room',
    (_e, roomId: string, patch: { name?: string; intro?: string; goalMinutes?: number }) =>
      studyRoom.updateStudyRoom(String(roomId ?? ''), patch ?? {})
  )
  ipcMain.handle('study-room:enter', (_e, roomId: string) =>
    studyRoom.enterRoom(String(roomId ?? ''))
  )
  ipcMain.handle('study-room:exit', () => studyRoom.exitRoom())
  ipcMain.handle('study-room:set-range', (_e, range: unknown) =>
    studyRoom.setRoomRange(range === 'week' || range === 'month' ? range : 'today')
  )
  ipcMain.handle('study-room:wish-add', (_e, text: string) => studyRoom.addWish(String(text ?? '')))
  ipcMain.handle('study-room:wish-report', (_e, id: number) => studyRoom.reportWish(Number(id)))
  ipcMain.handle('study-room:wish-delete', (_e, id: number) => studyRoom.deleteWish(Number(id)))
  ipcMain.handle('study-room:link-create', () => studyRoom.createLinkCode())
  ipcMain.handle('study-room:link-claim', (_e, code: string) =>
    studyRoom.claimLinkCode(String(code ?? ''))
  )
  ipcMain.handle('study-room:wish-pending', () => studyRoom.listPendingWishes())
  ipcMain.handle('study-room:wish-restore', (_e, id: number) => studyRoom.restoreWish(Number(id)))

  ipcMain.handle('lockscreen:close', () => closeLock())

  ipcMain.handle('window:show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  ipcMain.handle('widget:toggle', () => {
    const open = toggleWidget()
    stores.settings.set('widget', open)
    return open
  })
  ipcMain.handle('widget:close', () => {
    closeWidget()
    stores.settings.set('widget', false)
  })
  ipcMain.handle('clockwidget:toggle', () => toggleClockWidget())
  ipcMain.handle('desktop-widget:close', (_e, id: string) => {
    const items = desktopWidgetItems()
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return false
    items[index] = { ...items[index], enabled: false }
    stores.desktopWidgets.set('items', items)
    syncDesktopWidgets(items, persistDesktopWidgetBounds)
    sendToAll('data:reloaded')
    return true
  })
  ipcMain.handle('desktop-widget:set-pointer-interactive', (_e, id: string, interactive: boolean) =>
    setDesktopWidgetPointerInteractive(id, Boolean(interactive))
  )
  ipcMain.handle('desktop-widget:begin-drag', (event, id: string) =>
    beginDesktopWidgetDrag(id, event.sender.id)
  )
  ipcMain.on('desktop-widget:move', (event, id: string, x: number, y: number) => {
    moveDesktopWidget(id, event.sender.id, Number(x), Number(y))
  })
  ipcMain.handle('desktop-widget:end-drag', (event, id: string, x: number, y: number) =>
    endDesktopWidgetDrag(id, event.sender.id, Number(x), Number(y))
  )

  ipcMain.handle('tray:setIcon', (_e, dataUrl: string) => {
    setupTrayFromDataUrl(dataUrl, trayHandlers())
  })

  ipcMain.handle('autostart:get', () => getAutostart())
  ipcMain.handle('autostart:set', (_e, v: boolean) => {
    setAutostart(v)
    return v
  })

  ipcMain.handle('shortcuts:update', () => registerShortcuts())
  ipcMain.handle('shortcuts:status', () => hotkeyFailures)
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('notify:show', (_e, title: string, body: string) => notify(title, body))
  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p))
  ipcMain.handle('fs:exists', (_e, p: string) => {
    try {
      return Boolean(p) && existsSync(p)
    } catch {
      return false
    }
  })

  ipcMain.handle('backup:export', async () => {
    const res = await dialog.showSaveDialog({
      defaultPath: `studydesk-backup-${localDateKey()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled) return { ok: true, canceled: true }
    if (!res.filePath) return { ok: false, error: '没有选择保存位置' }
    try {
      const all: Record<string, unknown> = {}
      for (const k of Object.keys(stores) as (keyof AppStores)[]) all[k] = stores[k].all
      // 备份是用户面对数据损坏时唯一的自救手段，写盘失败必须让他知道
      writeFileSync(res.filePath, JSON.stringify(all, null, 2), 'utf-8')
      return { ok: true, canceled: false }
    } catch (err) {
      console.error('[backup] 导出失败', err)
      return { ok: false, error: '写入备份文件失败，检查磁盘空间或换个位置' }
    }
  })
  ipcMain.handle('backup:import', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled) return { ok: true, canceled: true }
    if (!res.filePaths[0]) return { ok: false, error: '没有选择备份文件' }
    try {
      const data = JSON.parse(readFileSync(res.filePaths[0], 'utf-8')) as Record<string, unknown>
      const known = (Object.keys(stores) as (keyof AppStores)[]).filter((k) => data[k])
      if (known.length === 0) {
        return { ok: false, error: '这个文件里没有可识别的数据，确认是 StudyDesk 的备份吗？' }
      }
      for (const k of known) {
        stores[k].replace(data[k] as Record<string, unknown>)
      }
      const s = stores.settings.all
      nativeTheme.themeSource = (s.theme as 'system' | 'light' | 'dark') ?? 'system'
      scheduler.reload()
      waterReminder.reload()
      healthReminder.reload()
      registerShortcuts()
      syncAutostart()
      syncDesktopWidgets(desktopWidgetItems(), persistDesktopWidgetBounds)
      sendToAll('data:reloaded')
      return { ok: true, canceled: false }
    } catch (err) {
      console.error('[backup] 导入失败', err)
      return { ok: false, error: '备份文件损坏或格式不对，没能恢复' }
    }
  })

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { state: 'dev' }
    try {
      await autoUpdater.checkForUpdates()
      return { state: 'checking' }
    } catch (e) {
      return { state: 'error', message: String(e) }
    }
  })
  ipcMain.handle('update:install', () => {
    if (app.isPackaged) {
      // 先置退出标志，避免窗口 close 拦截阻断 quitAndInstall 的退出安装流程
      isQuitting = true
      setImmediate(() => autoUpdater.quitAndInstall())
    }
  })

  ipcMain.handle('timetable:export', async () => {
    const res = await dialog.showSaveDialog({
      defaultPath: 'timetable.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return false
    writeFileSync(res.filePath, JSON.stringify(stores.timetable.all, null, 2), 'utf-8')
    return true
  })
  ipcMain.handle('timetable:import', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    try {
      const data = JSON.parse(readFileSync(res.filePaths[0], 'utf-8'))
      if (data && Array.isArray(data.periods) && Array.isArray(data.lessons)) {
        stores.timetable.replace(data)
        scheduler.reload()
        return data
      }
      return null
    } catch {
      return null
    }
  })
}

app.whenReady().then(() => {
  stores = createStores()
  nativeTheme.themeSource = (stores.settings.get('theme') as 'system' | 'light' | 'dark') ?? 'system'

  protocol.handle('studymedia', (request) => {
    try {
      const url = new URL(request.url)
      const p = url.searchParams.get('p')
      if (!p) return new Response('missing path', { status: 400 })
      if (!isServableMediaPath(p)) return new Response('forbidden', { status: 403 })
      return net.fetch(pathToFileURL(resolve(p)).toString())
    } catch {
      return new Response('error', { status: 500 })
    }
  })

  engine = new PomodoroEngine(stores.settings, stores.stats, sendToAll, {
    onUpdate: (state) => {
      const cfg = stores.settings.get('pomodoro') as { lockscreen: boolean }
      if (cfg?.lockscreen && state.phase === 'work' && state.running) openLock()
      else closeLock()
      studyRoom?.reportFocus()
    },
    onEvent: (type) => {
      if (type === 'workComplete') notify('专注完成', '休息一下吧～')
      else if (type === 'breakComplete') notify('休息结束', '开始下一个番茄')
      if (type === 'workComplete') studyRoom?.notePomodoroComplete()
    }
  })

  studyRoom = new StudyRoomService({
    store: stores.studyRoom,
    send: sendToAll,
    notify,
    getCatId: () => String(stores.petCompanion.get('catId') ?? 'mikan'),
    getFocus: studyRoomFocus
  })

  scheduler = new BellScheduler(stores.settings, stores.timetable, sendToAll, notify)
  scheduler.start()

  waterReminder = new WaterReminder(stores.settings, notify, sendToAll)
  waterReminder.start()

  healthReminder = new HealthReminder(stores.settings, notify)
  healthReminder.start()

  todoReminder = new TodoReminder(stores.todos, notify, sendToAll)
  todoReminder.start()

  registerIpc()
  registerShortcuts()
  syncAutostart()
  createWindow()
  initTray()
  if (stores.settings.get('widget')) openWidget()
  syncDesktopWidgets(desktopWidgetItems(), persistDesktopWidgetBounds)

  setupUpdater()
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (boundsSaveTimer) {
    clearTimeout(boundsSaveTimer)
    boundsSaveTimer = null
  }
  persistMainWindowBounds()
  studyRoom?.dispose()
  // 这几个模块各自都实现了 stop，但之前一直没人调；进程退出时定时器虽然会随进程消失，
  // 手写清理清单终究会漏，新增模块时记得一并加进来
  scheduler?.stop()
  waterReminder?.stop()
  healthReminder?.stop()
  todoReminder?.stop()
  engine?.dispose()
  closeDesktopWidgets()
  closePetWidget()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // 关闭窗口默认隐藏到托盘常驻，只有用户在托盘选择「退出」(isQuitting) 时才真正退出程序
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})
