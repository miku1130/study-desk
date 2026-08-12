import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PomodoroMode, PomodoroPhase, PomodoroState } from '@/types'

export interface PomodoroStartOptions {
  mode?: PomodoroMode
  minutes?: number
  targetId?: string
  targetName?: string
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const phase = ref<PomodoroPhase>('idle')
  const mode = ref<PomodoroMode>('countdown')
  const remaining = ref(0)
  const elapsed = ref(0)
  const total = ref(0)
  const running = ref(false)
  const completed = ref(0)
  const targetId = ref('')
  const targetName = ref('')
  let unsub: (() => void) | null = null

  // 逐字段赋值而不是整体替换：ref 会做值比较，25 分钟里只有 remaining 在变，
  // 依赖 running / phase 的组件一次都不会重渲染
  function apply(state: PomodoroState): void {
    phase.value = state.phase
    mode.value = state.mode ?? 'countdown'
    remaining.value = state.remaining
    elapsed.value = state.elapsed ?? 0
    total.value = state.total
    running.value = state.running
    completed.value = state.completed
    targetId.value = state.targetId ?? ''
    targetName.value = state.targetName ?? ''
  }

  async function init(): Promise<void> {
    const state = await window.api.pomodoro.getState()
    apply(state as PomodoroState)
    if (!unsub) unsub = window.api.pomodoro.onTick((s) => apply(s as PomodoroState))
  }

  /** 正向计时与不计时没有剩余量，显示的是已过去的时间 */
  const displaySeconds = computed(() =>
    mode.value === 'countdown' ? remaining.value : elapsed.value
  )
  const minutes = computed(() => Math.floor(displaySeconds.value / 60))
  const seconds = computed(() => displaySeconds.value % 60)
  const progress = computed(() => (total.value > 0 ? 1 - remaining.value / total.value : 0))
  /** 没有终点的模式只能由用户手动结束 */
  const needsManualFinish = computed(() => mode.value !== 'countdown' && phase.value === 'work')
  const phaseLabel = computed(() => {
    switch (phase.value) {
      case 'work':
        return '专注中'
      case 'short':
        return '短休息'
      case 'long':
        return '长休息'
      default:
        return '准备开始'
    }
  })

  const start = (options?: PomodoroStartOptions): Promise<void> =>
    window.api.pomodoro.start(options)
  const pause = (): Promise<void> => window.api.pomodoro.pause()
  const toggle = (): Promise<void> => window.api.pomodoro.toggle()
  const reset = (): Promise<void> => window.api.pomodoro.reset()
  const skip = (): Promise<void> => window.api.pomodoro.skip()
  const finish = (): Promise<void> => window.api.pomodoro.finish()

  return {
    phase,
    mode,
    remaining,
    elapsed,
    total,
    running,
    completed,
    targetId,
    targetName,
    minutes,
    seconds,
    displaySeconds,
    progress,
    phaseLabel,
    needsManualFinish,
    init,
    start,
    pause,
    toggle,
    reset,
    skip,
    finish
  }
})
