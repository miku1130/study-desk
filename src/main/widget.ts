import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

export interface DesktopWidgetConfig {
  id: string
  enabled?: boolean
  launchOnStartup?: boolean
  locked?: boolean
  alwaysOnTop?: boolean
  size?: 'small' | 'medium' | 'large'
  x?: number
  y?: number
  width?: number
  height?: number
}

type BoundsHandler = (id: string, bounds: { x: number; y: number; width: number; height: number }) => void

const desktopWidgetWins = new Map<string, BrowserWindow>()
let onDesktopWidgetBounds: BoundsHandler | null = null

const WIDGET_SIZES = {
  small: { width: 248, height: 176 },
  medium: { width: 340, height: 218 },
  large: { width: 430, height: 330 }
}

function widgetDimensions(config: DesktopWidgetConfig): { width: number; height: number } {
  const fallback = WIDGET_SIZES[config.size ?? 'medium']
  return {
    width: Math.max(220, Math.min(800, Number(config.width) || fallback.width)),
    height: Math.max(150, Math.min(600, Number(config.height) || fallback.height))
  }
}

function fitToDisplay(bounds: { x: number; y: number; width: number; height: number }): typeof bounds {
  const area = screen.getDisplayMatching(bounds).workArea
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, area.x), area.x + Math.max(0, area.width - bounds.width)),
    y: Math.min(Math.max(bounds.y, area.y), area.y + Math.max(0, area.height - bounds.height))
  }
}

function desktopWidgetUrl(id: string): { url?: string; file?: string; hash?: string } {
  const route = `/desktop-widget/${encodeURIComponent(id)}`
  const base = process.env['ELECTRON_RENDERER_URL']
  return base
    ? { url: `${base}#${route}` }
    : { file: join(__dirname, '../renderer/index.html'), hash: route }
}

function applyDesktopWidgetConfig(win: BrowserWindow, config: DesktopWidgetConfig): void {
  const locked = Boolean(config.locked)
  win.setMovable(!locked)
  win.setResizable(!locked)
  // 桌面摆件使用普通窗口层级，切换到其他应用时不会遮挡其内容。
  win.setAlwaysOnTop(false)
  win.setIgnoreMouseEvents(locked, { forward: true })
  const bounds = win.getBounds()
  const size = widgetDimensions(config)
  const next = fitToDisplay({ ...bounds, ...size })
  if (
    bounds.x !== next.x ||
    bounds.y !== next.y ||
    bounds.width !== next.width ||
    bounds.height !== next.height
  ) {
    win.setBounds(next)
  }
}

function createDesktopWidget(config: DesktopWidgetConfig, index: number): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const { width, height } = widgetDimensions(config)
  const initialBounds = fitToDisplay({
    width,
    height,
    x: config.x ?? workArea.x + workArea.width - width - 24,
    y: config.y ?? workArea.y + 56 + index * 28
  })
  const win = new BrowserWindow({
    ...initialBounds,
    show: false,
    minWidth: 220,
    minHeight: 150,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: !config.locked,
    movable: !config.locked,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  win.setAlwaysOnTop(false)
  win.setIgnoreMouseEvents(Boolean(config.locked), { forward: true })

  const target = desktopWidgetUrl(config.id)
  if (target.url) win.loadURL(target.url)
  else win.loadFile(target.file!, { hash: target.hash })
  win.once('ready-to-show', () => win.showInactive())

  const persistBounds = (): void => {
    if (!win.isDestroyed()) onDesktopWidgetBounds?.(config.id, win.getBounds())
  }
  win.on('moved', persistBounds)
  win.on('resized', persistBounds)
  win.on('closed', () => desktopWidgetWins.delete(config.id))
  desktopWidgetWins.set(config.id, win)
  return win
}

export function syncDesktopWidgets(
  configs: DesktopWidgetConfig[],
  boundsHandler?: BoundsHandler
): void {
  if (boundsHandler) onDesktopWidgetBounds = boundsHandler
  const enabled = new Map(configs.filter((item) => item.enabled !== false).map((item) => [item.id, item]))

  for (const [id, win] of desktopWidgetWins) {
    const config = enabled.get(id)
    if (!config) {
      win.close()
      continue
    }
    applyDesktopWidgetConfig(win, config)
    win.webContents.send('desktop-widget:config-changed')
    enabled.delete(id)
  }

  let index = desktopWidgetWins.size
  for (const config of enabled.values()) createDesktopWidget(config, index++)
}

export function closeDesktopWidgets(): void {
  for (const win of desktopWidgetWins.values()) win.close()
  desktopWidgetWins.clear()
}

export function setDesktopWidgetPointerInteractive(id: string, interactive: boolean): boolean {
  const win = desktopWidgetWins.get(id)
  if (!win || win.isDestroyed()) return false
  win.setIgnoreMouseEvents(!interactive, { forward: true })
  return true
}

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

let clockWin: BrowserWindow | null = null

/** 番茄钟专用的时钟小浮窗（置顶、可拖、独立于桌面浮窗） */
export function toggleClockWidget(): boolean {
  if (clockWin) {
    clockWin.close()
    clockWin = null
    return false
  }
  const { workAreaSize } = screen.getPrimaryDisplay()
  const w = 240
  const h = 150
  clockWin = new BrowserWindow({
    width: w,
    height: h,
    x: workAreaSize.width - w - 24,
    y: 232,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#08080c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  clockWin.setAlwaysOnTop(true, 'floating')

  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) clockWin.loadURL(`${base}#/clockwidget`)
  else clockWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/clockwidget' })

  clockWin.on('closed', () => {
    clockWin = null
  })
  return true
}

export function closeClockWidget(): void {
  if (clockWin) {
    clockWin.close()
    clockWin = null
  }
}
