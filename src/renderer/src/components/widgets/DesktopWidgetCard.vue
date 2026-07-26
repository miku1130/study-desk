<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
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
  memo?: TodoItem | null
  preview?: boolean
}>()

defineEmits<{ close: [] }>()

const fontStack = computed(() => {
  if (props.config.font === 'serif') return '"Songti SC", "STSong", Georgia, serif'
  if (props.config.font === 'rounded') return '"Microsoft YaHei UI", "PingFang SC", sans-serif'
  if (props.config.font === 'mono') return '"Cascadia Mono", "SFMono-Regular", Consolas, monospace'
  return 'Inter, "Microsoft YaHei UI", "PingFang SC", sans-serif'
})

const cardStyle = computed<CSSProperties>(() => {
  const style = {
    '--widget-bg': props.config.backgroundColor,
    '--widget-surface-percent': `${Math.round(props.config.surfaceOpacity * 100)}%`,
    '--widget-overlay-opacity': String(props.config.overlayOpacity),
    '--widget-color': props.config.fontColor,
    '--widget-accent': props.config.accentColor,
    '--widget-font': fontStack.value
  } as CSSProperties
  if (props.config.background) {
    style.backgroundImage = `url('${window.api.media.url(props.config.background)}')`
  }
  return style
})

const countdownNumber = computed(() => Math.abs(daysLeft(props.countdown?.date ?? '')))
const countdownState = computed(() => {
  const days = daysLeft(props.countdown?.date ?? '')
  if (days > 0) return '距离目标还有'
  if (days === 0) return '就是今天'
  return `已经过去 ${Math.abs(days)} 天`
})
</script>

<template>
  <article
    class="desktop-widget-card"
    :class="[`kind-${config.kind}`, `size-${config.size}`, { locked: config.locked, preview }]"
    :style="cardStyle"
  >
    <span class="widget-tint" />
    <header class="widget-head">
      <span class="widget-kicker">
        <AppIcon :name="config.kind === 'countdown' ? 'hourglass' : config.kind === 'timetable' ? 'calendar' : 'note'" :size="13" />
        {{ config.kind === 'countdown' ? '倒数日' : config.kind === 'timetable' ? '今日课表' : '备忘录' }}
      </span>
      <button v-if="!preview && !config.locked" class="widget-close" title="关闭摆件" @click="$emit('close')">
        <AppIcon name="x" :size="14" />
      </button>
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
            <small>{{ [lesson.teacher, lesson.location].filter(Boolean).join(' · ') || '课程安排' }}</small>
          </span>
          <time>{{ lesson.start }}<br />{{ lesson.end }}</time>
        </div>
      </div>
      <p v-else class="widget-empty">今天没有课程，留点时间给自己。</p>
    </section>

    <section v-else class="memo-body">
      <p class="widget-title">{{ config.title || (memo?.kind === 'idea' ? '灵感' : '今日备忘') }}</p>
      <p class="memo-text">{{ memo?.text || '从备忘录中选择一条内容' }}</p>
      <p v-if="memo?.note" class="memo-note">{{ memo.note }}</p>
      <div class="widget-footer">
        <span>{{ memo?.tags?.slice(0, 2).join(' · ') || '学习桌面' }}</span>
        <time>{{ memo?.due || '随时记录' }}</time>
      </div>
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
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--widget-bg) var(--widget-surface-percent), transparent);
  background-size: cover;
  background-position: center;
  box-shadow: 0 14px 36px rgba(10, 15, 13, 0.24);
  color: var(--widget-color);
  font-family: var(--widget-font);
  -webkit-app-region: drag;
  container-type: size;
}
.desktop-widget-card.preview {
  -webkit-app-region: no-drag;
}
.widget-tint {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 12, var(--widget-overlay-opacity));
  pointer-events: none;
}
.desktop-widget-card:not([style*="background-image"]) .widget-tint {
  display: none;
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
.widget-close {
  width: 26px;
  height: 26px;
  margin: -3px -3px -3px auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  -webkit-app-region: no-drag;
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
.memo-text {
  display: -webkit-box;
  margin-top: 13px;
  overflow: hidden;
  font-family: inherit;
  font-size: clamp(18px, 9cqh, 28px);
  font-weight: 760;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.memo-note {
  display: -webkit-box;
  margin-top: 8px;
  overflow: hidden;
  color: color-mix(in srgb, var(--widget-color) 64%, transparent);
  font-size: 11px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
@container (max-height: 195px) {
  .desktop-widget-card {
    padding: 14px;
  }
  .memo-note,
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
}
</style>
