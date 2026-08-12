import { describe, expect, it } from 'vitest'
import { resolveWindowBounds } from '../src/main/windowBounds'

const DEFAULTS = { width: 1180, height: 760, minWidth: 940, minHeight: 620 }
const LAPTOP = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } }
/** 挂在左边的外接屏，坐标为负 */
const EXTERNAL = { workArea: { x: -1920, y: 0, width: 1920, height: 1040 } }

describe('主窗口位置恢复', () => {
  it('没有保存过就交给 Electron 用默认尺寸居中', () => {
    expect(resolveWindowBounds(undefined, [LAPTOP], DEFAULTS)).toEqual({
      bounds: null,
      maximized: false
    })
    expect(resolveWindowBounds({}, [LAPTOP], DEFAULTS).bounds).toBeNull()
    expect(resolveWindowBounds({ bounds: { x: 'a' } }, [LAPTOP], DEFAULTS).bounds).toBeNull()
  })

  it('完全在屏内的位置原样恢复', () => {
    const saved = { bounds: { x: 120, y: 80, width: 1200, height: 800 }, maximized: false }
    expect(resolveWindowBounds(saved, [LAPTOP], DEFAULTS)).toEqual({
      bounds: { x: 120, y: 80, width: 1200, height: 800 },
      maximized: false
    })
  })

  it('外接屏拔掉后窗口落回主屏中间，而不是开在看不见的地方', () => {
    const saved = { bounds: { x: -1500, y: 200, width: 1200, height: 800 } }
    const { bounds } = resolveWindowBounds(saved, [LAPTOP], DEFAULTS)
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1920)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
  })

  it('外接屏还在就留在外接屏上', () => {
    const saved = { bounds: { x: -1500, y: 200, width: 1200, height: 800 } }
    const { bounds } = resolveWindowBounds(saved, [LAPTOP, EXTERNAL], DEFAULTS)
    expect(bounds).toEqual({ x: -1500, y: 200, width: 1200, height: 800 })
  })

  it('尺寸小于最小值时提到最小值', () => {
    const saved = { bounds: { x: 10, y: 10, width: 300, height: 200 } }
    const { bounds } = resolveWindowBounds(saved, [LAPTOP], DEFAULTS)
    expect(bounds).toMatchObject({ width: 940, height: 620 })
  })

  it('尺寸超过工作区时收进工作区', () => {
    const small = { workArea: { x: 0, y: 0, width: 1280, height: 720 } }
    const saved = { bounds: { x: 0, y: 0, width: 2400, height: 1600 } }
    const { bounds } = resolveWindowBounds(saved, [small], DEFAULTS)
    expect(bounds).toMatchObject({ width: 1280, height: 720 })
  })

  it('标题栏跑到屏幕外时推回可见区域', () => {
    const saved = { bounds: { x: 1850, y: -300, width: 1200, height: 800 } }
    const { bounds } = resolveWindowBounds(saved, [LAPTOP], DEFAULTS)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1920)
  })

  it('最大化状态照原样带回来', () => {
    const saved = { bounds: { x: 0, y: 0, width: 1200, height: 800 }, maximized: true }
    expect(resolveWindowBounds(saved, [LAPTOP], DEFAULTS).maximized).toBe(true)
  })

  it('一块显示器都读不到时不做恢复', () => {
    const saved = { bounds: { x: 0, y: 0, width: 1200, height: 800 } }
    expect(resolveWindowBounds(saved, [], DEFAULTS).bounds).toBeNull()
  })
})
