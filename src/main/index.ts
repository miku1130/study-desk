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
import { readFileSync, writeFileSync } from 'fs'
import { createStores, type AppStores } from './store'
import { PomodoroEngine } from './pomodoro'
import { BellScheduler } from './scheduler'
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
let stores: AppStores
let engine: PomodoroEngine
let scheduler: BellScheduler

function sendToAll(channel: string, ...args: unknown[]): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, ...args)
  }
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
