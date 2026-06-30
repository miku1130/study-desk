import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

let widgetWin: BrowserWindow | null = null

export function openWidget(): void {
  if (widgetWin) {
    widgetWin.show()
    return
  }
  const { workAreaSize } = screen.getPrimaryDisplay()
  const w = 264
  const h = 152
  widgetWin = new BrowserWindow({
    width: w,
    height: h,
    x: workAreaSize.width - w - 24,
    y: 56,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#1b1b1d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  widgetWin.setAlwaysOnTop(true, 'floating')

  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) widgetWin.loadURL(`${base}#/widget`)
  else widgetWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/widget' })

  widgetWin.on('closed', () => {
    widgetWin = null
  })
}

export function closeWidget(): void {
  if (widgetWin) {
    widgetWin.close()
    widgetWin = null
  }
}

export function isWidgetOpen(): boolean {
  return !!widgetWin
}

export function toggleWidget(): boolean {
  if (widgetWin) {
    closeWidget()
    return false
  }
  openWidget()
  return true
}
