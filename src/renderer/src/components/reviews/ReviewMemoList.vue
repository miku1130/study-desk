<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { compareDateKeys, daysOverdue, isReviewOverdue } from '@/lib/reviewSchedule'
import type { ReviewItem } from '@/types'

interface MemoRow {
  item: ReviewItem
  canComplete: boolean
  overdueDays: number
  status: string
}

const props = defineProps<{
  items: ReviewItem[]
  today: string
}>()

const emit = defineEmits<{
  complete: [item: ReviewItem]
  remove: [item: ReviewItem]
}>()

const rows = computed<MemoRow[]>(() =>
  props.items.map((item) => {
    const overdue = isReviewOverdue(item, props.today)
    const future = compareDateKeys(item.nextReviewDate, props.today) > 0
    return {
      item,
      canComplete: !future,
      overdueDays: overdue ? daysOverdue(item, props.today) : 0,
      status: overdue
        ? `逾期 ${daysOverdue(item, props.today)} 天`
        : future
          ? '尚未到期'
          : '今天复习'
    }
  })
)
</script>

<template>
  <TransitionGroup name="memo-row" tag="div" class="memo-rows">
    <div
      v-for="row in rows"
      :key="row.item.id"
      class="memo-row"
      :class="{ overdue: row.overdueDays > 0, locked: !row.canComplete }"
    >
      <button
        type="button"
        class="review-check"
        role="checkbox"
        :aria-checked="false"
        :aria-label="`标记“${row.item.title}”为已复习`"
        :disabled="!row.canComplete"
        @click="emit('complete', row.item)"
      >
        <AppIcon name="check" :size="13" :stroke-width="2.4" />
      </button>

      <div class="memo-copy">
        <p class="memo-title">{{ row.item.title }}</p>
        <p v-if="row.item.note" class="memo-note">{{ row.item.note }}</p>
      </div>

      <div class="memo-side">
        <span
          class="row-status"
          :class="{ overdue: row.overdueDays > 0, locked: !row.canComplete }"
        >
          {{ row.status }}
        </span>
        <span class="round-label">
          第 {{ Math.min(row.item.round + 1, row.item.totalRounds) }} / {{ row.item.totalRounds }} 轮
        </span>
      </div>

      <button
        type="button"
        class="row-delete"
        title="删除记录"
        @click="emit('remove', row.item)"
      >
        <AppIcon name="trash" :size="13" />
      </button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.memo-rows {
  position: relative;
}

.memo-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto 24px;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.memo-row:last-child {
  border-bottom: 0;
}

.memo-row:hover .row-delete {
  opacity: 1;
}

.review-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1.7px solid color-mix(in srgb, var(--text-tertiary) 72%, transparent);
  border-radius: 6px;
  background: transparent;
  color: transparent;
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.review-check:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.review-check:disabled {
  border-color: var(--border-subtle);
  opacity: 0.55;
}

.memo-copy {
  min-width: 0;
}

.memo-title {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.42;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memo-note {
  overflow: hidden;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memo-side {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 3px;
  min-width: 82px;
}

.row-status {
  color: var(--status-warning);
  font-size: 9.5px;
  font-weight: 760;
  white-space: nowrap;
}

.row-status.overdue {
  color: var(--status-danger);
}

.row-status.locked {
  color: var(--text-tertiary);
}

.round-label {
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.row-delete {
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
  transition:
    opacity var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.row-delete:hover {
  background: color-mix(in srgb, var(--status-danger) 10%, transparent);
  color: var(--status-danger);
}

.row-delete:focus-visible {
  opacity: 1;
}

.memo-row-enter-active,
.memo-row-leave-active {
  transition:
    opacity var(--duration-base) var(--ease),
    transform var(--duration-base) var(--ease);
}

.memo-row-enter-from,
.memo-row-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.memo-row-leave-active {
  position: absolute;
  width: 100%;
}

.memo-row-move {
  transition: transform var(--duration-base) var(--ease);
}

@media (max-width: 640px) {
  .memo-row {
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 9px;
  }

  .row-delete {
    display: none;
  }

  .memo-side {
    min-width: 70px;
  }
}
</style>
