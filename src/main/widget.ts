import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import {
  attachWindowToDesktop,
  inspectDesktopAttachment,
  type DesktopLayerStatus
} from './windowsDesktopLayer'

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
const desktopWidgetConfigs = new Map<string, DesktopWidgetConfig>()
const desktopLayerTasks = new Map<string, Promise<DesktopLayerStatus | null>>()
let onDesktopWidgetBounds: BoundsHandler | null = null
let desktopLayerHealthTimer: NodeJS.Timeout | null = null

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

/**
 * Windows 上 setIgnoreMouseEvents(false) 会连同 WS_EX_TRANSPARENT 一起清掉 WS_EX_LAYERED，
 * 而 Win11 raised-desktop 模式下摆件正是靠这个扩展样式才能在桌面层显示（见 windowsDesktopLayer 的 attach）。
 * 样式被清掉后窗口依然是桌面层的子窗口，健康检查查到 attached 仍为 true，不会自愈，
 * 表现就是鼠标一碰摆件卡片就凭空消失。这里用一次几乎看不见的透明度变化让 Electron 把该样式加回来。
 */
function setPointerPassthrough(win: BrowserWindow, passthrough: boolean): void {
  win.setIgnoreMouseEvents(passthrough, { forward: true })
  if (passthrough || process.platform !== 'win32' || win.isDestroyed()) return
  win.setOpacity(0.999)
  win.setOpacity(1)
}

function applyDesktopWidgetConfig(
  win: BrowserWindow,
  config: DesktopWidgetConfig,
  resizeToConfiguredSize = true
): void {
  const locked = Boolean(config.locked)
  win.setMovable(!locked)
  // 透明摆件只允许通过渲染层右下角手柄调整尺寸，避免系统边缘缩放触发持续放大。
  win.setResizable(false)
  // 摆件位于 Explorer 桌面层，不需要置顶，也不会遮挡其他应用。
  win.setAlwaysOnTop(false)
  setPointerPassthrough(win, locked)
  const bounds = win.getBounds()
  const size = resizeToConfiguredSize ? widgetDimensions(config) : { width: bounds.width, height: bounds.height }
  const next = fitToDisplay({ ...bounds, ...size })
  if (
    bounds.x !== next.x ||
    bounds.y !== next.y ||
    bounds.width !== next.width ||
    bounds.height !== next.height
  ) {
    win.setBounds(next)
    void attachDesktopLayer(config.id, win, next)
  }
}

function attachDesktopLayer(
  id: string,
  win: BrowserWindow,
  bounds = win.getBounds()
): Promise<DesktopLayerStatus | null> {
  const currentTask = desktopLayerTasks.get(id)
  if (currentTask) return currentTask

  const task = attachWindowToDesktop(win, bounds)
    .catch((error) => {
      console.warn(`[desktop-widget] 挂载桌面层失败 (${id}):`, error)
      return null
    })
    .finally(() => desktopLayerTasks.delete(id))
  desktopLayerTasks.set(id, task)
  return task
}

function stopDesktopLayerHealthCheck(): void {
  if (!desktopLayerHealthTimer) return
  clearInterval(desktopLayerHealthTimer)
  desktopLayerHealthTimer = null
}

