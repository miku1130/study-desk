<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{
  dateLabel: string
}>()

const model = defineModel<string[]>({ required: true })
const rows = ref<string[]>([...model.value])

watch(
  rows,
  (next) => {
    model.value = [...next]
  },
  { deep: true }
)

const emit = defineEmits<{
  submit: []
}>()

const sheet = useTemplateRef<HTMLDivElement>('sheet')
const filledCount = computed(() => rows.value.filter((row) => row.trim()).length)

function focusRow(index: number): void {
  void nextTick(() => {
    const input = sheet.value?.querySelector<HTMLInputElement>(`input[data-row="${index}"]`)
    input?.focus()
    input?.select()
  })
}

function updateRow(index: number, value: string): void {
  const next = [...rows.value]
  next[index] = value
  if (index === next.length - 1 && value.trim() && next.length < 50) next.push('')
  rows.value = next
}

function addRow(): void {
  if (rows.value.length >= 50) return
  rows.value = [...rows.value, '']
  focusRow(rows.value.length - 1)
}

function clearRow(index: number): void {
  updateRow(index, '')
  focusRow(index)
}

function enterRow(index: number): void {
  if (index === rows.value.length - 1) addRow()
  else focusRow(index + 1)
}

function pasteRows(index: number, event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text') ?? ''
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  if (lines.length <= 1) return
  event.preventDefault()
  const before = rows.value.slice(0, index)
  const after = rows.value.slice(index + 1)
  const pasted = lines.slice(0, Math.max(1, 50 - before.length - after.length))
  const next = [...before, ...pasted, ...after]
  while (next.length < 5) next.push('')
  if (next[next.length - 1]?.trim()) next.push('')
  rows.value = next.slice(0, 50)
  focusRow(index + pasted.length - 1)
}

onMounted(() => {
  const emptyIndex = rows.value.findIndex((row) => !row.trim())
  focusRow(emptyIndex >= 0 ? emptyIndex : rows.value.length - 1)
})
</script>

<template>
  <div ref="sheet" class="record-sheet">
    <header class="sheet-head">
      <div>
        <p class="sheet-kicker">今日记录</p>
        <strong>{{ props.dateLabel }}</strong>
      </div>
      <span class="sheet-count">{{ filledCount }} 条</span>
    </header>

    <table class="record-table">
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="index"
          :class="{ filled: Boolean(row.trim()) }"
        >
          <td class="line-number">{{ String(index + 1).padStart(2, '0') }}</td>
          <td class="line-input">
            <input
              :value="row"
              :data-row="index"
              type="text"
              maxlength="120"
              :autocomplete="'off'"
              :placeholder="index === 0 ? '写下一个知识点' : '再记一条'"
              :aria-label="`第 ${index + 1} 条记录`"
              @input="updateRow(index, ($event.target as HTMLInputElement).value)"
              @keydown.enter.prevent="enterRow(index)"
              @keydown.ctrl.enter.prevent="emit('submit')"
              @keydown.meta.enter.prevent="emit('submit')"
              @paste="pasteRows(index, $event)"
            />
          </td>
          <td class="line-action">
            <button
              v-if="row.trim()"
              type="button"
              title="清空这一行"
              @click="clearRow(index)"
            >
              <AppIcon name="x" :size="12" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <button type="button" class="add-line" @click="addRow">
      <AppIcon name="plus" :size="13" />
      继续一行
    </button>
  </div>
</template>

<style scoped>
.record-sheet {
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-card);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 16px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-muted);
}

.sheet-head strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 720;
}

.sheet-kicker {
  margin-bottom: 2px;
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-weight: 760;
}

.sheet-count {
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
}

.record-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.record-table tr {
  transition: background var(--duration-fast) var(--ease);
}

.record-table tr:hover,
.record-table tr:focus-within {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.record-table td {
  height: 39px;
  padding: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.record-table tr:last-child td {
  border-bottom: 0;
}

.line-number {
  width: 38px;
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.record-table tr.filled .line-number {
  color: var(--accent);
}

.line-input {
  padding: 0 4px;
}

.line-input input {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.35;
}

.line-input input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.72;
}

.line-action {
  width: 32px;
}

.line-action button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
}

.line-action button:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.add-line {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 37px;
  padding: 0 16px;
  border: 0;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 680;
  text-align: left;
}

.add-line:hover {
  color: var(--accent-strong);
}
</style>
