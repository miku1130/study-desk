<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import ReviewCalendar from '@/components/reviews/ReviewCalendar.vue'
import ReviewMemoList from '@/components/reviews/ReviewMemoList.vue'
import ReviewRecordSheet from '@/components/reviews/ReviewRecordSheet.vue'
import { useClock } from '@/composables/useClock'
import {
  addDays,
  compareDateKeys,
  dateKey,
  daysOverdue,
  isReviewDue,
  isReviewOverdue,
  parseDateKey,
  reviewsForDate
} from '@/lib/reviewSchedule'
import { useReviewsStore } from '@/stores/reviews'
import { useUiStore } from '@/stores/ui'
import type { ReviewItem } from '@/types'

type LibraryFilter = 'active' | 'archived'

const reviews = useReviewsStore()
const ui = useUiStore()
const { now } = useClock()
const today = computed(() => dateKey(now.value))
const selectedDate = shallowRef(today.value)
const showRecord = shallowRef(false)
const recordRows = shallowRef<string[]>(createBlankRows())
const libraryFilter = shallowRef<LibraryFilter>('active')
const libraryQuery = shallowRef('')
const libraryLimit = shallowRef(8)

watch(today, (next, previous) => {
  if (selectedDate.value === previous) selectedDate.value = next
})

watch([libraryFilter, libraryQuery], () => {
  libraryLimit.value = 8
})

