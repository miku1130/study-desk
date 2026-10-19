import { describe, expect, it, vi } from 'vitest'
import { ReviewReminder } from '../src/main/reviewReminder'

function makeStore(data: Record<string, unknown>) {
  const values = { ...data }
  return {
    get: (key: string) => values[key],
    set: (key: string, value: unknown) => {
      values[key] = value
    }
  }
}

function dueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    title: '高等数学 · 导数',
    round: 0,
    totalRounds: 6,
    nextReviewDate: '2026-03-02',
    archived: false,
    ...overrides
  }
}

function makeReminder(items: unknown[], enabled = true, time = '09:00') {
  const reviews = makeStore({ items, reminder: { enabled, time } })
  const state = makeStore({ notified: [] })
  const notify = vi.fn()
  const send = vi.fn()
  return {
    reminder: new ReviewReminder(reviews as never, state as never, notify, send),
    state,
    notify,
    send
  }
}

describe('ReviewReminder', () => {
  it('notifies once after the configured reminder time', () => {
    const { reminder, notify, send } = makeReminder([dueItem()])
    reminder.check(new Date(2026, 2, 2, 8, 59))
    expect(notify).not.toHaveBeenCalled()

    reminder.check(new Date(2026, 2, 2, 9, 0))
    reminder.check(new Date(2026, 2, 2, 9, 30))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('记忆曲线 · 该复习了', '高等数学 · 导数 · 第 1/6 轮')
    expect(send).toHaveBeenCalledWith('reviews:due', 1)
  })

  it('keeps overdue items eligible while skipping archived or future items', () => {
    const { reminder, notify } = makeReminder([
      dueItem({ id: 'old', nextReviewDate: '2026-02-27' }),
      dueItem({ id: 'future', nextReviewDate: '2026-03-05' }),
      dueItem({ id: 'done', archived: true })
    ])
    reminder.check(new Date(2026, 2, 2, 10))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('记忆曲线 · 该复习了', '高等数学 · 导数 · 第 1/6 轮')
  })

  it('uses one summary notification for several due knowledge items', () => {
    const { reminder, notify } = makeReminder([
      dueItem(),
      dueItem({ id: 'r2', title: '英语 · 虚拟语气' })
    ])
    reminder.check(new Date(2026, 2, 2, 10))
    expect(notify).toHaveBeenCalledWith(
      '记忆曲线 · 2 条知识待复习',
      '高等数学 · 导数 等 2 条知识今天到期'
    )
  })

  it('does nothing when reminders are disabled', () => {
    const { reminder, notify } = makeReminder([dueItem()], false)
    reminder.check(new Date(2026, 2, 2, 10))
    expect(notify).not.toHaveBeenCalled()
  })
})
