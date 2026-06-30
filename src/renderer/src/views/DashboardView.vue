<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClock } from '@/composables/useClock'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { useStatsStore } from '@/stores/stats'
import { useMusicStore } from '@/stores/music'
import { useTodoStore } from '@/stores/todos'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useWaterStore } from '@/stores/water'
import { useSettingsStore } from '@/stores/settings'
import { useCountdownStore, daysLeft } from '@/stores/countdowns'
import { WEEKDAYS } from '@/types'

const router = useRouter()
const { now } = useClock()
const { weekday, todayLessons, current, next, nextCountdown } = useTimetableStatus()
const stats = useStatsStore()
const music = useMusicStore()
const todos = useTodoStore()
const pomodoro = usePomodoroStore()
const water = useWaterStore()
const settings = useSettingsStore()
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
const todayStat = computed(() => stats.days[todayKey.value] ?? { pomodoros: 0, focusMinutes: 0 })

const nowMin = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
function toMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
function isPast(end: string): boolean {
  return nowMin.value >= toMin(end)
}

const previewTodos = computed(() => todos.items.filter((t) => !t.done).slice(0, 4))
const focusStatus = computed(() => (pomodoro.running ? pomodoro.phaseLabel : '未开始'))

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="page dashboard">
    <section class="hero card">
      <div class="hero-left">
        <p class="greeting">{{ greeting }}</p>
        <div class="clock">
          <span class="time">{{ timeText }}</span>
          <span class="sec">{{ secondsText }}</span>
        </div>
        <p class="date">{{ dateText }}</p>
      </div>
      <div class="hero-right">
        <button class="btn" @click="go('/pomodoro')">
          {{ pomodoro.running ? '查看计时' : '开始专注' }}
        </button>
      </div>
    </section>

    <div class="dash-grid">
      <section class="card classes-card">
        <header class="ch">
          <span>今日课程</span>
          <span class="badge">{{ WEEKDAYS[weekday - 1] }}</span>
        </header>
        <ul v-if="todayLessons.length" class="cls-list">
          <li
            v-for="l in todayLessons"
            :key="l.id"
            class="cls"
            :class="{ now: current && current.id === l.id, past: isPast(l.period.end) }"
          >
            <span class="cls-time">{{ l.period.start }}</span>
            <span class="cls-dot" :style="{ background: l.color }" />
            <span class="cls-name">{{ l.name }}</span>
            <span class="cls-loc">{{ l.location }}</span>
            <span v-if="current && current.id === l.id" class="cls-live">进行中</span>
          </li>
        </ul>
        <div v-else class="muted pad">今日无课，好好休息 ☕</div>
      </section>

      <section class="card focus-card">
        <p class="mini-label">今日专注</p>
        <p class="big">{{ todayStat.pomodoros }}<small> 个番茄</small></p>
        <p class="muted">{{ todayStat.focusMinutes }} 分钟 · {{ focusStatus }}</p>
        <button class="btn block" @click="go('/pomodoro')">
          {{ pomodoro.running ? '查看计时' : '开始专注' }}
        </button>
      </section>

      <section class="card todo-card">
        <p class="mini-label">待办（剩 {{ todos.remaining }}）</p>
        <ul v-if="previewTodos.length" class="td-list">
          <li v-for="t in previewTodos" :key="t.id"><span class="td-dot" />{{ t.text }}</li>
        </ul>
        <div v-else class="muted pad-sm">暂无待办</div>
        <button class="btn-link" @click="go('/todo')">管理待办 →</button>
      </section>

      <section class="card water-card">
        <p class="mini-label">今日饮水</p>
        <p class="big">{{ water.cupsToday }}<small> / {{ waterGoal }} 杯</small></p>
        <div class="water-bar"><div class="water-fill" :style="{ width: waterPct + '%' }" /></div>
        <button class="btn block" @click="water.addCup()">喝一杯 💧</button>
      </section>
    </div>

    <div class="dash-foot card">
      <span class="foot-next">
        下一节：{{
          next ? `${next.name} · ${next.period.start}（${nextCountdown}后）` : '今日无更多课程'
        }}
      </span>
      <span v-if="cd.nearest" class="foot-cd" @click="go('/countdown')">
        距 {{ cd.nearest.title }} 还有 {{ daysLeft(cd.nearest.date) }} 天
      </span>
      <span class="foot-music" @click="go('/music')">
        {{ music.current ? `${music.playing ? '♫' : '⏸'} ${music.current.name}` : '🎵 未播放' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 32px;
  background: linear-gradient(135deg, var(--bg-card-strong), var(--bg-card));
  margin-bottom: 16px;
}
.greeting {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.clock {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.time {
  font-size: 54px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sec {
  font-size: 22px;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.date {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.dash-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  grid-template-areas: 'classes focus' 'classes todo' 'classes water';
}
.classes-card {
  grid-area: classes;
}
.focus-card {
  grid-area: focus;
}
.todo-card {
  grid-area: todo;
}
.water-card {
  grid-area: water;
}
.water-bar {
  height: 8px;
  background: var(--active);
  border-radius: 100px;
  overflow: hidden;
  margin: 8px 0 14px;
}
.water-fill {
  height: 100%;
  background: linear-gradient(90deg, #0a84ff, #5ac8fa);
  border-radius: 100px;
  transition: width 0.3s var(--ease);
}

.ch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14.5px;
  font-weight: 700;
  margin-bottom: 12px;
}
.cls-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}
.cls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 9px;
  font-size: 13.5px;
}
.cls.now {
  background: var(--accent-soft);
}
.cls.past {
  opacity: 0.45;
}
.cls-time {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  font-weight: 600;
  width: 42px;
}
.cls-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cls-name {
  font-weight: 600;
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
  font-size: 12.5px;
  color: var(--text-tertiary);
  font-weight: 600;
}
.big {
  font-size: 40px;
  font-weight: 700;
  margin: 10px 0 2px;
}
.big small {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}
.btn.block {
  width: 100%;
  margin-top: 14px;
}
.muted {
  color: var(--text-secondary);
  font-size: 13px;
}
.pad {
  padding: 30px 0;
  text-align: center;
}
.pad-sm {
  padding: 10px 0;
}

.td-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 10px 0 12px;
}
.td-list li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
}
.td-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.btn-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  padding: 0;
}

.dash-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 14px 20px;
  font-size: 13px;
}
.foot-next {
  color: var(--text-secondary);
}
.foot-cd {
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}
.foot-music {
  color: var(--text-secondary);
  cursor: pointer;
}
.foot-music:hover {
  color: var(--accent);
}
</style>