const selectedDue = computed(() =>
  reviewsForDate(reviews.items, selectedDate.value, today.value)
)
const todayDue = computed(() => reviewsForDate(reviews.items, today.value, today.value))
const overdueCount = computed(
  () => reviews.active.filter((item) => isReviewOverdue(item, today.value)).length
)
const weekDue = computed(() => {
  const end = addDays(today.value, 6)
  return reviews.active.filter(
    (item) =>
      item.nextReviewDate &&
      compareDateKeys(item.nextReviewDate, today.value) >= 0 &&
      compareDateKeys(item.nextReviewDate, end) <= 0
  ).length
})
const reviewedRounds = computed(() =>
  reviews.items.reduce((count, item) => count + item.reviewLog.length, 0)
)
const selectedLearned = computed(() =>
  reviews.items
    .filter((item) => item.learnedOn === selectedDate.value)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
)
const todayLearnedCount = computed(
  () => reviews.items.filter((item) => item.learnedOn === today.value).length
)
const selectedCompleted = computed(() =>
  reviews.items
    .flatMap((item) =>
      item.reviewLog
        .filter((entry) => entry.completedOn === selectedDate.value)
        .map((entry) => ({ item, entry }))
    )
    .sort((a, b) => a.entry.round - b.entry.round || a.item.createdAt - b.item.createdAt)
)
const selectedLabel = computed(() => {
  const date = parseDateKey(selectedDate.value)
  return date
    ? date.toLocaleDateString('zh-CN', {
        year: date.getFullYear() === now.value.getFullYear() ? undefined : 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    : selectedDate.value
})
const todayLabel = computed(() =>
  now.value.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
)
const selectedMode = computed(() => {
  if (selectedDate.value === today.value) return '今日复习'
  return selectedDate.value < today.value ? '补复习' : '排期预览'
})
const recordDateLabel = computed(() =>
  now.value.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
)
const recordCount = computed(() => recordRows.value.filter((row) => row.trim()).length)
const selectedLearnedLabel = computed(() => {
  if (!selectedLearned.value.length) return ''
  const titles = selectedLearned.value.slice(0, 3).map((item) => item.title)
  const rest = selectedLearned.value.length - titles.length
  return rest > 0 ? `${titles.join('、')} 等 ${selectedLearned.value.length} 条` : titles.join('、')
})
const filteredLibrary = computed(() => {
  const source = libraryFilter.value === 'active' ? reviews.active : reviews.archived
  const query = libraryQuery.value.trim().toLowerCase()
  const filtered = query
    ? source.filter((item) =>
        `${item.title} ${item.note} ${item.subject}`.toLowerCase().includes(query)
      )
    : source
  return filtered
    .slice()
    .sort((a, b) => {
      if (libraryFilter.value === 'archived') return b.updatedAt - a.updatedAt
      return b.learnedOn.localeCompare(a.learnedOn) || b.updatedAt - a.updatedAt
    })
})
const libraryItems = computed(() => filteredLibrary.value.slice(0, libraryLimit.value))
const emptyAgendaText = computed(() => {
  if (selectedDate.value < today.value) return '这一天没有未复习内容'
  if (selectedDate.value > today.value) return '这一天还没有复习安排'
  return '今天的复习已经清空'
})

function createBlankRows(): string[] {
  return Array.from({ length: 5 }, () => '')
}

function formatMonthDay(value: string): string {
  const date = parseDateKey(value)
  return date
    ? date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : value
}

function openRecord(): void {
  recordRows.value = createBlankRows()
  showRecord.value = true
}

function closeRecord(): void {
  showRecord.value = false
}

function saveRecord(): void {
  const titles = recordRows.value.map((row) => row.trim()).filter(Boolean)
  if (!titles.length) {
    ui.error('先写下一行内容')
    return
  }
  const added = reviews.addMany(titles, today.value)
  selectedDate.value = today.value
  showRecord.value = false
  ui.success(`已记下 ${added.length} 条，明天开始复习`)
}

function completeItem(item: ReviewItem): void {
  if (!isReviewDue(item, today.value)) {
    ui.info('这一条还没有到复习日期')
    return
  }
  const overdueDays = daysOverdue(item, today.value)
  const wasLastRound = item.round + 1 >= item.totalRounds
  const updated = reviews.complete(item.id, today.value)
  if (!updated) return
  if (wasLastRound || updated.archived) {
    ui.success('六轮复习已完成，这条记录已归档')
    return
  }
  ui.success(
    overdueDays
      ? `已补上 ${overdueDays} 天前的复习，下次 ${formatMonthDay(updated.nextReviewDate)}`
      : `已完成本轮，下次 ${formatMonthDay(updated.nextReviewDate)}`
  )
}

async function removeItem(item: ReviewItem): Promise<void> {
  const confirmed = await ui.confirm({
    title: '删除这条记录？',
    message: '删除后，对应的复习排期和完成记录会一起移除。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  reviews.remove(item.id)
  ui.success('记录已删除')
}

function saveReminder(): void {
  reviews.updateReminder({ ...reviews.reminder })
}

function itemStatus(item: ReviewItem): { text: string; tone: 'overdue' | 'today' | 'future' | 'done' } {
  if (item.archived) return { text: '已完成', tone: 'done' }
  if (isReviewOverdue(item, today.value)) return { text: '待补', tone: 'overdue' }
  if (item.nextReviewDate === today.value) return { text: '今天', tone: 'today' }
  return { text: formatMonthDay(item.nextReviewDate), tone: 'future' }
}
</script>

<template>
  <div class="page reviews-page">
    <header class="reviews-head">
      <div class="reviews-heading">
        <p class="eyebrow">记忆曲线</p>
        <h2>今天记住的，按时再见一次</h2>
        <p class="today-line">
          <AppIcon name="calendar" :size="14" />
          {{ todayLabel }}
          <span v-if="todayLearnedCount">已记录 {{ todayLearnedCount }} 条</span>
        </p>
      </div>
      <button class="btn record-button" type="button" @click="openRecord">
        <AppIcon name="note" :size="14" />
        记下今天
      </button>
    </header>

    <section class="review-summary" aria-label="复习概览">
      <div>
        <span>待复习</span>
        <strong>{{ todayDue.length }}</strong>
      </div>
      <div :class="{ attention: overdueCount > 0 }">
        <span>逾期未复习</span>
        <strong>{{ overdueCount }}</strong>
      </div>
      <div>
        <span>未来 7 天</span>
        <strong>{{ weekDue }}</strong>
      </div>
      <div>
        <span>累计复习</span>
        <strong>{{ reviewedRounds }}</strong>
      </div>
      <div>
        <span>已完成</span>
        <strong>{{ reviews.archived.length }}</strong>
      </div>
    </section>

    <div class="review-workspace">
      <section class="agenda-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">{{ selectedMode }}</p>
            <h3>{{ selectedLabel }}</h3>
          </div>
          <div class="agenda-total">
            <strong>{{ selectedDue.length }}</strong>
            <span>项</span>
          </div>
        </header>

        <div v-if="selectedDue.length" class="memo-sheet">
          <ReviewMemoList
            :items="selectedDue"
            :today="today"
            @complete="completeItem"
            @remove="removeItem"
          />
        </div>
        <div v-else class="agenda-empty">
          <span class="empty-icon">
            <AppIcon name="check" :size="20" :stroke-width="1.8" />
          </span>
          <p>{{ emptyAgendaText }}</p>
        </div>

        <div v-if="selectedLearned.length" class="day-learning">
          <span class="day-learning-label">当天记下</span>
          <p>{{ selectedLearnedLabel }}</p>
        </div>

        <div v-if="selectedCompleted.length" class="completed-block">
          <p class="completed-title">已完成 {{ selectedCompleted.length }} 项</p>
          <div
            v-for="entry in selectedCompleted"
            :key="`${entry.item.id}-${entry.entry.round}`"
            class="completed-row"
          >
            <span class="completed-check">
              <AppIcon name="check" :size="11" :stroke-width="2.4" />
            </span>
            <span>{{ entry.item.title }}</span>
            <small>第 {{ entry.entry.round }} 轮</small>
          </div>
        </div>
      </section>

      <aside class="review-side">
        <ReviewCalendar
          :items="reviews.items"
          :today="today"
          :selected-date="selectedDate"
          @select="selectedDate = $event"
        />

        <section class="reminder-bar">
          <div class="reminder-copy">
            <AppIcon name="bell" :size="14" />
            <span>复习提醒</span>
          </div>
          <input
            v-model="reviews.reminder.time"
            class="input input-sm reminder-time"
            type="time"
            :disabled="!reviews.reminder.enabled"
            aria-label="每日提醒时间"
            @change="saveReminder"
          />
          <label class="switch">
            <input
              v-model="reviews.reminder.enabled"
              type="checkbox"
              aria-label="开启复习提醒"
              @change="saveReminder"
            />
            <span class="slider" />
          </label>
        </section>
      </aside>
    </div>

    <section class="library-panel">
      <header class="library-head">
        <div>
          <p class="eyebrow">全部记录</p>
          <h3>学习过的东西都在这里</h3>
        </div>
        <div class="seg library-seg">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: libraryFilter === 'active' }"
            @click="libraryFilter = 'active'"
          >
            复习中 {{ reviews.active.length }}
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: libraryFilter === 'archived' }"
            @click="libraryFilter = 'archived'"
          >
            已完成 {{ reviews.archived.length }}
          </button>
        </div>
      </header>

      <div class="library-tools">
        <AppIcon name="book" :size="14" />
        <input
          v-model="libraryQuery"
          class="library-search"
          type="search"
          placeholder="搜索记录"
          aria-label="搜索记录"
        />
      </div>

      <div v-if="libraryItems.length" class="library-list">
        <article v-for="item in libraryItems" :key="item.id" class="library-row">
          <span class="library-dot" :class="itemStatus(item).tone" />
          <div class="library-main">
            <p>{{ item.title }}</p>
            <span>
              {{ formatMonthDay(item.learnedOn) }} 记下
              <template v-if="!item.archived">
                · 下次 {{ formatMonthDay(item.nextReviewDate) }}
              </template>
              <template v-else>· 六轮已完成</template>
            </span>
          </div>
          <span class="library-rounds">{{ item.round }} / {{ item.totalRounds }}</span>
          <span class="library-state" :class="itemStatus(item).tone">
            {{ itemStatus(item).text }}
          </span>
          <button
            type="button"
            class="library-delete"
            title="删除记录"
            @click="removeItem(item)"
          >
            <AppIcon name="trash" :size="13" />
          </button>
        </article>
        <button
          v-if="filteredLibrary.length > libraryItems.length"
          type="button"
          class="library-more"
          @click="libraryLimit = 9999"
        >
          显示全部 {{ filteredLibrary.length }} 条
        </button>
      </div>
      <div v-else class="library-empty">
        <AppIcon name="inbox" :size="22" :stroke-width="1.5" />
        <p>{{ libraryQuery ? '没有找到对应记录' : '还没有记录' }}</p>
      </div>
    </section>

    <AppModal v-if="showRecord" title="记下今天" wide @close="closeRecord">
      <ReviewRecordSheet
        v-model="recordRows"
        :date-label="recordDateLabel"
        @submit="saveRecord"
      />
      <template #footer>
        <span class="record-foot-note">{{ recordCount }} 条新记录</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="closeRecord">
          取消
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :disabled="recordCount === 0"
          @click="saveRecord"
        >
          保存
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.reviews-page {
  max-width: 1160px;
}

.reviews-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 4px 18px;
  border-bottom: 1px solid var(--border-subtle);
}

.reviews-heading {
  min-width: 0;
}

.eyebrow {
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 780;
}

.reviews-heading h2 {
  margin-top: 5px;
  color: var(--text-primary);
  font-size: 27px;
  line-height: 1.2;
}

.today-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.today-line span {
  color: var(--text-tertiary);
}

.today-line span::before {
  margin-right: 7px;
  content: '·';
}

.record-button {
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 14px;
  font-size: 12.5px;
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0 4px 18px;
  border-bottom: 1px solid var(--border-subtle);
}

.review-summary > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 13px 13px 12px;
  border-right: 1px solid var(--border-subtle);
}

