import { BrowserWindow } from 'electron'
import { join } from 'path'
import { createLockController, type LockWindowHandle } from './lockController'

function createLockWindow(): LockWindowHandle {
  const win = new BrowserWindow({
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
  win.setAlwaysOnTop(true, 'screen-saver')

  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) void win.loadURL(`${base}#/lock`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/lock' })

  return {
    isDestroyed: () => win.isDestroyed(),
    destroy: () => win.destroy(),
    onClosed: (listener) => win.once('closed', listener)
  }
}

const controller = createLockController(createLockWindow)

export function openLock(): void {
  controller.open()
}

export function closeLock(): void {
  controller.close()
}

export function isLockOpen(): boolean {
  return controller.isOpen()
}
