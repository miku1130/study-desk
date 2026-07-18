import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatHour,
  getPeriodPosition,
  getTimelineBounds,
  TIMETABLE_HOUR_HEIGHT
} from '../src/renderer/src/lib/timetableLayout'
import type { Period } from '../src/renderer/src/types'

const period = (start: string, end: string): Period => ({
  id: `${start}-${end}`,
  name: '测试节次',
  start,
  end
})

describe('timetable timeline layout', () => {
  it('uses one fixed-height row for each full hour', () => {
    const timeline = getTimelineBounds([period('08:00', '10:45')])

    expect(timeline.hours.map(formatHour)).toEqual(['08:00', '09:00', '10:00'])
    expect(timeline.hours.length * TIMETABLE_HOUR_HEIGHT).toBe(216)
  })

  it('sizes a 45-minute lesson to 75% of a one-hour cell', () => {
    const lessonPeriod = period('08:00', '08:45')
    const timeline = getTimelineBounds([lessonPeriod])

    expect(getPeriodPosition(lessonPeriod, timeline)).toMatchObject({
      top: '0%',
      height: '75%',
      durationMinutes: 45
    })
  })

  it('keeps minute offsets and gaps proportional to the hourly grid', () => {
    const first = period('08:00', '08:45')
    const second = period('08:55', '09:40')
    const timeline = getTimelineBounds([first, second])
    const position = getPeriodPosition(second, timeline)

    expect(Number.parseFloat(position.top)).toBeCloseTo((55 / 120) * 100)
    expect(Number.parseFloat(position.height)).toBeCloseTo((45 / 120) * 100)
  })

  it('formats the course duration for the card metadata', () => {
    expect(formatDuration(45)).toBe('45 分钟')
    expect(formatDuration(90)).toBe('90 分钟')
  })
})
