import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { clone, loadStore, saveStore } from '@/lib/persist'
import {
  REVIEW_INTERVALS,
  REVIEW_TOTAL_ROUNDS,
  addDays,
  completeReview,
  createReviewItem,
  dateKey,
  isReviewDue,
  parseDateKey
} from '@/lib/reviewSchedule'
import {
  uid,
  type ReviewItem,
  type ReviewLogEntry,
  type ReviewReminderConfig,
  type ReviewsData
} from '@/types'

const DEFAULT_REMINDER: ReviewReminderConfig = { enabled: true, time: '09:00' }

function normalizeLogs(raw: unknown): ReviewLogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const value = entry as Partial<ReviewLogEntry>
      const round = Number(value.round)
      if (!Number.isFinite(round) || !parseDateKey(String(value.completedOn ?? ''))) return null
      return {
        round: Math.min(REVIEW_TOTAL_ROUNDS, Math.max(1, Math.floor(round))),
        dueDate: String(value.dueDate ?? ''),
        completedOn: String(value.completedOn)
      }
    })
    .filter((entry): entry is ReviewLogEntry => Boolean(entry))
}

function normalizeItem(raw: Partial<ReviewItem>, index: number): ReviewItem {
  const now = Date.now()
  const learnedOn = parseDateKey(String(raw.learnedOn ?? ''))
    ? String(raw.learnedOn)
    : dateKey()
  const totalRounds = Math.min(
    REVIEW_TOTAL_ROUNDS,
    Math.max(1, Math.floor(Number(raw.totalRounds) || REVIEW_TOTAL_ROUNDS))
  )
  const reviewLog = normalizeLogs(raw.reviewLog)
  const round = Math.min(
    totalRounds,
    Math.max(reviewLog.length, Math.floor(Number(raw.round) || 0))
  )
  const archived = Boolean(raw.archived) || round >= totalRounds
  const fallbackNext = archived
    ? ''
    : addDays(learnedOn, REVIEW_INTERVALS[Math.min(round, totalRounds - 1)])
  const nextReviewDate =
    archived || !parseDateKey(String(raw.nextReviewDate ?? ''))
      ? fallbackNext
      : String(raw.nextReviewDate)

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${uid()}-${index}`,
    title: String(raw.title ?? '').trim(),
    subject: String(raw.subject ?? '').trim(),
    note: String(raw.note ?? '').trim(),
    learnedOn,
    createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : now,
    round,
    totalRounds,
    nextReviewDate,
    lastReviewedOn: parseDateKey(String(raw.lastReviewedOn ?? ''))
      ? String(raw.lastReviewedOn)
      : '',
    reviewLog,
    archived
  }
}

function normalizeReminder(raw: Partial<ReviewReminderConfig> | undefined): ReviewReminderConfig {
  const time = String(raw?.time ?? '')
  return {
    enabled: raw?.enabled !== false,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_REMINDER.time
  }
}

export const useReviewsStore = defineStore('reviews', () => {
  const items = ref<ReviewItem[]>([])
  const reminder = ref<ReviewReminderConfig>({ ...DEFAULT_REMINDER })
  const loaded = ref(false)

  const active = computed(() =>
    items.value
      .filter((item) => !item.archived)
      .slice()
      .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
  )
  const archived = computed(() =>
    items.value
      .filter((item) => item.archived)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
  )
  const due = computed(() => {
    const today = dateKey()
    return active.value.filter((item) => isReviewDue(item, today))
  })

  async function load(): Promise<void> {
    const data = await loadStore<Partial<ReviewsData>>('reviews')
    items.value = Array.isArray(data.items)
      ? data.items.map((item, index) => normalizeItem(item, index))
      : []
    reminder.value = normalizeReminder(data.reminder)
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('reviews', {
      items: clone(items.value),
      reminder: clone(reminder.value)
    } satisfies ReviewsData)
  }

  function add(input: {
    title: string
    subject: string
    note: string
    learnedOn: string
  }): ReviewItem {
    const item = createReviewItem(input)
    items.value.push(item)
    void save()
    return item
  }

  function addMany(titles: string[], learnedOn: string = dateKey()): ReviewItem[] {
    const cleanTitles = titles.map((title) => title.trim()).filter(Boolean)
    if (!cleanTitles.length) return []
    const now = new Date()
    const additions = cleanTitles.map((title) =>
      createReviewItem({ title, learnedOn }, now)
    )
    items.value.push(...additions)
    void save()
    return additions
  }

  function update(
    id: string,
    input: { title: string; subject: string; note: string; learnedOn: string }
  ): ReviewItem | null {
    const index = items.value.findIndex((item) => item.id === id)
    if (index < 0) return null
    const current = items.value[index]
    const learnedOnChanged = current.learnedOn !== input.learnedOn
    const canReschedule = current.round === 0 && !current.lastReviewedOn && !current.archived
    items.value[index] = {
      ...current,
      title: input.title.trim(),
      subject: input.subject.trim(),
      note: input.note.trim(),
      learnedOn: input.learnedOn,
      nextReviewDate:
        learnedOnChanged && canReschedule
          ? addDays(input.learnedOn, REVIEW_INTERVALS[0])
          : current.nextReviewDate,
      updatedAt: Date.now()
    }
    void save()
    return items.value[index]
  }

  function complete(id: string, completedOn: string = dateKey()): ReviewItem | null {
    const index = items.value.findIndex((item) => item.id === id)
    if (index < 0) return null
    items.value[index] = completeReview(items.value[index], completedOn)
    void save()
    return items.value[index]
  }

  function remove(id: string): void {
    items.value = items.value.filter((item) => item.id !== id)
    void save()
  }

  function updateReminder(patch: Partial<ReviewReminderConfig>): void {
    reminder.value = normalizeReminder({ ...reminder.value, ...patch })
    void save()
  }

  return {
    items,
    reminder,
    loaded,
    active,
    archived,
    due,
    load,
    save,
    add,
    addMany,
    update,
    complete,
    remove,
    updateReminder
  }
})
