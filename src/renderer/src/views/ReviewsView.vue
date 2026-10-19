<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import { useClock } from '@/composables/useClock'
import {
  REVIEW_INTERVALS,
  REVIEW_TOTAL_ROUNDS,
  addDays,
  compareDateKeys,
  dateKey,
  daysOverdue,
  isReviewDue,
  parseDateKey,
  scheduledReviewDates
} from '@/lib/reviewSchedule'
import { useReviewsStore } from '@/stores/reviews'
import { useUiStore } from '@/stores/ui'
import type { ReviewItem } from '@/types'

interface ReviewDraft {
  title: string
  subject: string
  note: string
  learnedOn: string
}

interface MonthCell {
  key: string
  day: number
  outside: boolean
  due: ReviewItem[]
  learnedCount: number
  completedCount: number
}

const reviews = useReviewsStore()
const ui = useUiStore()
const { now } = useClock()
const today = computed(() => dateKey(now.value))
const cursor = shallowRef(new Date(now.value.getFullYear(), now.value.getMonth(), 1))
const selectedDate = shallowRef(today.value)
const showEditor = shallowRef(false)
const editingId = shallowRef('')
const ledgerFilter = shallowRef<'active' | 'archived'>('active')
const draft = reactive<ReviewDraft>({
  title: '',
  subject: '',
  note: '',
  learnedOn: today.value
})

watch(today, (next, previous) => {
  if (selectedDate.value === previous) selectedDate.value = next
})

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
)

const monthDays = computed<MonthCell[]>(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      outside: date.getMonth() !== cursor.value.getMonth(),
      due: reviews.active.filter((item) => item.nextReviewDate === key),
      learnedCount: reviews.items.filter((item) => item.learnedOn === key).length,
      completedCount: reviews.items.reduce(
        (count, item) =>
          count + item.reviewLog.filter((entry) => entry.completedOn === key).length,
        0
      )
    }
  })
})

const todayDue = computed(() =>
  reviews.active
    .filter((item) => isReviewDue(item, today.value))
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
)

const selectedDue = computed(() => {
  if (selectedDate.value === today.value) return todayDue.value
  return reviews.active
    .filter((item) => item.nextReviewDate === selectedDate.value)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
})

const selectedLearned = computed(() =>
  reviews.items.filter((item) => item.learnedOn === selectedDate.value)
)

const selectedCompleted = computed(() =>
  reviews.items
    .flatMap((item) =>
      item.reviewLog
        .filter((entry) => entry.completedOn === selectedDate.value)
        .map((entry) => ({ item, entry }))
    )
    .sort((a, b) => a.entry.round - b.entry.round)
)

const selectedLabel = computed(() => {
  const date = parseDateKey(selectedDate.value)
  return date
    ? date.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    : selectedDate.value
})

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

const schedulePreview = computed(() => {
  if (!parseDateKey(draft.learnedOn)) return []
  return scheduledReviewDates(draft.learnedOn).map((date, index) => ({
    round: index + 1,
    days: REVIEW_INTERVALS[index],
    date
  }))
})

const editingItem = computed(
  () => reviews.items.find((item) => item.id === editingId.value) ?? null
)

const ledgerItems = computed(() =>
  ledgerFilter.value === 'active' ? reviews.active : reviews.archived
)

function formatMonthDay(value: string): string {
  const date = parseDateKey(value)
  return date
    ? date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : value
}

function daysFromToday(value: string): number {
  const target = parseDateKey(value)
  const current = parseDateKey(today.value)
  if (!target || !current) return 0
  return Math.round((target.getTime() - current.getTime()) / 86_400_000)
}

function dueLabel(item: ReviewItem): string {
  const days = daysFromToday(item.nextReviewDate)
  if (days < 0) return `逾期 ${daysOverdue(item, today.value)} 天`
  if (days === 0) return '今天复习'
  if (days === 1) return '明天复习'
  return `${days} 天后复习`
}

