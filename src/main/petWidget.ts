import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

let petWidgetWin: BrowserWindow | null = null
let petWidgetRequested = false

function createPetWidget(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const width = 230
  const height = 238
  const margin = 22
  const win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - margin,
    y: display.workArea.y + display.workArea.height - height - margin,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      // 挂件永远不是焦点窗口，开着节流猫会卡住不动；隐藏时再由 setThrottling 关掉
      backgroundThrottling: false
    }
  })

  win.setAlwaysOnTop(true, 'floating', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })

  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) void win.loadURL(`${base}#/pet-widget`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pet-widget' })

  win.webContents.once('did-finish-load', () => {
    if (!petWidgetRequested || win.isDestroyed()) return
    win.setAlwaysOnTop(true, 'floating', 1)
    win.showInactive()
    win.moveTop()
  })

  win.on('closed', () => {
    petWidgetWin = null
  })
  return win
}

/**
 * 隐藏的挂件不该继续按 60fps 画猫。
 * 窗口是 hide 而不是 destroy（避免每次重开都闪一下白），
 * 所以要手动把节流打开，否则动画和计时在看不见的时候照样烧 CPU。
 */
function setThrottling(win: BrowserWindow | null, throttled: boolean): void {
  if (!win || win.isDestroyed()) return
  win.webContents.setBackgroundThrottling(throttled)
}

export function setPetWidgetVisible(visible: boolean): void {
  petWidgetRequested = visible
  if (!visible) {
    setThrottling(petWidgetWin, true)
    petWidgetWin?.hide()
    return
  }
  if (!petWidgetWin || petWidgetWin.isDestroyed()) petWidgetWin = createPetWidget()
  setThrottling(petWidgetWin, false)
  if (!petWidgetWin.webContents.isLoading()) {
    petWidgetWin.setAlwaysOnTop(true, 'floating', 1)
    petWidgetWin.showInactive()
    petWidgetWin.moveTop()
  }
}

export function hidePetWidget(): void {
  petWidgetRequested = false
  setThrottling(petWidgetWin, true)
  petWidgetWin?.hide()
}

export function closePetWidget(): void {
  petWidgetRequested = false
  petWidgetWin?.destroy()
  petWidgetWin = null
}
