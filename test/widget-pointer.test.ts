import { describe, expect, it } from 'vitest'
import { resolvePointerInteractive, widgetTooltipText } from '../src/renderer/src/lib/widgetPointer'

describe('锁定摆件的鼠标穿透状态', () => {
  it('指针移到小锁上时让窗口接收鼠标', () => {
    expect(resolvePointerInteractive(true, true, false)).toEqual({ interactive: true, send: true })
  })

  it('指针仍在小锁上时不重复下发', () => {
    expect(resolvePointerInteractive(true, true, true)).toEqual({ interactive: true, send: false })
  })

  it('指针离开小锁后恢复穿透', () => {
    expect(resolvePointerInteractive(true, false, true)).toEqual({ interactive: false, send: true })
  })

  it('指针本来就不在小锁上时保持静默', () => {
    expect(resolvePointerInteractive(true, false, false)).toEqual({ interactive: false, send: false })
  })

  // 指针直接飞出窗口时收不到 mousemove，必须由 mouseleave 兜底，否则窗口会一直抓着鼠标，
  // 「解锁摆件」的系统提示条也会卡在最顶层不消失
  it('指针离开窗口按未悬停处理，把交互状态收回来', () => {
    expect(resolvePointerInteractive(true, false, true)).toEqual({ interactive: false, send: true })
  })

  // 未锁定时窗口整体可交互，由配置同步负责；这里只清本地标记，
  // 若误发 interactive=false 会让没锁的摆件变成鼠标穿透
  it('解锁后只清除本地标记，不下发穿透', () => {
    expect(resolvePointerInteractive(false, false, true)).toEqual({ interactive: false, send: false })
    expect(resolvePointerInteractive(false, true, true)).toEqual({ interactive: false, send: false })
  })
})

describe('锁定摆件的原生提示条', () => {
  // 摆件被其他窗口遮住时，转发的悬停会让 Chromium 为 title 弹提示条，
  // 而窗口收不到真实的离开事件，提示条会一直浮在其他应用上方
  it('锁定后不输出 title，避免提示条卡住', () => {
    expect(widgetTooltipText(true, '解锁摆件')).toBeUndefined()
  })

  it('未锁定时保留原生提示', () => {
    expect(widgetTooltipText(false, '锁定摆件')).toBe('锁定摆件')
  })
})
