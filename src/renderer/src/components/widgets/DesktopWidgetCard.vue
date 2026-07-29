<script setup lang="ts">
import { computed, nextTick, ref, type CSSProperties } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { daysLeft } from '@/stores/countdowns'
import type { Countdown, DesktopWidgetConfig, TodoItem } from '@/types'

export interface WidgetLessonItem {
  id: string
  name: string
  start: string
  end: string
  location: string
  teacher: string
  color: string
}

const props = defineProps<{
  config: DesktopWidgetConfig
  countdown?: Countdown | null
  lessons?: WidgetLessonItem[]
  memos?: TodoItem[]
  preview?: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-lock': []
  'cycle-countdown': []
  'add-memo': [text: string]
}>()

const showMemoInput = ref(false)
const memoDraft = ref('')
const memoInput = ref<HTMLInputElement | null>(null)

const fontStack = computed(() => {
  if (props.config.font === 'serif') return '"Songti SC", "STSong", Georgia, serif'
  if (props.config.font === 'rounded') return '"Microsoft YaHei UI", "PingFang SC", sans-serif'
  if (props.config.font === 'mono') return '"Cascadia Mono", "SFMono-Regular", Consolas, monospace'
  if (props.config.font === 'handwriting') return '"Ma Shan Zheng", cursive'
  if (props.config.font === 'literary') return '"ZCOOL XiaoWei", serif'
  if (props.config.font === 'display') return '"ZCOOL QingKe HuangYou", sans-serif'
  return 'Inter, "Microsoft YaHei UI", "PingFang SC", sans-serif'
})

const cardStyle = computed<CSSProperties>(() => {
  const style = {
    '--widget-color': props.config.fontColor,
    '--widget-accent': props.config.accentColor,
    '--widget-font': fontStack.value
  } as CSSProperties
  return style
})

const surfaceStyle = computed<CSSProperties>(() => ({
  backgroundColor: props.config.backgroundColor,
  backgroundImage: props.config.background
    ? `linear-gradient(rgba(10, 14, 12, ${props.config.overlayOpacity}), rgba(10, 14, 12, ${props.config.overlayOpacity})), url('${window.api.media.url(props.config.background)}')`
    : undefined,
  opacity: props.config.surfaceOpacity
}))

const countdownNumber = computed(() => Math.abs(daysLeft(props.countdown?.date ?? '')))
const countdownState = computed(() => {
  const days = daysLeft(props.countdown?.date ?? '')
  if (days > 0) return '距离目标还有'
  if (days === 0) return '就是今天'
  return `已经过去 ${Math.abs(days)} 天`
})

