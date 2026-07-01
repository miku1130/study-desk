import { Tray, Menu, nativeImage, type NativeImage } from 'electron'

let tray: Tray | null = null

export interface TrayHandlers {
  onToggleWindow: () => void
  onToggleTimer: () => void
  onToggleWidget: () => void
  onQuit: () => void
}

/**
 * 创建或更新托盘图标。启动时由主进程用内置图标先建好（保证隐藏窗口后一定能从托盘恢复），
 * 渲染层就绪后再用强调色图标更新外观。
 */
export function setupTray(image: NativeImage, handlers: TrayHandlers): void {
  if (!tray) {
    tray = new Tray(image)
    tray.setToolTip('学习桌面 StudyDesk')
    const menu = Menu.buildFromTemplate([
      { label: '显示 / 隐藏窗口', click: () => handlers.onToggleWindow() },
      { label: '开始 / 暂停番茄钟', click: () => handlers.onToggleTimer() },
      { label: '显示 / 隐藏 桌面浮窗', click: () => handlers.onToggleWidget() },
      { type: 'separator' },
      { label: '退出', click: () => handlers.onQuit() }
    ])
    tray.setContextMenu(menu)
    tray.on('click', () => handlers.onToggleWindow())
  } else if (!image.isEmpty()) {
    tray.setImage(image)
  }
}

/** 由 dataURL（渲染层 canvas 生成的强调色图标）更新托盘。 */
export function setupTrayFromDataUrl(dataUrl: string, handlers: TrayHandlers): void {
  setupTray(nativeImage.createFromDataURL(dataUrl), handlers)
}
