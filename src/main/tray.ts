import { Tray, Menu, nativeImage } from 'electron'

let tray: Tray | null = null

interface TrayHandlers {
  onToggleWindow: () => void
  onToggleTimer: () => void
  onToggleWidget: () => void
  onQuit: () => void
}

/**
 * 托盘图标由渲染层用 canvas 生成 dataURL 传入，避免内置二进制资源。
 */
export function setupTray(dataUrl: string, handlers: TrayHandlers): void {
  const image = nativeImage.createFromDataURL(dataUrl)
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
  } else {
    tray.setImage(image)
  }
}
