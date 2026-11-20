/** 锁定后的摆件整体鼠标穿透，只有这些元素仍需接收点击 */
export const WIDGET_INTERACTIVE_SELECTOR = '.widget-lock-toggle, .todo-attachment-open'

export interface PointerInteractiveDecision {
  /** 本地应记录的状态 */
  interactive: boolean
  /** 是否需要通知主进程切换穿透 */
  send: boolean
}

/**
 * 决定锁定摆件此刻要不要接收鼠标。
 * 未锁定时窗口本来就整体可交互（由配置同步负责），这里只清本地标记，
 * 一旦误发 interactive=false 会让没锁的摆件也变成穿透。
 */
export function resolvePointerInteractive(
  locked: boolean,
  overInteractive: boolean,
  current: boolean
): PointerInteractiveDecision {
  if (!locked) return { interactive: false, send: false }
  return { interactive: overInteractive, send: overInteractive !== current }
}

/**
 * 锁定后的摆件只能靠主进程转发的鼠标移动来判断指针是否落在小锁上。
 * 摆件被其他窗口遮住时，转发出来的悬停同样会触发 Chromium 原生的 title 提示条，
 * 而窗口收不到真实的离开事件，提示条便会一直浮在其他应用上方无法关闭。
 * 因此锁定态一律不输出原生提示文本，按钮语义交给 aria-label。
 */
export function widgetTooltipText(locked: boolean, text: string): string | undefined {
  return locked ? undefined : text
}
