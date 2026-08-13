<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useStatsStore } from '@/stores/stats'
import { buildHeatmap } from '@/lib/heatmap'
import type { FocusSession } from '@/types'

const stats = useStatsStore()

const RANGES = [
  { key: 7, label: '近 7 天' },
  { key: 30, label: '近 30 天' }
]
const rangeDays = shallowRef(7)
const metric = shallowRef<'minutes' | 'pomodoros'>('minutes')

const bars = computed(() => stats.range(rangeDays.value))
const maxValue = computed(() =>
  Math.max(1, ...bars.value.map((d) => (metric.value === 'minutes' ? d.focusMinutes : d.pomodoros)))
)
const rangeMinutes = computed(() => bars.value.reduce((sum, d) => sum + d.focusMinutes, 0))
const rangePomodoros = computed(() => bars.value.reduce((sum, d) => sum + d.pomodoros, 0))
/** 平均只按真正学过的天算，否则休息日会把数字稀释得没有意义 */
const activeDays = computed(() => bars.value.filter((d) => d.focusMinutes > 0).length)
const avgMinutes = computed(() =>
  activeDays.value ? Math.round(rangeMinutes.value / activeDays.value) : 0
)

function barValue(day: { focusMinutes: number; pomodoros: number }): number {
  return metric.value === 'minutes' ? day.focusMinutes : day.pomodoros
}

function barTitle(day: { label: string; focusMinutes: number; pomodoros: number }): string {
  return `${day.label} · ${duration(day.focusMinutes)} · ${day.pomodoros} 个番茄`
}

