<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStatsStore } from '@/stores/stats'

const stats = useStatsStore()

function fmt(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

interface DayBar {
  key: string
  label: string
  pomodoros: number
  focusMinutes: number
}

const last7 = computed<DayBar[]>(() => {
  const arr: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = fmt(d)
    const s = stats.days[key] ?? { pomodoros: 0, focusMinutes: 0 }
    arr.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, ...s })
  }
  return arr
})

const maxP = computed(() => Math.max(1, ...last7.value.map((d) => d.pomodoros)))
const totalP = computed(() => Object.values(stats.days).reduce((s, d) => s + d.pomodoros, 0))
const totalHours = computed(
  () => Object.values(stats.days).reduce((s, d) => s + d.focusMinutes, 0) / 60
)
const week7P = computed(() => last7.value.reduce((s, d) => s + d.pomodoros, 0))

onMounted(() => stats.load())
</script>

<template>
  <div class="page">
    <div class="card-grid">
      <div class="card mini">
        <p class="mini-label">累计番茄</p>
        <p class="mini-value">{{ totalP }} <small>个</small></p>
      </div>
      <div class="card mini">
        <p class="mini-label">累计专注</p>
        <p class="mini-value">{{ totalHours.toFixed(1) }} <small>小时</small></p>
      </div>
      <div class="card mini">
        <p class="mini-label">近 7 天</p>
        <p class="mini-value">{{ week7P }} <small>个</small></p>
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 20px">近 7 天专注趋势</h3>
    <div class="card">
      <div class="chart">
        <div v-for="d in last7" :key="d.key" class="bar-col">
          <div class="bar-wrap">
            <div class="bar" :style="{ height: (d.pomodoros / maxP) * 100 + '%' }">
              <span v-if="d.pomodoros" class="bar-val">{{ d.pomodoros }}</span>
            </div>
          </div>
          <span class="bar-label">{{ d.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-label {
  font-size: 12.5px;
  color: var(--text-tertiary);
  font-weight: 600;
}
.mini-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 8px;
}
.mini-value small {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}
.chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 220px;
  padding-top: 10px;
}
.bar-col {
  flex: 1;
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
  width: 60%;
  max-width: 42px;
  min-height: 4px;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, white));
  position: relative;
  transition: height 0.4s var(--ease);
}
.bar-val {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}
.bar-label {
  font-size: 11.5px;
  color: var(--text-tertiary);
}
</style>
