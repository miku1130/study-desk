/**
 * 主窗口位置的恢复规则。
 *
 * 直接把上次的坐标塞回去是不行的：在外接屏上关的应用，第二天不接屏再打开，
 * 窗口会开在屏幕外——用户看不见任何东西，只会以为程序没启动。
 */

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayArea {
  workArea: Bounds
}

export interface WindowSizeLimits {
  width: number
  height: number
  minWidth: number
  minHeight: number
}

export interface ResolvedWindowState {
  /** null 表示交给 Electron 按默认尺寸自行摆放 */
  bounds: Bounds | null
  maximized: boolean
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBounds(value: unknown): Bounds | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const x = num(raw.x)
  const y = num(raw.y)
  const width = num(raw.width)
  const height = num(raw.height)
  if (x === null || y === null || width === null || height === null) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function centerOf(bounds: Bounds): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function contains(area: Bounds, point: { x: number; y: number }): boolean {
  return (
    point.x >= area.x &&
    point.x <= area.x + area.width &&
    point.y >= area.y &&
    point.y <= area.y + area.height
  )
}

export function resolveWindowBounds(
  saved: unknown,
  displays: DisplayArea[],
  limits: WindowSizeLimits
): ResolvedWindowState {
  const state = (saved ?? {}) as Record<string, unknown>
  const maximized = state.maximized === true
  const bounds = readBounds(state.bounds)
  if (!bounds || displays.length === 0) return { bounds: null, maximized }

  // 窗口中心落在哪块屏上就归哪块屏；都不在（屏幕拔了）就回到第一块
  const center = centerOf(bounds)
  const host = displays.find((display) => contains(display.workArea, center))
  const area = (host ?? displays[0]).workArea

  const width = Math.min(Math.max(bounds.width, limits.minWidth), area.width)
  const height = Math.min(Math.max(bounds.height, limits.minHeight), area.height)

  let x = bounds.x
  let y = bounds.y
  if (!host) {
    // 换屏了就居中，沿用旧坐标只会继续偏在角上
    x = area.x + Math.round((area.width - width) / 2)
    y = area.y + Math.round((area.height - height) / 2)
  } else {
    x = Math.min(Math.max(x, area.x), area.x + area.width - width)
    y = Math.min(Math.max(y, area.y), area.y + area.height - height)
  }

  return { bounds: { x: Math.round(x), y: Math.round(y), width, height }, maximized }
}
