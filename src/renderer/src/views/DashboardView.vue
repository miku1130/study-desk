<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { useStatsStore } from '@/stores/stats'
import { useMusicStore } from '@/stores/music'
import { useTodoStore } from '@/stores/todos'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useWaterStore } from '@/stores/water'
import { useSettingsStore } from '@/stores/settings'
import { useGardenStore } from '@/stores/garden'
import { useCountdownStore, daysLeft } from '@/stores/countdowns'
import { WEEKDAYS } from '@/types'

const router = useRouter()
const { now, weekday, todayLessons, remainingLessons, current, next, nextCountdown } =
  useTimetableStatus()
const stats = useStatsStore()
const music = useMusicStore()
const todos = useTodoStore()
const pomodoro = usePomodoroStore()
const water = useWaterStore()
const settings = useSettingsStore()
const garden = useGardenStore()
const cd = useCountdownStore()

const waterGoal = computed(() => settings.s.water.goalCups || 8)
const waterPct = computed(() => Math.min(100, Math.round((water.cupsToday / waterGoal.value) * 100)))

const timeText = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
)
const secondsText = computed(() => String(now.value.getSeconds()).padStart(2, '0'))
const dateText = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
)
const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 12) return '早上好，开启高效一天'
  if (h < 14) return '中午好，适当放松'
  if (h < 18) return '下午好，继续加油'
  return '晚上好，专注收尾'
})

const todayKey = computed(() => {
  const d = now.value
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})
const todayStat = computed(() => stats.daily[todayKey.value] ?? { pomodoros: 0, focusMinutes: 0 })