.review-summary > div:first-child {
  padding-left: 2px;
}

.review-summary > div:last-child {
  border-right: 0;
}

.review-summary span {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 10.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-summary strong {
  color: var(--text-primary);
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.review-summary > div.attention strong {
  color: var(--status-danger);
}

.review-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  align-items: start;
  gap: 20px;
}

.agenda-panel {
  min-width: 0;
  min-height: 420px;
  padding: 17px 18px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-head h3 {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 17px;
  line-height: 1.3;
}

.agenda-total {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--text-tertiary);
}

.agenda-total strong {
  color: var(--text-primary);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}

.agenda-total span {
  font-size: 10px;
}

.memo-sheet {
  padding-top: 2px;
}

.agenda-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 268px;
  color: var(--text-tertiary);
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-subtle));
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}

.agenda-empty p {
  font-size: 12px;
}

.day-learning {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--border-subtle);
}

.day-learning-label {
  flex-shrink: 0;
  color: var(--brand-sky);
  font-size: 9.5px;
  font-weight: 760;
}

.day-learning p {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-block {
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--border-subtle);
}

.completed-title {
  margin-bottom: 6px;
  color: var(--status-success);
  font-size: 9.5px;
  font-weight: 760;
}

.completed-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  color: var(--text-secondary);
  font-size: 10.5px;
}

