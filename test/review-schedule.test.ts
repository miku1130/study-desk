import { describe, expect, it } from 'vitest'
import {
  REVIEW_TOTAL_ROUNDS,
  addDays,
  completeReview,
  createReviewItem,
  daysOverdue,
  scheduledReviewDates
} from '../src/renderer/src/lib/reviewSchedule'

describe('review schedule', () => {
  it('schedules six bounded rounds from the learning date', () => {
    expect(scheduledReviewDates('2026-01-01')).toEqual([
      '2026-01-02',
      '2026-01-03',
      '2026-01-05',
      '2026-01-08',
      '2026-01-16',
      '2026-01-31'
    ])
  })

  it('crosses month and leap-year boundaries with local dates', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('starts a new item on the first review day', () => {
    const item = createReviewItem(
      { title: '导数', learnedOn: '2026-03-01' },
      new Date(2026, 2, 1, 10)
    )
    expect(item.round).toBe(0)
    expect(item.totalRounds).toBe(REVIEW_TOTAL_ROUNDS)
    expect(item.nextReviewDate).toBe('2026-03-02')
    expect(item.archived).toBe(false)
  })

  it('bases the next round on the actual review date', () => {
    const item = createReviewItem({ title: '极限', learnedOn: '2026-03-01' })
    const first = completeReview(item, '2026-03-03')
    expect(first.round).toBe(1)
    expect(first.nextReviewDate).toBe('2026-03-05')
    expect(first.reviewLog[0]).toEqual({
      round: 1,
      dueDate: '2026-03-02',
      completedOn: '2026-03-03'
    })
  })

  it('stops permanently after the sixth completed round', () => {
    let item = createReviewItem({ title: '矩阵', learnedOn: '2026-01-01' })
    const dates = ['2026-01-02', '2026-01-04', '2026-01-08', '2026-01-15', '2026-01-30', '2026-02-28']
    for (const date of dates) item = completeReview(item, date)

    expect(item.round).toBe(REVIEW_TOTAL_ROUNDS)
    expect(item.archived).toBe(true)
    expect(item.nextReviewDate).toBe('')
    expect(completeReview(item, '2026-03-30')).toEqual(item)
  })

  it('reports overdue days without timezone drift', () => {
    const item = {
      ...createReviewItem({ title: '公式', learnedOn: '2026-03-01' }),
      nextReviewDate: '2026-03-02'
    }
    expect(daysOverdue(item, '2026-03-05')).toBe(3)
  })
})