function duration(minutes: number): string {
  if (minutes <= 0) return '0 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

/* ---- 热力图 ---- */

const HEAT_WEEKS = 26
const heatmap = computed(() => buildHeatmap(stats.daily, { weeks: HEAT_WEEKS }))
const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', '']

function heatTitle(cell: { label: string; minutes: number; pomodoros: number }): string {
  if (cell.minutes <= 0) return `${cell.label} 没有记录`
  return `${cell.label} · ${duration(cell.minutes)} · ${cell.pomodoros} 个番茄`
}

/** 只画有记录的时段，凌晨那一片空白没必要占地方 */
const hourBars = computed(() => {
  const hours = stats.byHour
  const peak = Math.max(1, ...hours)
  return hours.map((minutes, hour) => ({ hour, minutes, ratio: minutes / peak }))
})
const hasHourData = computed(() => stats.byHour.some((m) => m > 0))
const peakHour = computed(() => {
  let best = -1
  let value = 0
  stats.byHour.forEach((minutes, hour) => {
    if (minutes > value) {
      value = minutes
      best = hour
    }
  })
  return best
})

const topTargets = computed(() => stats.byTarget.slice(0, 5))
const targetPeak = computed(() => Math.max(1, ...topTargets.value.map((t) => t.minutes)))

const recent = computed(() => stats.recent.slice(0, 20))

const MODE_LABEL: Record<FocusSession['mode'], string> = {
  countdown: '倒计时',
  countup: '正计时',
  untimed: '不计时'
}

function sessionTime(session: FocusSession): string {
  const d = new Date(session.startAt)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(() => stats.load())
</script>

<template>
  <div class="page stats-page">
    <p v-if="stats.error" class="stats-error">{{ stats.error }}</p>

    <div v-if="!stats.loaded" class="card loading-card">正在读取专注记录…</div>

    <template v-else>
      <div class="card-grid overview-grid">
        <div class="card mini">
          <p class="mini-label">累计专注</p>
          <p class="mini-value">
            {{ (stats.totalMinutes / 60).toFixed(1) }} <small>小时</small>
          </p>
        </div>
        <div class="card mini">
          <p class="mini-label">累计番茄</p>
          <p class="mini-value">{{ stats.totalPomodoros }} <small>个</small></p>
        </div>
        <div class="card mini" title="真正专注过的天数，不是从安装那天算起">
          <p class="mini-label">专注天数</p>
          <p class="mini-value">
            {{ stats.focusDays }} <small>天</small>
            <span v-if="stats.streak > 0" class="streak">连续 {{ stats.streak }} 天</span>
          </p>
        </div>
        <div class="card mini">
          <p class="mini-label">今天</p>
          <p class="mini-value">
            {{ stats.today.focusMinutes }} <small>分钟 · {{ stats.today.pomodoros }} 个番茄</small>
          </p>
        </div>
      </div>

      <section class="card chart-card">
        <div class="card-head">
          <div>
            <h3>专注趋势</h3>
            <p class="card-hint">
              这段时间共 {{ duration(rangeMinutes) }}、{{ rangePomodoros }} 个番茄，学习日均
              {{ duration(avgMinutes) }}。
            </p>
          </div>
          <div class="head-controls">
            <div class="seg">
              <button
                v-for="item in RANGES"
                :key="item.key"
                type="button"
                class="seg-btn"
                :class="{ active: rangeDays === item.key }"
                @click="rangeDays = item.key"
              >
                {{ item.label }}
              </button>
            </div>
            <div class="seg">
              <button
                type="button"
                class="seg-btn"
                :class="{ active: metric === 'minutes' }"
                @click="metric = 'minutes'"
              >
                分钟
              </button>
              <button
                type="button"
                class="seg-btn"
                :class="{ active: metric === 'pomodoros' }"
                @click="metric = 'pomodoros'"
              >
                番茄
              </button>
            </div>
          </div>
        </div>

        <div class="chart" :class="{ dense: rangeDays > 14 }">
          <div v-for="day in bars" :key="day.key" class="bar-col" :title="barTitle(day)">
            <div class="bar-wrap">
              <div class="bar" :style="{ height: (barValue(day) / maxValue) * 100 + '%' }">
                <span v-if="barValue(day) && rangeDays <= 14" class="bar-val">
                  {{ barValue(day) }}
                </span>
              </div>
            </div>
            <span class="bar-label">{{ day.label }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div>
            <h3>坚持记录</h3>
            <p class="card-hint">
              最近半年里学过 {{ heatmap.activeDays }} 天，共 {{ duration(heatmap.totalMinutes) }}。空格是没学的日子。
            </p>
          </div>
          <div class="heat-legend">
            <span>少</span>
            <i v-for="level in [0, 1, 2, 3, 4]" :key="level" :class="`heat-cell level-${level}`" />
            <span>多</span>
          </div>
        </div>

        <div class="heat-wrap">
          <div class="heat-weekdays">
            <span v-for="(label, index) in WEEKDAY_LABELS" :key="index">{{ label }}</span>
          </div>
          <div class="heat-grid">
            <div v-for="(week, index) in heatmap.weeks" :key="index" class="heat-week">
              <span class="heat-month">{{ week.month }}</span>
              <template v-for="(cell, day) in week.days" :key="day">
                <i v-if="cell" :class="`heat-cell level-${cell.level}`" :title="heatTitle(cell)" />
                <i v-else class="heat-cell empty" />
              </template>
            </div>
          </div>
        </div>
      </section>

      <div class="two-col">
        <section class="card">
          <h3>时段分布</h3>
          <p class="card-hint">
            <template v-if="peakHour >= 0">
              你在 {{ peakHour }}:00 前后最能坐得住。
            </template>
            <template v-else>还没有足够的记录来看时段习惯。</template>
          </p>
          <template v-if="hasHourData">
            <div class="hour-chart">
              <div
                v-for="item in hourBars"
                :key="item.hour"
                class="hour-col"
                :title="`${item.hour}:00 · ${duration(item.minutes)}`"
              >
                <div class="hour-bar" :style="{ height: Math.max(2, item.ratio * 100) + '%' }" />
              </div>
            </div>
            <div class="hour-axis">
              <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
            </div>
          </template>
          <EmptyState
            v-else
            icon="clock"
            title="还没有时段数据"
            desc="专注几次之后，这里会画出你一天里最能坐得住的时间。"
          />
        </section>

        <section class="card">
          <h3>时间花在哪</h3>
          <p class="card-hint">按番茄钟绑定的任务累计。</p>
          <ul v-if="topTargets.length" class="target-list">
            <li v-for="item in topTargets" :key="item.name" class="target-item">
              <div class="target-head">
                <strong :title="item.name">{{ item.name }}</strong>
                <span>{{ duration(item.minutes) }}</span>
              </div>
              <div class="target-track">
                <span :style="{ width: (item.minutes / targetPeak) * 100 + '%' }" />
              </div>
            </li>
          </ul>
          <EmptyState
            v-else
            icon="tomato"
            title="还没有专注记录"
            desc="在番茄钟里绑定一个任务开始，这里就会告诉你时间去了哪。"
          />
        </section>
      </div>

      <section class="card">
        <h3>最近的专注</h3>
        <ul v-if="recent.length" class="session-list">
          <li v-for="session in recent" :key="session.id" class="session-item">
            <span class="session-time">{{ sessionTime(session) }}</span>
            <span class="session-name" :title="session.targetName">
              {{ session.targetName || '未绑定任务' }}
            </span>
            <span class="session-mode">{{ MODE_LABEL[session.mode] }}</span>
            <span class="session-min">{{ duration(session.minutes) }}</span>
            <span class="session-flag" :class="{ done: session.completed }">
              <AppIcon :name="session.completed ? 'check' : 'x'" :size="12" />
              {{ session.completed ? '完成' : '中断' }}
            </span>
          </li>
        </ul>
        <EmptyState
          v-else
          icon="clock"
          title="还没有明细"
          desc="从这个版本开始，每一段专注都会留下记录。"
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-error {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--status-danger) 32%, transparent);
  background: color-mix(in srgb, var(--status-danger) 10%, transparent);
  color: var(--status-danger);
  font-size: 12.5px;
}

.loading-card {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.overview-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.mini-label {
  font-size: 12.5px;
  color: var(--text-tertiary);
  font-weight: 600;
}

.mini-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mini-value small {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.streak {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11.5px;
  font-weight: 700;
  vertical-align: middle;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.card-head h3,
.card > h3 {
  font-size: 15px;
  font-weight: 800;
}

.head-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 220px;
  padding-top: 18px;
}

.chart.dense {
  gap: 3px;
}

.bar-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  position: relative;
  width: 62%;
  max-width: 42px;
  min-height: 3px;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, white));
  transition: height 0.4s var(--ease);
}

