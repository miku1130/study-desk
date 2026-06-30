function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 用 canvas 生成托盘图标（强调色圆角方 + 白色时钟），返回 PNG dataURL。 */
export function makeTrayIcon(accent: string): string {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = accent
  roundRect(ctx, 1, 1, 30, 30, 7)
  ctx.fill()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(16, 16, 8, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(16, 16)
  ctx.lineTo(16, 11)
  ctx.moveTo(16, 16)
  ctx.lineTo(20, 17.5)
  ctx.stroke()

  return c.toDataURL('image/png')
}
