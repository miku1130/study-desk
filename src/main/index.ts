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
  globalShortcut
} from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createStores, type AppStores } from './store'
import { PomodoroEngine } from './pomodoro'
import { BellScheduler } from './scheduler'
import { WaterReminder } from './water'
import { HealthReminder } from './health'
import { localDateKey } from './time'
import { openLock, closeLock } from './lockscreen'
import { openWidget, closeWidget, toggleWidget } from './widget'
import { setupTray } from './tray'
import { autoUpdater } from 'electron-updater'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'studymedia',
    privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }
  }
])

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let trayHintShown = false
let stores: AppStores
let engine: PomodoroEngine
let scheduler: BellScheduler
let waterReminder: WaterReminder
let healthReminder: HealthReminder

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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1b1d' : '#eceef2',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  // 关闭按钮：默认隐藏到托盘后台常驻，仅在托盘「退出」或应用真正退出时才销毁窗口
  mainWindow.on('close', (e) => {
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

function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  const hk = stores.settings.get('hotkeys') as { toggleTimer: string; toggleWindow: string }
  try {
    if (hk?.toggleTimer) globalShortcut.register(hk.toggleTimer, () => engine.toggle())
  } catch {
    /* 热键冲突时忽略 */
  }
  try {
    if (hk?.toggleWindow) globalShortcut.register(hk.toggleWindow, () => toggleMainWindow())
  } catch {
    /* 热键冲突时忽略 */
  }
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
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
  autoUpdater.on('update-downloaded', (i) =>
    sendToAll('update:status', { state: 'downloaded', version: i.version })
  )
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

  ipcMain.handle('store:get', (_e, name: keyof AppStores) => stores[name]?.all)
  ipcMain.handle('store:set', (_e, name: keyof AppStores, value: Record<string, unknown>) => {
    const s = stores[name]
    if (!s) return false
    s.replace(value)
    if (name === 'settings') {
      nativeTheme.themeSource = (value.theme as 'system' | 'light' | 'dark') ?? 'system'
      scheduler.reload()
      waterReminder.reload()
      healthReminder.reload()
      registerShortcuts()
      app.setLoginItemSettings({ openAtLogin: Boolean(value.autostart) })
      const pcfg = value.pomodoro as { lockscreen?: boolean } | undefined
      if (!pcfg?.lockscreen) closeLock()
      if (value.widget) openWidget()
      else closeWidget()
    }
    if (name === 'timetable') scheduler.reload()
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

  ipcMain.handle('pomodoro:start', () => engine.start())
  ipcMain.handle('pomodoro:pause', () => engine.pause())
  ipcMain.handle('pomodoro:toggle', () => engine.toggle())
  ipcMain.handle('pomodoro:reset', () => engine.reset())
  ipcMain.handle('pomodoro:skip', () => engine.skip())
  ipcMain.handle('pomodoro:getState', () => engine.getState())

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

  ipcMain.handle('tray:setIcon', (_e, dataUrl: string) => {
    setupTray(dataUrl, {
      onToggleWindow: () => toggleMainWindow(),
      onToggleTimer: () => engine.toggle(),
      onToggleWidget: () => {
        const open = toggleWidget()
        stores.settings.set('widget', open)
      },
      onQuit: () => app.quit()
    })
  })

  ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('autostart:set', (_e, v: boolean) => {
    app.setLoginItemSettings({ openAtLogin: v })
    return v
  })

  ipcMain.handle('shortcuts:update', () => registerShortcuts())
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('notify:show', (_e, title: string, body: string) => notify(title, body))
  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p))

  ipcMain.handle('backup:export', async () => {
    const res = await dialog.showSaveDialog({
      defaultPath: `studydesk-backup-${localDateKey()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return false
    const all: Record<string, unknown> = {}
    for (const k of Object.keys(stores) as (keyof AppStores)[]) all[k] = stores[k].all
    writeFileSync(res.filePath, JSON.stringify(all, null, 2), 'utf-8')
    return true
  })
  ipcMain.handle('backup:import', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return false
    try {
      const data = JSON.parse(readFileSync(res.filePaths[0], 'utf-8')) as Record<string, unknown>
      for (const k of Object.keys(stores) as (keyof AppStores)[]) {
        if (data[k]) stores[k].replace(data[k] as Record<string, unknown>)
      }
      const s = stores.settings.all
      nativeTheme.themeSource = (s.theme as 'system' | 'light' | 'dark') ?? 'system'
      scheduler.reload()
      waterReminder.reload()
      healthReminder.reload()
      registerShortcuts()
      app.setLoginItemSettings({ openAtLogin: Boolean(s.autostart) })
      sendToAll('data:reloaded')
      return true
    } catch {
      return false
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
    if (app.isPackaged) autoUpdater.quitAndInstall()
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
      return net.fetch(pathToFileURL(p).toString())
    } catch {
      return new Response('error', { status: 500 })
    }
  })

  engine = new PomodoroEngine(stores.settings, stores.stats, sendToAll, {
    onUpdate: (state) => {
      const cfg = stores.settings.get('pomodoro') as { lockscreen: boolean }
      if (cfg?.lockscreen && state.phase === 'work' && state.running) openLock()
      else closeLock()
    },
    onEvent: (type) => {
      if (type === 'workComplete') notify('专注完成', '休息一下吧～')
      else notify('休息结束', '开始下一个番茄')
    }
  })

  scheduler = new BellScheduler(stores.settings, stores.timetable, sendToAll, notify)
  scheduler.start()

  waterReminder = new WaterReminder(stores.settings, notify, sendToAll)
  waterReminder.start()

  healthReminder = new HealthReminder(stores.settings, notify)
  healthReminder.start()

  registerIpc()
  registerShortcuts()
  app.setLoginItemSettings({ openAtLogin: Boolean(stores.settings.get('autostart')) })
  createWindow()
  if (stores.settings.get('widget')) openWidget()

  setupUpdater()
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // 关闭窗口默认隐藏到托盘常驻，只有用户在托盘选择「退出」(isQuitting) 时才真正退出程序
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})
