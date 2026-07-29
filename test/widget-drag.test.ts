import { describe, expect, it } from 'vitest'
import { calculateWidgetDragPosition } from '../src/renderer/src/lib/widgetDrag'

describe('desktop widget dragging', () => {
  it('moves the window by the pointer delta in screen coordinates', () => {
    expect(
      calculateWidgetDragPosition({ x: 1200, y: 80 }, { x: 1300, y: 140 }, { x: 1115, y: 315 })
    ).toEqual({ x: 1015, y: 255 })
  })

  it('rounds fractional coordinates before sending them to Electron', () => {
    expect(
      calculateWidgetDragPosition({ x: 100, y: 200 }, { x: 25.25, y: 40.75 }, { x: 35.75, y: 20.25 })
    ).toEqual({ x: 111, y: 180 })
  })
})
