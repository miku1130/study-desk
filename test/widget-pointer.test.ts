import { describe, expect, it } from 'vitest'
import { resolvePointerInteractive } from '../src/renderer/src/lib/widgetPointer'

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