function startDesktopLayerHealthCheck(): void {
  if (process.platform !== 'win32' || desktopLayerHealthTimer) return
  desktopLayerHealthTimer = setInterval(() => {
    for (const [id, win] of desktopWidgetWins) {
      if (win.isDestroyed() || desktopLayerTasks.has(id)) continue
      void inspectDesktopAttachment(win)
        .then((status) => {
          if (!status.attached && !win.isDestroyed()) void attachDesktopLayer(id, win)
        })
        .catch((error) => {
          console.warn(`[desktop-widget] 检查桌面层失败 (${id}):`, error)
        })
    }
  }, 30_000)
  desktopLayerHealthTimer.unref()
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
    // 透明无边框窗口在部分 Windows 桌面层环境中会出现原生边缘缩放持续增长。
    // 尺寸改由渲染层的受控手柄驱动，主进程统一限幅并持久化。
    resizable: false,
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
  setPointerPassthrough(win, Boolean(config.locked))

  const target = desktopWidgetUrl(config.id)
  if (target.url) win.loadURL(target.url)
  else win.loadFile(target.file!, { hash: target.hash })
  win.once('ready-to-show', () => {
    void attachDesktopLayer(config.id, win, initialBounds).finally(() => {
      if (!win.isDestroyed()) win.showInactive()
    })
  })

  const persistBounds = (): void => {
    if (!win.isDestroyed()) onDesktopWidgetBounds?.(config.id, win.getBounds())
  }
  win.on('moved', persistBounds)
  win.on('resized', persistBounds)
  win.on('closed', () => {
    desktopWidgetWins.delete(config.id)
    desktopWidgetConfigs.delete(config.id)
    desktopLayerTasks.delete(config.id)
    if (desktopWidgetWins.size === 0) stopDesktopLayerHealthCheck()
  })
  desktopWidgetWins.set(config.id, win)
  desktopWidgetConfigs.set(config.id, config)
  startDesktopLayerHealthCheck()
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
    const previous = desktopWidgetConfigs.get(id)
    // 原生窗口边缘拖拽产生的宽高优先保留；只有用户切换 size 档位才重新套用档位尺寸。
    applyDesktopWidgetConfig(win, config, previous?.size !== config.size)
    desktopWidgetConfigs.set(id, config)
    win.webContents.send('desktop-widget:config-changed')
    enabled.delete(id)
  }

  let index = desktopWidgetWins.size
  for (const config of enabled.values()) createDesktopWidget(config, index++)
}

export function closeDesktopWidgets(): void {
  for (const win of desktopWidgetWins.values()) win.close()
  desktopWidgetWins.clear()
  desktopWidgetConfigs.clear()
  desktopLayerTasks.clear()
  stopDesktopLayerHealthCheck()
}

export function setDesktopWidgetPointerInteractive(id: string, interactive: boolean): boolean {
  const win = desktopWidgetWins.get(id)
  if (!win || win.isDestroyed()) return false
  setPointerPassthrough(win, !interactive)
  return true
}

export function resizeDesktopWidget(id: string, senderId: number, width: number, height: number): boolean {
  const win = movableDesktopWidget(id, senderId)
  if (!win || !Number.isFinite(width) || !Number.isFinite(height)) return false
  const bounds = win.getBounds()
  const next = fitToDisplay({
    ...bounds,
    width: Math.max(220, Math.min(800, Math.round(width))),
    height: Math.max(150, Math.min(600, Math.round(height)))
  })
  if (bounds.width === next.width && bounds.height === next.height) return true
  win.setBounds(next)
  onDesktopWidgetBounds?.(id, win.getBounds())
  return true
}

/** 读取原生窗口的实时尺寸，避免渲染层旧配置覆盖用户刚完成的调整。 */
export function getDesktopWidgetBounds(id: string): { x: number; y: number; width: number; height: number } | null {
  const win = desktopWidgetWins.get(id)
  if (!win || win.isDestroyed()) return null
  return win.getBounds()
}

function movableDesktopWidget(id: string, senderId: number): BrowserWindow | null {
  const win = desktopWidgetWins.get(id)
  const config = desktopWidgetConfigs.get(id)
  if (!win || win.isDestroyed() || win.webContents.id !== senderId || config?.locked) return null
  return win
}

export function beginDesktopWidgetDrag(
  id: string,
  senderId: number
): { x: number; y: number; width: number; height: number } | null {
  return movableDesktopWidget(id, senderId)?.getBounds() ?? null
}

export function moveDesktopWidget(id: string, senderId: number, x: number, y: number): boolean {
  const win = movableDesktopWidget(id, senderId)
  if (!win || !Number.isFinite(x) || !Number.isFinite(y)) return false
  const next = fitToDisplay({ ...win.getBounds(), x: Math.round(x), y: Math.round(y) })
  win.setPosition(next.x, next.y)
  return true
}

export async function endDesktopWidgetDrag(
  id: string,
  senderId: number,
  x: number,
  y: number
): Promise<boolean> {
  const win = movableDesktopWidget(id, senderId)
  if (!win || !moveDesktopWidget(id, senderId, x, y)) return false
  const bounds = win.getBounds()
  await attachDesktopLayer(id, win, bounds)
  onDesktopWidgetBounds?.(id, bounds)
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