.completed-row > span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-row small {
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.completed-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--status-success) 12%, transparent);
  color: var(--status-success);
}

.review-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.reminder-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-card);
}

.reminder-copy {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 680;
}

.reminder-time {
  width: 102px;
  min-height: 28px;
  padding: 0 7px;
  font-size: 11px;
}

.library-panel {
  margin-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

.library-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 4px 12px;
}

.library-head h3 {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 16px;
}

.library-seg {
  flex-shrink: 0;
}

.library-seg .seg-btn {
  padding: 5px 10px;
  font-size: 11.5px;
}

.library-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 11px;
  border: 1px solid var(--border-subtle);
  border-bottom: 0;
  border-radius: 9px 9px 0 0;
  background: var(--surface-card);
  color: var(--text-tertiary);
}

.library-search {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
}

.library-search::placeholder {
  color: var(--text-tertiary);
}

.library-list {
  border: 1px solid var(--border-subtle);
  border-radius: 0 0 9px 9px;
  background: var(--surface-card);
}

.library-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 48px 54px 26px;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.library-row:last-child {
  border-bottom: 0;
}

.library-row:hover {
  background: color-mix(in srgb, var(--accent) 3%, transparent);
}

.library-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.library-dot.today {
  background: var(--status-warning);
}

.library-dot.overdue {
  background: var(--status-danger);
}

.library-dot.future {
  background: var(--accent);
}

.library-dot.done {
  background: var(--status-success);
}

.library-main {
  min-width: 0;
}

.library-main p {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-main span {
  display: block;
  overflow: hidden;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-rounds {
  color: var(--text-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.library-state {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 720;
  text-align: right;
  white-space: nowrap;
}

.library-state.today {
  color: var(--status-warning);
}

.library-state.overdue {
  color: var(--status-danger);
}

.library-state.future {
  color: var(--accent-strong);
}

.library-state.done {
  color: var(--status-success);
}

.library-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  opacity: 0;
}

.library-row:hover .library-delete {
  opacity: 1;
}

.library-delete:focus-visible {
  opacity: 1;
}

.library-delete:hover {
  background: color-mix(in srgb, var(--status-danger) 10%, transparent);
  color: var(--status-danger);
}

.library-more {
  width: 100%;
  height: 36px;
  border: 0;
  border-top: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
}

.library-more:hover {
  color: var(--accent-strong);
}

.library-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 105px;
  border: 1px solid var(--border-subtle);
  border-radius: 0 0 9px 9px;
  background: var(--surface-card);
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.record-foot-note {
  margin-right: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}

@media (max-width: 1120px) {
  .review-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 230px;
    align-items: start;
  }
}

@media (max-width: 760px) {
  .reviews-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .reviews-heading h2 {
    font-size: 23px;
  }

  .review-summary {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .review-summary > div {
    grid-column: span 2;
    border-bottom: 1px solid var(--border-subtle);
  }

  .review-summary > div:nth-child(3),
  .review-summary > div:nth-child(5) {
    border-right: 0;
  }

  .review-summary > div:nth-child(n + 4) {
    grid-column: span 3;
    border-bottom: 0;
  }

  .review-side {
    display: flex;
  }

  .library-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .library-row {
    grid-template-columns: 8px minmax(0, 1fr) 50px 24px;
  }

  .library-rounds {
    display: none;
  }

  .library-delete {
    opacity: 1;
  }
}
</style>