const previewTodos = computed(() =>
  todos.items
    .filter((t) => !t.done)
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority)
    .slice(0, 3)
)
const memoTotal = computed(() => todos.items.filter((t) => t.kind !== 'task').length)
const focusStatus = computed(() => (pomodoro.running ? pomodoro.phaseLabel : '未开始'))

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="page dashboard">
    <section class="hero card">
      <div class="hero-left">
        <p class="hero-eyebrow"><span />TODAY · FOCUS DESK</p>
        <p class="greeting">{{ greeting }}</p>
        <div class="clock">
          <span class="time">{{ timeText }}</span>
          <span class="sec">{{ secondsText }}</span>
        </div>
        <p class="date">{{ dateText }}</p>
      </div>
      <div class="hero-right">
        <div class="hero-context">
          <span>当前节奏</span>
          <strong>{{ focusStatus }}</strong>
          <small>{{ todayStat.focusMinutes }} 分钟已投入</small>
        </div>
        <button class="btn" @click="go('/pomodoro')">
          <AppIcon :name="pomodoro.running ? 'timer' : 'play'" :size="14" />
          {{ pomodoro.running ? '查看计时' : '开始专注' }}
        </button>
      </div>
    </section>

    <div class="dash-grid">
      <section class="card classes-card">
        <header class="ch">
          <span class="card-title"><AppIcon name="calendar" :size="14" />今日课程</span>
          <span class="badge">{{ WEEKDAYS[weekday - 1] }}</span>
        </header>
        <ul v-if="remainingLessons.length" class="cls-list">
          <li
            v-for="l in remainingLessons"
            :key="l.id"
            class="cls"
            :class="{ now: current && current.id === l.id }"
          >
            <span class="cls-time">{{ l.period.start }}</span>
            <span class="cls-dot" :style="{ background: l.color }" />
            <span class="cls-name">{{ l.name }}</span>
            <span class="cls-loc">{{ l.location }}</span>
            <span v-if="current && current.id === l.id" class="cls-live">进行中</span>
          </li>
        </ul>
        <div v-else class="muted pad">
          <AppIcon name="coffee" :size="14" />
          {{ todayLessons.length ? '今天的课程已全部结束' : '今日无课，好好休息' }}
        </div>
      </section>

      <section class="card focus-card">
        <p class="mini-label"><AppIcon name="timer" :size="13" />今日专注</p>
        <p class="big">{{ todayStat.pomodoros }}<small> 个番茄</small></p>
        <p class="muted">{{ todayStat.focusMinutes }} 分钟 · {{ focusStatus }}</p>
        <p class="garden-line" @click="go('/garden')">
          <AppIcon name="tree" :size="12" />
          Lv.{{ garden.level }} · {{ garden.totalTrees }} 棵 · 连续 {{ garden.streak }} 天 →
        </p>
        <button class="btn btn-sm block" @click="go('/pomodoro')">
          <AppIcon :name="pomodoro.running ? 'timer' : 'play'" :size="13" />
          {{ pomodoro.running ? '查看计时' : '开始专注' }}
        </button>
      </section>

      <section class="card todo-card">
        <p class="mini-label"><AppIcon name="note" :size="13" />备忘录中心</p>
        <ul v-if="previewTodos.length" class="td-list">
          <li v-for="t in previewTodos" :key="t.id">
            <span class="td-dot" />
            <span class="td-text">{{ t.text }}</span>
          </li>
        </ul>
        <div v-else class="muted pad-sm">暂无待办</div>
        <div class="memo-summary">
          <span>{{ todos.remaining }} 个任务</span>
          <span>{{ memoTotal }} 条备忘</span>
          <button class="btn-link" @click="go('/todo')">打开备忘录 →</button>
        </div>
      </section>

      <section class="card water-card">
        <p class="mini-label"><AppIcon name="drop" :size="13" />今日饮水</p>
        <p class="big">{{ water.cupsToday }}<small> / {{ waterGoal }} 杯</small></p>
        <div class="water-bar"><div class="water-fill" :style="{ width: waterPct + '%' }" /></div>
        <button class="btn btn-sm block btn-secondary" @click="water.addCup()">
          <AppIcon name="drop" :size="13" />喝一杯
        </button>
      </section>
    </div>

    <div class="dash-foot card">
      <span class="foot-next">
        <AppIcon name="calendar" :size="13" />
        下一节：{{
          next ? `${next.name} · ${next.period.start}（${nextCountdown}后）` : '今日无更多课程'
        }}
      </span>
      <span v-if="cd.nearest" class="foot-cd" @click="go('/countdown')">
        <AppIcon name="hourglass" :size="13" />
        距 {{ cd.nearest.title }} 还有 {{ daysLeft(cd.nearest.date) }} 天
      </span>
      <span class="foot-music" @click="go('/music')">
        <AppIcon :name="music.current && !music.playing ? 'pause' : 'music'" :size="13" />
        {{ music.current ? music.current.name : '未播放' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* 单屏布局：整页填满内容区高度，各卡自适应压缩，页面不出现纵向滚动 */
.page.dashboard {
  height: 100%;
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}
.hero {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 100px;
  padding: 14px 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at 82% 22%, color-mix(in srgb, var(--brand-sky) 20%, transparent), transparent 21%),
    radial-gradient(circle at 67% 100%, color-mix(in srgb, var(--brand-peach) 13%, transparent), transparent 24%),
    linear-gradient(112deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 46%),
    var(--surface-card);
}
.hero::before,
.hero::after {
  content: '';
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--brand-sky) 25%, transparent);
  border-radius: 50%;
  pointer-events: none;
}
.hero::before {
  width: 190px;
  height: 190px;
  right: 58px;
  top: -92px;
}
.hero::after {
  width: 118px;
  height: 118px;
  right: 94px;
  top: -55px;
  border-color: color-mix(in srgb, var(--brand-peach) 30%, transparent);
}
.hero-left,
.hero-right {
  position: relative;
  z-index: 1;
}
.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 2px;
  color: var(--text-tertiary);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}