function changeMonth(delta: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function jumpToToday(): void {
  const date = parseDateKey(today.value) ?? new Date()
  cursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
  selectedDate.value = today.value
}

function selectDate(key: string): void {
  selectedDate.value = key
  const date = parseDateKey(key)
  if (date && date.getMonth() !== cursor.value.getMonth()) {
    cursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
  }
}

function openCreate(date = today.value): void {
  const initialDate = date > today.value ? today.value : date
  Object.assign(draft, {
    title: '',
    subject: '',
    note: '',
    learnedOn: initialDate
  })
  editingId.value = ''
  showEditor.value = true
}

function openEdit(item: ReviewItem): void {
  Object.assign(draft, {
    title: item.title,
    subject: item.subject,
    note: item.note,
    learnedOn: item.learnedOn
  })
  editingId.value = item.id
  showEditor.value = true
}

function closeEditor(): void {
  showEditor.value = false
  editingId.value = ''
}

function save(): void {
  const title = draft.title.trim()
  if (!title || !parseDateKey(draft.learnedOn) || draft.learnedOn > today.value) {
    ui.error('请填写知识主题，并选择今天或更早的学习日期')
    return
  }
  const input = {
    title,
    subject: draft.subject.trim(),
    note: draft.note.trim(),
    learnedOn: draft.learnedOn
  }
  const item = editingId.value ? reviews.update(editingId.value, input) : reviews.add(input)
  if (!item) {
    ui.error('这条记录已经不在了')
    closeEditor()
    return
  }
  selectedDate.value = item.learnedOn
  const learnedDate = parseDateKey(item.learnedOn)
  if (learnedDate) {
    cursor.value = new Date(learnedDate.getFullYear(), learnedDate.getMonth(), 1)
  }
  ui.success(editingId.value ? '知识记录已更新' : `已排入 ${item.nextReviewDate} 的第 1 轮复习`)
  closeEditor()
}

async function remove(): Promise<void> {
  const item = editingItem.value
  if (!item) return
  const confirmed = await ui.confirm({
    title: '删除这条知识记录？',
    message: '删除后，它的复习日历、轮次记录和到期提醒会一起移除。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  reviews.remove(item.id)
  closeEditor()
  ui.success('知识记录已删除')
}

function complete(item: ReviewItem): void {
  if (!isReviewDue(item, today.value)) return
  const wasLastRound = item.round + 1 >= item.totalRounds
  const updated = reviews.complete(item.id, today.value)
  if (!updated) return
  ui.success(
    wasLastRound || updated.archived
      ? '六轮复习已完成，这条知识已归档'
      : `第 ${updated.round} 轮完成，下次复习：${formatMonthDay(updated.nextReviewDate)}`
  )
}

function saveReminder(): void {
  reviews.updateReminder({ ...reviews.reminder })
}
</script>

<template>
  <div class="page reviews-page">
    <header class="reviews-head">
      <div>
        <p class="eyebrow">记忆曲线</p>
        <h2>在遗忘之前，再见一次</h2>
        <p>
          按 1、2、4、7、15、30 天的间隔复习。每条知识最多 6 轮，完成后归档，不会无限延长。
        </p>
      </div>
      <button class="btn" @click="openCreate()">
        <AppIcon name="plus" :size="14" />
        记录今日所学
      </button>
    </header>

    <section class="review-metrics" aria-label="复习概览">
      <div>
        <span>今日待复习</span>
        <strong>{{ todayDue.length }}</strong>
        <small>{{ todayDue.length ? '按计划完成本轮' : '今天没有到期任务' }}</small>
      </div>
      <div>
        <span>学习中</span>
        <strong>{{ reviews.active.length }}</strong>
        <small>条知识正在排期</small>
      </div>
      <div>
        <span>未来 7 天</span>
        <strong>{{ weekDue }}</strong>
        <small>次复习安排</small>
      </div>
      <div>
        <span>累计复习</span>
        <strong>{{ reviewedRounds }}</strong>
        <small>{{ reviews.archived.length }} 条已归档</small>
      </div>
    </section>

    <div class="review-layout">
      <section class="calendar-panel">
        <div class="calendar-toolbar">
          <button class="icon-action" title="上个月" @click="changeMonth(-1)">
            <AppIcon name="chevron-left" :size="17" />
          </button>
          <strong>{{ monthLabel }}</strong>
          <button class="icon-action" title="下个月" @click="changeMonth(1)">
            <AppIcon name="chevron-right" :size="17" />
          </button>
          <button class="today-btn" @click="jumpToToday">今天</button>
        </div>
        <div class="calendar-legend">
          <span><i class="legend-dot due" />下次复习</span>
          <span><i class="legend-dot learned" />当天所学</span>
          <span><i class="legend-dot complete" />完成复习</span>
        </div>
        <div class="week-labels">
          <span v-for="label in ['日', '一', '二', '三', '四', '五', '六']" :key="label">
            {{ label }}
          </span>
        </div>
        <div class="month-grid">
          <button
            v-for="cell in monthDays"
            :key="cell.key"
            class="day-cell"
            :class="{
              outside: cell.outside,
              selected: cell.key === selectedDate,
              today: cell.key === today,
              overdue: cell.due.some((item) => item.nextReviewDate < today)
            }"
            @click="selectDate(cell.key)"
          >
            <span class="day-top">
              <span class="day-number">{{ cell.day }}</span>
              <span v-if="cell.completedCount" class="completed-mark" :title="`完成 ${cell.completedCount} 次复习`">
                {{ cell.completedCount }}
              </span>
            </span>
            <span
              v-for="item in cell.due.slice(0, 2)"
              :key="item.id"
              class="review-chip"
              :title="`${item.title} · 第 ${item.round + 1}/${item.totalRounds} 轮`"
            >
              {{ item.title }}
            </span>
            <span v-if="cell.due.length > 2" class="more-events">
              +{{ cell.due.length - 2 }} 条复习
            </span>
            <span v-if="cell.learnedCount" class="learned-mark">
              {{ cell.learnedCount }} 项所学
            </span>
            <span
              v-if="!cell.due.length && !cell.learnedCount && cell.completedCount"
              class="quiet-mark"
            >
              已完成
            </span>
          </button>
        </div>
      </section>

      <aside class="review-side">
        <section class="day-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">{{ selectedDate === today ? '今日安排' : '选中日期' }}</p>
              <h3>{{ selectedLabel }}</h3>
            </div>
            <button class="icon-action" title="记录当天所学" @click="openCreate(selectedDate)">
              <AppIcon name="plus" :size="17" />
            </button>
          </div>

          <div v-if="selectedDue.length" class="agenda-list">
            <article v-for="item in selectedDue" :key="item.id" class="agenda-item">
              <div class="agenda-title-row">
                <strong>{{ item.title }}</strong>
                <span
                  class="agenda-status"
                  :class="{ due: isReviewDue(item, today), overdue: item.nextReviewDate < today }"
                >
                  {{ dueLabel(item) }}
                </span>
              </div>
              <p v-if="item.subject" class="agenda-subject">{{ item.subject }}</p>
              <p v-if="item.note" class="agenda-note">{{ item.note }}</p>
              <div class="round-row">
                <span class="round-label">
                  第 {{ item.round + 1 }}/{{ item.totalRounds }} 轮
                </span>
                <span class="round-dots" :aria-label="`已完成 ${item.round} 轮`">
                  <i
                    v-for="round in Array.from({ length: item.totalRounds }, (_, i) => i + 1)"
                    :key="round"
                    :class="{ done: round <= item.round, current: round === item.round + 1 }"
                  />
                </span>
              </div>
              <div class="agenda-actions">
                <button class="btn btn-secondary btn-sm" @click="openEdit(item)">查看</button>
                <button
                  v-if="isReviewDue(item, today)"
                  class="btn btn-sm"
                  @click="complete(item)"
                >
                  <AppIcon name="check" :size="13" />
                  完成本轮
                </button>
              </div>
            </article>
          </div>
          <div v-else class="agenda-empty">
            <AppIcon name="check" :size="23" />
            <p>{{ selectedDate === today ? '今天的复习已经清空' : '这一天没有待复习内容' }}</p>
            <button class="btn btn-secondary btn-sm" @click="openCreate(selectedDate)">
              记录当天所学
            </button>
          </div>

          <div v-if="selectedLearned.length || selectedCompleted.length" class="day-activity">
            <p class="activity-title">当天记录</p>
            <div
              v-for="item in selectedLearned"
              :key="`learned-${item.id}`"
              class="activity-line"
            >
              <span class="activity-mark learned" />
              <span>学习 {{ item.title }}</span>
            </div>
            <div
              v-for="log in selectedCompleted"
              :key="`completed-${log.item.id}-${log.entry.round}`"
              class="activity-line"
            >
              <span class="activity-mark complete" />
              <span>完成 {{ log.item.title }} · 第 {{ log.entry.round }} 轮</span>
            </div>
          </div>
        </section>

        <section class="reminder-panel">
          <div class="reminder-head">
            <div>
              <p class="s-title">复习提醒</p>
              <p class="s-sub">到期当天由系统通知提醒</p>
            </div>
            <label class="switch">
              <input
                v-model="reviews.reminder.enabled"
                type="checkbox"
                @change="saveReminder"
              />
              <span class="slider" />
            </label>
          </div>
          <label class="reminder-time">
            <span>每日提醒时间</span>
            <input
              v-model="reviews.reminder.time"
              class="input input-sm"
              type="time"
              :disabled="!reviews.reminder.enabled"
              @change="saveReminder"
            />
          </label>
          <p class="reminder-hint">应用在托盘后台运行时也会提醒；同一计划只通知一次。</p>
        </section>
      </aside>
    </div>

    <section class="ledger-panel">
      <div class="ledger-head">
        <div>
          <p class="eyebrow">知识档案</p>
          <h3>每条知识都有自己的复习进度</h3>
        </div>
        <div class="seg">
          <button
            class="seg-btn"
            :class="{ active: ledgerFilter === 'active' }"
            @click="ledgerFilter = 'active'"
          >
            学习中 {{ reviews.active.length }}
          </button>
          <button
            class="seg-btn"
            :class="{ active: ledgerFilter === 'archived' }"
            @click="ledgerFilter = 'archived'"
          >
            已完成 {{ reviews.archived.length }}
          </button>
        </div>
      </div>

      <div v-if="ledgerItems.length" class="ledger-list">
        <article v-for="item in ledgerItems" :key="item.id" class="ledger-row">
          <button class="ledger-main" @click="openEdit(item)">
            <span class="ledger-title-line">
              <strong>{{ item.title }}</strong>
              <span v-if="item.subject" class="ledger-subject">{{ item.subject }}</span>
            </span>
            <span class="ledger-meta">
              {{ item.learnedOn }} 所学 ·
              {{
                item.archived
                  ? `${item.totalRounds} 轮全部完成`
                  : `下次 ${formatMonthDay(item.nextReviewDate)}`
              }}
            </span>
          </button>
          <div class="ledger-progress">
            <span>{{ item.round }}/{{ item.totalRounds }}</span>
            <span class="round-dots">
              <i
                v-for="round in Array.from({ length: item.totalRounds }, (_, i) => i + 1)"
                :key="round"
                :class="{ done: round <= item.round }"
              />
            </span>
          </div>
          <div class="ledger-actions">
            <button class="btn btn-secondary btn-sm" @click="openEdit(item)">编辑</button>
            <button
              v-if="isReviewDue(item, today)"
              class="btn btn-sm"
              @click="complete(item)"
            >
              完成本轮
            </button>
          </div>
        </article>
      </div>
      <div v-else class="ledger-empty">
        <AppIcon name="brain" :size="28" />
        <p>{{ ledgerFilter === 'active' ? '还没有正在复习的知识' : '还没有完成全部轮次的知识' }}</p>
        <button v-if="ledgerFilter === 'active'" class="btn btn-secondary btn-sm" @click="openCreate()">
          记录第一条
        </button>
      </div>
    </section>

    <AppModal
      v-if="showEditor"
      :title="editingId ? '编辑知识记录' : '记录今日所学'"
      @close="closeEditor"
    >
      <div class="review-form">
        <label class="field">
          <span>知识主题</span>
          <input
            v-model="draft.title"
            class="input"
            maxlength="80"
            placeholder="例如：导数与微分的关系"
          />
        </label>
        <label class="field">
          <span>学科 / 来源</span>
          <input
            v-model="draft.subject"
            class="input"
            maxlength="40"
            placeholder="例如：高等数学 · 第三章"
          />
        </label>
        <label class="field">
          <span>学习日期</span>
          <input
            v-model="draft.learnedOn"
            class="input"
            type="date"
            :max="today"
          />
        </label>
        <label class="field">
          <span>摘要 / 易错点</span>
          <textarea
            v-model="draft.note"
            class="input"
            rows="3"
            maxlength="500"
            placeholder="写下关键结论、例题或容易混淆的地方"
          />
        </label>
        <div class="schedule-preview">
          <div class="preview-head">
            <span>复习排期</span>
            <small>完成一轮后，下一轮从实际完成日重新起算</small>
          </div>
          <div class="preview-grid">
            <span v-for="entry in schedulePreview" :key="entry.round">
              <b>第 {{ entry.round }} 轮</b>
              <small>{{ formatMonthDay(entry.date) }}</small>
              <em>+{{ entry.days }} 天</em>
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <button v-if="editingId" class="btn btn-danger btn-sm" @click="remove">删除</button>
        <button class="btn btn-secondary btn-sm" @click="closeEditor">取消</button>
        <button class="btn btn-sm" :disabled="!draft.title.trim()" @click="save">
          {{ editingId ? '保存修改' : '加入复习计划' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.reviews-page {
  max-width: 1180px;
}
.reviews-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 4px 20px;
  border-bottom: 1px solid var(--separator);
}
.reviews-head h2 {
  font-size: 24px;
  line-height: 1.25;
}
.reviews-head p:last-child {
  max-width: 700px;
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.reviews-head > .btn {
  flex-shrink: 0;
  white-space: nowrap;
}
.review-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 16px 0;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
}
.review-metrics > div {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 3px 10px;
  padding: 14px 16px;
  border-right: 1px solid var(--separator);
}
.review-metrics > div:last-child {
  border-right: 0;
}
.review-metrics span {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
}
.review-metrics strong {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--accent-strong);
  font-size: 27px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.review-metrics small {
  color: var(--text-secondary);
  font-size: 11px;
}
.review-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
}
.calendar-panel,
.day-panel,
.reminder-panel,
.ledger-panel {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
}
.calendar-panel {
  min-width: 0;
  padding: 16px;
}
.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.calendar-toolbar strong {
  min-width: 130px;
  text-align: center;
  font-size: 16px;
}
.today-btn {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 12px;
}
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}
.calendar-legend {
  display: flex;
  gap: 14px;
  margin-bottom: 12px;
  color: var(--text-tertiary);
  font-size: 10px;
}
.calendar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.legend-dot.due {
  background: var(--brand-peach);
}
.legend-dot.learned {
  background: var(--brand-sky);
}
.legend-dot.complete {
  background: var(--status-success);
}
.week-labels,
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}
.week-labels {
  margin-bottom: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: center;
}
.day-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 88px;
  padding: 7px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-primary);
  text-align: left;
}
.day-cell:hover,
.day-cell.selected {
  border-color: var(--accent);
}
.day-cell.outside {
  opacity: 0.45;
}
.day-cell.today {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-muted));
}
.day-cell.today .day-number {
  color: var(--accent-strong);
  font-weight: 800;
}
.day-cell.overdue {
  border-color: color-mix(in srgb, var(--status-danger) 28%, transparent);
}
.day-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 16px;
  margin-bottom: 4px;
}
.day-number {
  color: var(--text-secondary);
  font-size: 12px;
}
.completed-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--status-success) 14%, transparent);
  color: var(--status-success);
  font-size: 9px;
  font-weight: 800;
}
.review-chip {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  padding: 3px 5px;
  border-left: 2px solid var(--brand-peach);
  border-radius: 3px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 9.5px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.more-events {
  display: block;
  margin-top: 3px;
  color: var(--brand-peach);
  font-size: 9px;
  font-weight: 700;
}
.learned-mark,
.quiet-mark {
  display: block;
  margin-top: auto;
  padding-top: 4px;
  color: var(--brand-sky);
  font-size: 9px;
  font-weight: 700;
}
.quiet-mark {
  color: var(--text-tertiary);
}
.review-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.day-panel {
  padding: 16px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--separator);
}
.panel-head h3 {
  margin-top: 4px;
  font-size: 16px;
}
.agenda-list {
  display: flex;
  flex-direction: column;
}
.agenda-item {
  padding: 13px 0;
  border-bottom: 1px solid var(--separator);
}
.agenda-item:last-child {
  border-bottom: 0;
}
.agenda-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.agenda-title-row strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agenda-status {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-weight: 700;
}
.agenda-status.due {
  background: color-mix(in srgb, var(--brand-peach) 14%, transparent);
  color: var(--brand-peach);
}
.agenda-status.overdue {
  background: color-mix(in srgb, var(--status-danger) 12%, transparent);
  color: var(--status-danger);
}
.agenda-subject,
.agenda-note {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}
.agenda-note {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.round-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
}
.round-label {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 700;
}
.round-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.round-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--surface-pressed);
}
.round-dots i.done {
  background: var(--status-success);
}
.round-dots i.current {
  background: var(--brand-peach);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-peach) 18%, transparent);
}
.agenda-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 10px;
}
.agenda-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 32px 10px 18px;
  color: var(--text-tertiary);
  text-align: center;
}
.agenda-empty p {
  font-size: 12px;
}
.day-activity {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--separator);
}
.activity-title {
  margin-bottom: 7px;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 800;
}
.activity-line {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 10.5px;
}
.activity-line span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-mark {
  width: 5px;
  height: 5px;
  flex-shrink: 0;
  border-radius: 50%;
}
.activity-mark.learned {
  background: var(--brand-sky);
}
.activity-mark.complete {
  background: var(--status-success);
}
.reminder-panel {
  padding: 15px 16px;
}
.reminder-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.reminder-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
}
.reminder-time .input {
  width: 116px;
}
.reminder-hint {
  margin-top: 9px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.45;
}
.ledger-panel {
  margin-top: 18px;
  padding: 16px;
}
.ledger-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--separator);
}
.ledger-head h3 {
  margin-top: 4px;
  font-size: 17px;
}
.ledger-list {
  display: flex;
  flex-direction: column;
}
.ledger-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px auto;
  align-items: center;
  gap: 16px;
  padding: 13px 2px;
  border-bottom: 1px solid var(--separator);
}
.ledger-row:last-child {
  border-bottom: 0;
}
.ledger-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}
.ledger-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ledger-title-line strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ledger-subject {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 9.5px;
}
.ledger-meta {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ledger-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.ledger-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}
.ledger-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 36px 16px 18px;
  color: var(--text-tertiary);
  text-align: center;
}
.ledger-empty p {
  font-size: 12px;
}
.review-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field > span {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.field textarea {
  resize: vertical;
}
.schedule-preview {
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  background: var(--surface-muted);
}
.preview-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.preview-head span {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 750;
}
.preview-head small {
  color: var(--text-tertiary);
  font-size: 10px;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  margin-top: 10px;
}
.preview-grid > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--surface-raised);
}
.preview-grid b {
  color: var(--text-primary);
  font-size: 10.5px;
}
.preview-grid small {
  color: var(--accent-strong);
  font-size: 10px;
}
.preview-grid em {
  color: var(--text-tertiary);
  font-size: 9px;
  font-style: normal;
}
@media (max-width: 1050px) {
  .review-layout {
    grid-template-columns: 1fr;
  }
  .review-side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
  }
}
@media (max-width: 760px) {
  .reviews-head,
  .ledger-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .review-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .review-metrics > div:nth-child(2) {
    border-right: 0;
  }
  .review-metrics > div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--separator);
  }
  .review-side,
  .ledger-row {
    grid-template-columns: 1fr;
  }
  .ledger-actions {
    justify-content: flex-start;
  }
  .preview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
