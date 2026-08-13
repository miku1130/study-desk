import { describe, expect, it } from 'vitest'
import { buildHeatmap, heatLevel } from '../src/renderer/src/lib/heatmap'

/** 2026-08-13 是周四 */
const TODAY = new Date(2026, 7, 13)

describe('热力等级', () => {
  it('没学过是 0，学过就至少是 1', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
  })

  it('时长越长等级越高，最高 4 级', () => {
    const levels = [15, 45, 90, 200, 600].map(heatLevel)
    expect(levels[0]).toBeLessThanOrEqual(levels[1])
    expect(levels[1]).toBeLessThanOrEqual(levels[2])
    expect(levels[2]).toBeLessThanOrEqual(levels[3])
    expect(Math.max(...levels)).toBe(4)
    expect(levels.every((l) => l >= 1 && l <= 4)).toBe(true)
  })
})

describe('热力图网格', () => {
  it('按周分列，每列七天，最后一天就是今天', () => {
    const grid = buildHeatmap({}, { weeks: 4, today: TODAY })
    expect(grid.weeks).toHaveLength(4)
    expect(grid.weeks.every((w) => w.days.length === 7)).toBe(true)

    const last = grid.weeks[grid.weeks.length - 1].days.filter((d) => d)
    expect(last[last.length - 1]?.key).toBe('2026-08-13')
  })

  it('今天之后的格子留空，不能画出还没到的日子', () => {
    const grid = buildHeatmap({}, { weeks: 2, today: TODAY })
    const lastWeek = grid.weeks[grid.weeks.length - 1]
    // 周四之后还有周五、周六两格
    expect(lastWeek.days.slice(5).every((d) => d === null)).toBe(true)
  })

  it('把每天的分钟数放进对应格子', () => {
    const grid = buildHeatmap(
      { '2026-08-13': { pomodoros: 2, focusMinutes: 75 }, '2026-08-10': { pomodoros: 1, focusMinutes: 25 } },
      { weeks: 3, today: TODAY }
    )
    const all = grid.weeks.flatMap((w) => w.days).filter((d) => d !== null)
    expect(all.find((d) => d!.key === '2026-08-13')!.minutes).toBe(75)
    expect(all.find((d) => d!.key === '2026-08-10')!.minutes).toBe(25)
    expect(all.find((d) => d!.key === '2026-08-11')!.minutes).toBe(0)
  })

  it('区间外的历史数据不参与，也不会报错', () => {
    const grid = buildHeatmap(
      { '2020-01-01': { pomodoros: 9, focusMinutes: 900 } },
      { weeks: 2, today: TODAY }
    )
    const all = grid.weeks.flatMap((w) => w.days).filter((d) => d !== null)
    expect(all.every((d) => d!.minutes === 0)).toBe(true)
  })

  it('月份标签只在该月第一次出现的那一列打', () => {
    const grid = buildHeatmap({}, { weeks: 8, today: TODAY })
    const labels = grid.weeks.map((w) => w.month).filter(Boolean)
    expect(labels.length).toBeGreaterThan(0)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('统计区间内的总天数与总时长，用于图注', () => {
    const grid = buildHeatmap(
      {
        '2026-08-13': { pomodoros: 2, focusMinutes: 75 },
        '2026-08-12': { pomodoros: 1, focusMinutes: 30 }
      },
      { weeks: 4, today: TODAY }
    )
    expect(grid.activeDays).toBe(2)
    expect(grid.totalMinutes).toBe(105)
  })
})