.hero-eyebrow span {
  width: 16px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--brand-peach), var(--brand-sun));
}
.greeting {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 1px;
}
.clock {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.time {
  font-size: clamp(34px, 5.2vh, 42px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.sec {
  font-size: 17px;
  font-weight: 600;
  color: var(--accent-strong);
  font-variant-numeric: tabular-nums;
}
.date {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}
.hero-right {
  display: flex;
  align-items: center;
  gap: 18px;
}
.hero-context {
  display: flex;
  flex-direction: column;
  min-width: 112px;
  padding-left: 16px;
  border-left: 1px solid var(--border-subtle);
}
.hero-context span {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 700;
}
.hero-context strong {
  margin-top: 2px;
  font-size: 13px;
}
.hero-context small {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 10.5px;
}

.dash-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 10px;
  grid-template-areas: 'classes focus' 'classes todo' 'classes water';
}
.dash-grid > .card {
  padding: 11px 14px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.classes-card {
  grid-area: classes;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--brand-sun) 7%, transparent), transparent 34%),
    var(--surface-raised);
}
.focus-card {
  grid-area: focus;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 11%, transparent), transparent 68%),
    var(--surface-card);
}
.todo-card {
  grid-area: todo;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand-peach) 11%, transparent), transparent 68%),
    var(--surface-card);
}
.water-card {
  grid-area: water;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand-sky) 12%, transparent), transparent 68%),
    var(--surface-card);
}
.water-bar {
  height: 6px;
  background: var(--surface-pressed);
  border-radius: 100px;
  overflow: hidden;
  margin: 7px 0 10px;
}
.water-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-sky), var(--accent));
  border-radius: 100px;
  transition: width 0.3s var(--ease);
}

.ch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.card-title,
.mini-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.card-title :deep(svg),
.mini-label :deep(svg) {
  color: var(--accent-strong);
}
.classes-card .card-title :deep(svg) {
  color: #c38c25;
}
.todo-card .mini-label :deep(svg) {
  color: #cf785d;
}
.water-card .mini-label :deep(svg) {
  color: #4f97cc;
}
.cls-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.cls {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 8px;
  border-radius: 8px;
  font-size: 13px;
  flex-shrink: 0;
}
.cls.now {
  background: var(--nav-active-bg);
  box-shadow: inset 2px 0 var(--accent);
}
.cls.past {
  opacity: 0.52;
}
.cls-time {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  font-weight: 600;
  width: 42px;
}
.cls-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cls-name {
  font-weight: 620;
}
.cls-loc {
  color: var(--text-tertiary);
  font-size: 12px;
  margin-left: auto;
}
.cls-live {
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
  margin-left: 8px;
}

.mini-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 680;
  flex-shrink: 0;
}
.big {
  font-size: clamp(22px, 3.6vh, 32px);
  font-weight: 740;
  margin: 4px 0 1px;
  line-height: 1.15;
}
.big small {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.btn.block {
  width: 100%;
  margin-top: auto;
}
.garden-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.garden-line:hover {
  color: var(--accent-strong);
}
.muted {
  color: var(--text-secondary);
  font-size: 12.5px;
}
.pad {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.pad-sm {
  flex: 1;
  display: flex;
  align-items: center;
}

.td-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 7px 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.td-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  min-width: 0;
}
.td-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.memo-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: nowrap;
  flex-shrink: 0;
}
.memo-summary span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.memo-summary .btn-link {
  margin-left: auto;
  white-space: nowrap;
}
.td-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand-peach);
  flex-shrink: 0;
}
.btn-link {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 600;
  padding: 0;
}

.dash-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 16px;
  font-size: 11.5px;
  background: color-mix(in srgb, var(--surface-card) 72%, transparent);
  box-shadow: none;
}
.foot-next {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.foot-cd {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #b8781e;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.foot-music {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}
.foot-music:hover {
  color: var(--accent-strong);
}

@media (max-height: 680px) {
  .hero {
    min-height: 88px;
    padding-block: 10px;
  }

  .hero-context {
    display: none;
  }

  .cls {
    padding-block: 5px;
  }
}
</style>
