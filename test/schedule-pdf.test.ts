import { describe, expect, it } from 'vitest'
import {
  buildSchedulePdfHtml,
  getDaySchedules,
  isValidDateKey,
  scheduleDurationMinutes,
  totalScheduleDuration
} from '../src/main/schedulePdf'

describe('schedule PDF data and layout', () => {
  it('accepts only real calendar dates', () => {
    expect(isValidDateKey('2026-09-01')).toBe(true)
    expect(isValidDateKey('2026-02-29')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
  })

  it('filters by date and places all-day items before timed items', () => {
    const items = getDaySchedules([
      { date: '2026-09-01', start: '14:00', end: '15:30', title: '下午复盘', allDay: false },
      { date: '2026-09-02', start: '08:00', end: '09:00', title: '其他日期', allDay: false },
      { date: '2026-09-01', start: '', end: '', title: '提交作业', allDay: true },
      { date: '2026-09-01', start: '09:00', end: '10:30', title: '晨间学习', allDay: false }
    ], '2026-09-01')

    expect(items.map((item) => item.title)).toEqual(['提交作业', '晨间学习', '下午复盘'])
    expect(totalScheduleDuration(items)).toBe(180)
    expect(scheduleDurationMinutes(items[0])).toBe(0)
  })

  it('escapes user text and includes summary sections in the printable HTML', () => {
    const html = buildSchedulePdfHtml('2026-09-01', getDaySchedules([
      { date: '2026-09-01', start: '09:00', end: '10:30', title: '<晨间>', location: 'A&B', note: '准备 > 资料', color: '#4f8fd8' }
    ], '2026-09-01'))

    expect(html).toContain('今日计划')
    expect(html).toContain('时间安排')
    expect(html).toContain('&lt;晨间&gt;')
    expect(html).toContain('A&amp;B')
    expect(html).not.toContain('<晨间>')
  })
})
