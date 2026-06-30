import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PomodoroPhase, PomodoroState } from '@/types'

export const usePomodoroStore = defineStore('pomodoro', () => {
  const phase = ref<PomodoroPhase>('idle')
  const remaining = ref(0)
  const total = ref(0)
  const running = ref(false)
  const completed = ref(0)
  let unsub: (() => void) | null = null

  function apply(state: PomodoroState): void {
    phase.value = state.phase
    remaining.value = state.remaining
    total.value = state.total
    running.value = state.running
    completed.value = state.completed
  }

  async function init(): Promise<void> {
    const state = await window.api.pomodoro.getState()
    apply(state as PomodoroState)
    if (!unsub) unsub = window.api.pomodoro.onTick((s) => apply(s as PomodoroState))
  }

  const minutes = computed(() => Math.floor(remaining.value / 60))
  const seconds = computed(() => remaining.value % 60)
  const progress = computed(() => (total.value > 0 ? 1 - remaining.value / total.value : 0))
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

  const start = (): Promise<void> => window.api.pomodoro.start()
  const pause = (): Promise<void> => window.api.pomodoro.pause()
  const toggle = (): Promise<void> => window.api.pomodoro.toggle()
  const reset = (): Promise<void> => window.api.pomodoro.reset()
  const skip = (): Promise<void> => window.api.pomodoro.skip()

  return {
    phase,
    remaining,
    total,
    running,
    completed,
    minutes,
    seconds,
    progress,
    phaseLabel,
    init,
    start,
    pause,
    toggle,
    reset,
    skip
  }
})