function lessonDuration(start: string, end: string): string {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const minutes = endHour * 60 + endMinute - startHour * 60 - startMinute
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} 小时` : `${minutes} 分钟`
}

async function openMemoInput(): Promise<void> {
  showMemoInput.value = true
  await nextTick()
  memoInput.value?.focus()
}

function submitMemo(): void {
  const text = memoDraft.value.trim()
  if (!text) return
  emit('add-memo', text)
  memoDraft.value = ''
  showMemoInput.value = false
}
</script>

<template>
  <article
    class="desktop-widget-card"
    :class="[`kind-${config.kind}`, `size-${config.size}`, { locked: config.locked, preview }]"
    :style="cardStyle"
  >
    <span class="widget-surface" :style="surfaceStyle" />
    <header class="widget-head">
      <span class="widget-kicker">
        <AppIcon :name="config.kind === 'countdown' ? 'hourglass' : config.kind === 'timetable' ? 'calendar' : 'note'" :size="13" />
        {{ config.kind === 'countdown' ? '倒数日' : config.kind === 'timetable' ? '今日课表' : '备忘录' }}
      </span>
      <div v-if="!preview" class="widget-actions">
        <button v-if="config.kind === 'countdown'" class="widget-action" title="切换倒数日" @click="$emit('cycle-countdown')">
          <AppIcon name="rotate-ccw" :size="13" />
        </button>
        <button v-if="config.kind === 'memo' && !config.locked" class="widget-action" title="快捷记录" @click="openMemoInput">
          <AppIcon name="plus" :size="14" />
        </button>
        <button class="widget-action widget-lock-toggle" :title="config.locked ? '解锁摆件' : '锁定摆件'" @click="$emit('toggle-lock')">
          <AppIcon :name="config.locked ? 'lock' : 'unlock'" :size="13" />
        </button>
        <button v-if="!config.locked" class="widget-action" title="关闭摆件" @click="$emit('close')">
          <AppIcon name="x" :size="14" />
        </button>
      </div>
      <AppIcon v-else-if="config.locked" class="lock-mark" name="lock" :size="13" />
    </header>

    <section v-if="config.kind === 'countdown'" class="countdown-body">
      <p class="widget-title">{{ countdown?.title || config.title || '选择一个倒数日' }}</p>
      <p class="countdown-value">{{ countdownNumber }}<small>天</small></p>
      <div class="widget-footer">
        <span>{{ countdownState }}</span>
        <time>{{ countdown?.date || '尚未设置日期' }}</time>
      </div>
    </section>

    <section v-else-if="config.kind === 'timetable'" class="timetable-body">
      <p class="widget-title">{{ config.title || '今天的课程' }}</p>
      <div v-if="lessons?.length" class="lesson-list">
        <div v-for="lesson in lessons" :key="lesson.id" class="lesson-row">
          <span class="lesson-dot" :style="{ background: lesson.color }" />
          <span class="lesson-main">
            <strong>{{ lesson.name }}</strong>
            <small>{{ [lesson.teacher, lesson.location, lessonDuration(lesson.start, lesson.end)].filter(Boolean).join(' · ') || '课程安排' }}</small>
          </span>
          <time>{{ lesson.start }}<br />{{ lesson.end }}</time>
        </div>
      </div>
      <p v-else class="widget-empty">今天没有课程，留点时间给自己。</p>
    </section>

    <section v-else class="memo-body">
      <p class="widget-title">{{ config.title || '备忘与灵感' }}</p>
      <form v-if="showMemoInput && !config.locked" class="memo-quick" @submit.prevent="submitMemo">
        <input ref="memoInput" v-model="memoDraft" maxlength="120" placeholder="记录此刻想到的事" @keydown.esc="showMemoInput = false" />
        <button type="submit" title="保存"><AppIcon name="check" :size="13" /></button>
      </form>
      <div v-if="memos?.length" class="memo-list">
        <article v-for="item in memos" :key="item.id" class="memo-item">
          <span class="memo-kind">{{ item.kind === 'idea' ? '灵感' : '备忘' }}</span>
          <p>{{ item.text }}</p>
          <small v-if="item.note">{{ item.note }}</small>
        </article>
      </div>
      <p v-else class="widget-empty">暂无备忘，点击右上角加号快速记录。</p>
    </section>
  </article>
</template>

<style scoped>
.desktop-widget-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 18px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  color: var(--widget-color);
  font-family: var(--widget-font);
  -webkit-app-region: no-drag;
  container-type: size;
}
.desktop-widget-card:not(.locked):not(.preview) {
  cursor: grab;
}
.desktop-widget-card.preview {
  -webkit-app-region: no-drag;
}
.widget-surface {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-position: center;
  background-size: cover;
  pointer-events: none;
}
.widget-head,
.countdown-body,
.timetable-body,
.memo-body {
  position: relative;
  z-index: 1;
}
.widget-head {
  display: flex;
  align-items: center;
  min-height: 24px;
}
.widget-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: color-mix(in srgb, var(--widget-color) 72%, transparent);
  font-size: 11px;
  font-weight: 750;
}
.widget-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}
.widget-action {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  -webkit-app-region: no-drag;
}
.widget-action:hover {
  background: rgba(0, 0, 0, 0.36);
}
.lock-mark {
  margin-left: auto;
  opacity: 0.48;
}
.widget-title {
  margin-top: 10px;
  overflow: hidden;
  color: color-mix(in srgb, var(--widget-color) 88%, transparent);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.countdown-value {
  margin-top: 4px;
  color: var(--widget-accent);
  font-size: clamp(38px, 24cqh, 76px);
  font-weight: 820;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.countdown-value small {
  margin-left: 5px;
  color: var(--widget-color);
  font-size: 14px;
  font-weight: 700;
}
.widget-footer {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: color-mix(in srgb, var(--widget-color) 68%, transparent);
  font-size: 11px;
}
.widget-footer time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.countdown-body,
.memo-body,
.timetable-body {
  height: calc(100% - 24px);
}
.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
  overflow: hidden;
}
.lesson-row {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 45px;
  padding: 7px 9px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}
.lesson-dot {
  width: 4px;
  height: 26px;
  border-radius: 2px;
}
.lesson-main {
  min-width: 0;
}
.lesson-main strong,
.lesson-main small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-main strong {
  font-size: 12px;
}
.lesson-main small {
  margin-top: 2px;
  color: color-mix(in srgb, var(--widget-color) 61%, transparent);
  font-size: 10px;
}
.lesson-row time {
  color: color-mix(in srgb, var(--widget-color) 70%, transparent);
  font-size: 9.5px;
  line-height: 1.35;
  text-align: right;
}
.widget-empty {
  margin-top: 22px;
  color: color-mix(in srgb, var(--widget-color) 68%, transparent);
  font-size: 13px;
  line-height: 1.6;
}
.memo-list {
  height: calc(100% - 42px);
  margin-top: 9px;
  padding-right: 3px;
  overflow-y: auto;
  -webkit-app-region: no-drag;
}
.memo-item {
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--widget-color) 15%, transparent);
}
.memo-item:first-child { padding-top: 2px; }
.memo-item p {
  margin-top: 3px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  user-select: text;
}
.memo-item small,
.memo-kind {
  color: color-mix(in srgb, var(--widget-color) 64%, transparent);
  font-size: 9.5px;
  line-height: 1.45;
}
.memo-item small { display: block; margin-top: 3px; }
.memo-quick {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 5px;
  margin-top: 8px;
  -webkit-app-region: no-drag;
}
.memo-quick input {
  min-width: 0;
  flex: 1;
  height: 31px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  outline: 0;
  background: rgba(0, 0, 0, 0.28);
  color: inherit;
  font: inherit;
  font-size: 11px;
}
.memo-quick button {
  width: 31px;
  border: 0;
  border-radius: 6px;
  background: var(--widget-accent);
  color: #17201c;
}
@container (max-height: 195px) {
  .desktop-widget-card {
    padding: 14px;
  }
  .lesson-main small {
    display: none;
  }
  .lesson-list {
    gap: 5px;
  }
  .lesson-row {
    min-height: 36px;
    padding: 5px 7px;
  }
  .lesson-row:nth-child(n + 3) {
    display: none;
  }
  .memo-item { padding: 6px 0; }
}
</style>
