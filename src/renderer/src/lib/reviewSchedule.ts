import { uid, type ReviewItem, type ReviewLogEntry } from '../types'

/**
 * 艾宾浩斯遗忘曲线常用的日级复习间隔。
 * 初始学习视为第 0 天，之后最多安排 6 轮，完成最后一轮即归档。
 */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30] as const
export const REVIEW_TOTAL_ROUNDS = REVIEW_INTERVALS.length

export function padNumber(value: number): string {
  return String(value).padStart(2, '0')
}

export function dateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function addDays(value: string, days: number): string {
  const date = parseDateKey(value)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/** 用本地日期比较，避免把 YYYY-MM-DD 解析成 UTC 后跨时区偏一天。 */
export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b)
}

export function scheduledReviewDates(learnedOn: string): string[] {
  if (!parseDateKey(learnedOn)) return []
  return REVIEW_INTERVALS.map((days) => addDays(learnedOn, days))
}

export interface NewReviewInput {
  title: string
  subject?: string
  note?: string
  learnedOn: string
}

export function createReviewItem(
  input: NewReviewInput,
  now: Date = new Date()
): ReviewItem {
  const timestamp = now.getTime()
  return {
    id: uid(),
    title: input.title.trim(),
    subject: (input.subject ?? '').trim(),
    note: (input.note ?? '').trim(),
    learnedOn: input.learnedOn,
    createdAt: timestamp,
    updatedAt: timestamp,
    round: 0,
    totalRounds: REVIEW_TOTAL_ROUNDS,
    nextReviewDate: addDays(input.learnedOn, REVIEW_INTERVALS[0]),
    lastReviewedOn: '',
    reviewLog: [],
    archived: false
  }
}

/**
 * 完成一轮后，下一轮从实际完成日重新起算。
 * 这样迟到复习不会把下一次也继续挤在过去，但总轮次仍严格封顶。
 */
export function completeReview(
  item: ReviewItem,
  completedOn: string,
  now: Date = new Date()
): ReviewItem {
  if (item.archived || !parseDateKey(completedOn)) return item
  const currentRound = Math.min(Math.max(0, Math.floor(item.round)), REVIEW_TOTAL_ROUNDS)
  if (currentRound >= REVIEW_TOTAL_ROUNDS) {
    return { ...item, archived: true, nextReviewDate: '', updatedAt: now.getTime() }
  }

  const completedRound = currentRound + 1
  const entry: ReviewLogEntry = {
    round: completedRound,
    dueDate: item.nextReviewDate,
    completedOn
  }
  const nextReviewDate =
    completedRound >= REVIEW_TOTAL_ROUNDS
      ? ''
      : addDays(completedOn, REVIEW_INTERVALS[completedRound])

  return {
    ...item,
    round: completedRound,
    nextReviewDate,
    lastReviewedOn: completedOn,
    reviewLog: [...item.reviewLog, entry],
    archived: completedRound >= REVIEW_TOTAL_ROUNDS,
    updatedAt: now.getTime()
  }
}

export function isReviewDue(item: ReviewItem, today: string): boolean {
  return (
    !item.archived &&
    Boolean(item.nextReviewDate) &&
    compareDateKeys(item.nextReviewDate, today) <= 0
  )
}

/** 某天是否有复习到期（含逾期） */
export function isReviewOverdue(item: ReviewItem, today: string): boolean {
  return (
    !item.archived &&
    Boolean(item.nextReviewDate) &&
    compareDateKeys(item.nextReviewDate, today) < 0
  )
}

export function daysOverdue(item: ReviewItem, today: string): number {
  if (!isReviewDue(item, today)) return 0
  const due = parseDateKey(item.nextReviewDate)
  const current = parseDateKey(today)
  if (!due || !current) return 0
  return Math.max(0, Math.round((current.getTime() - due.getTime()) / 86_400_000))
}

/**
 * 日历按原计划日期归档。逾期任务仍留在到期日，点击旧日期就能重新找回。
 * 选中今天时则汇入所有逾期项，方便一次清理。
 */
export function reviewsForDate(
  items: ReviewItem[],
  selectedDate: string,
  today: string
): ReviewItem[] {
  const active = items.filter((item) => !item.archived && item.nextReviewDate)
  if (selectedDate === today) {
    return active
      .filter((item) => isReviewDue(item, today))
      .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
  }
  return active
    .filter((item) => item.nextReviewDate === selectedDate)
    .sort((a, b) => a.round - b.round)
}

export function reviewCountsByDate(items: ReviewItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    if (item.archived || !item.nextReviewDate) return counts
    counts[item.nextReviewDate] = (counts[item.nextReviewDate] ?? 0) + 1
    return counts
  }, {})
}
