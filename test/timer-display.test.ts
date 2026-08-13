import { describe, expect, it } from 'vitest'
import { timerFace } from '../src/renderer/src/lib/timerDisplay'

const base = { phase: 'work', mode: 'countdown', remaining: 0, elapsed: 0, total: 0, running: true } as const

describe('计时卡片显示', () => {
  it('倒计时显示剩余时间', () => {
    const face = timerFace({ ...base, remaining: 1499, total: 1500 }, 1500)
    expect(face.clock).toBe('24:59')
    expect(face.label).toBe('')
  })

  it('正计时显示已经过去的时间', () => {
    const face = timerFace({ ...base, mode: 'countup', elapsed: 65 }, 0)
    expect(face.clock).toBe('01:05')
  })

  it('正计时的休息段仍然是倒计时', () => {
    // 引擎只对专注段取消倒计时，休息一律有终点；按模式判断会在这里显示成已过时间
    const face = timerFace(
      { ...base, mode: 'countup', phase: 'short', remaining: 300, elapsed: 12, total: 300 },
      0
    )
    expect(face.clock).toBe('05:00')
  })

  it('不计时的专注段不给数字，只给一句话', () => {
    const face = timerFace({ ...base, mode: 'untimed', elapsed: 900 }, 0)
    expect(face.clock).toBe('')
    expect(face.label).toBe('在学')
    expect(face.digits).toBeNull()
  })

  it('不计时的休息段照常显示倒计时', () => {
    const face = timerFace(
      { ...base, mode: 'untimed', phase: 'long', remaining: 599, total: 900 },
      0
    )
    expect(face.clock).toBe('09:59')
    expect(face.label).toBe('')
  })

  it('空闲时显示准备开始的时长', () => {
    expect(timerFace({ ...base, phase: 'idle', running: false }, 2700).clock).toBe('45:00')
    // 正计时没有预设终点，从零起步
    expect(
      timerFace({ ...base, phase: 'idle', mode: 'countup', running: false }, 0).clock
    ).toBe('00:00')
  })

  it('翻页与像素样式要四位数字，超过 99 分钟就不给', () => {
    const short = timerFace({ ...base, mode: 'countup', elapsed: 61 }, 0)
    expect(short.digits).toEqual(['0', '1', '0', '1'])

    const long = timerFace({ ...base, mode: 'countup', elapsed: 100 * 60 + 4 }, 0)
    expect(long.clock).toBe('100:04')
    expect(long.digits).toBeNull()
  })

  it('负数与脏数据当作零，不会显示 NaN', () => {
    const face = timerFace({ ...base, remaining: -5, total: 1500 }, 1500)
    expect(face.clock).toBe('00:00')
  })
})
