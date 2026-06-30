import { BrowserWindow } from 'electron'
import { join } from 'path'

let lockWin: BrowserWindow | null = null

export function openLock(): void {
  if (lockWin) return
  lockWin = new BrowserWindow({
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  lockWin.setAlwaysOnTop(true, 'screen-saver')

  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) lockWin.loadURL(`${base}#/lock`)
  else lockWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/lock' })

  lockWin.on('closed', () => {
    lockWin = null
  })
}

export function closeLock(): void {
  if (lockWin) {
    lockWin.close()
    lockWin = null
  }
}