.bar-val {
  position: absolute;
  top: -19px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.bar-label {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.chart.dense .bar-label {
  writing-mode: vertical-rl;
  font-size: 9.5px;
}

.heat-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.heat-wrap {
  display: flex;
  gap: 6px;
  margin-top: 14px;
  overflow-x: auto;
  padding-bottom: 4px;
}

/* 星期标签要和格子一一对齐，所以行高与格子同宽 */
.heat-weekdays {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  padding-top: 15px;
  font-size: 9.5px;
  color: var(--text-tertiary);
}

.heat-weekdays span {
  height: 12px;
  line-height: 12px;
}

.heat-grid {
  display: flex;
  gap: 3px;
}

.heat-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heat-month {
  height: 12px;
  font-size: 9.5px;
  line-height: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.heat-cell {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--surface-pressed);
}

.heat-cell.empty {
  background: transparent;
}

.heat-cell.level-1 {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}
.heat-cell.level-2 {
  background: color-mix(in srgb, var(--accent) 55%, transparent);
}
.heat-cell.level-3 {
  background: color-mix(in srgb, var(--accent) 78%, transparent);
}
.heat-cell.level-4 {
  background: var(--accent-strong);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.hour-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 120px;
  margin-top: 14px;
}

.hour-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.hour-bar {
  width: 100%;
  border-radius: 3px 3px 1px 1px;
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}

.hour-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
  list-style: none;
  padding: 0;
}

.target-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.target-head strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.target-head span {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.target-track {
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--surface-pressed);
  overflow: hidden;
}

.target-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.session-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  list-style: none;
  padding: 0;
}

.session-item {
  display: grid;
  grid-template-columns: 88px 1fr 58px 84px 62px;
  align-items: center;
  gap: 10px;
  padding: 9px 2px;
  border-bottom: 1px solid var(--separator);
  font-size: 12.5px;
}

.session-item:last-child {
  border-bottom: none;
}

.session-time {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.session-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.session-mode {
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.session-min {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.session-flag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.session-flag.done {
  color: var(--accent-strong);
}

@media (max-width: 720px) {
  .session-item {
    grid-template-columns: 76px 1fr 70px;
  }

  .session-mode,
  .session-flag {
    display: none;
  }
}
</style>
