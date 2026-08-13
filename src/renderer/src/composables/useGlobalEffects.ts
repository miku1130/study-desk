import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'
import { useGardenStore } from '@/stores/garden'
import { useTodoStore } from '@/stores/todos'
import { useUiStore } from '@/stores/ui'
import { usePetCompanionStore, PET_GIFTS, PET_TRASH } from '@/stores/petCompanion'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import { TREE_SPECIES } from '@/types'
import { makeTrayIcon } from '@/lib/trayIcon'
import { playChime } from '@/lib/audio'
import { ambience, shouldPlayAmbience } from '@/lib/noise'

/** 主窗口专用：铃声 / 番茄完成音效、统计刷新、托盘图标、专注森林奖励、任务番茄累计。 */
export function useGlobalEffects(): void {
  const settings = useSettingsStore()
  const stats = useStatsStore()
  const garden = useGardenStore()
  const todos = useTodoStore()
  const ui = useUiStore()
  const pet = usePetCompanionStore()
  const pomodoro = usePomodoroStore()
  const timetableStatus = useTimetableStatus()
  const cleanups: Array<() => void> = []

  function playSound(path: string, volume: number): void {
    if (path && path.startsWith('chime:')) {
      playChime(path.slice('chime:'.length), volume)
      return
    }
    if (!path) {
      playChime('ding', volume)
      return
    }
    const audio = new Audio(window.api.media.url(path))
    audio.volume = volume
    audio.play().catch(() => playChime('ding', volume))
  }

  function updateTray(): void {
    const url = makeTrayIcon(settings.activeAccent || '#0a84ff')
    if (url) void window.api.tray.setIcon(url)
  }

  onMounted(() => {
    cleanups.push(
      window.api.bell.onRing((kind) => {
        const b = settings.s.bell
        playSound(kind === 'on' ? b.onSound : b.offSound, b.volume)
      })
    )
    cleanups.push(
      window.api.pomodoro.onEvent((type) => {
        if (type === 'workComplete') {
          playSound(settings.s.pomodoro.sound, settings.s.pomodoro.volume)
          garden.reward(settings.s.pomodoro.workMin)
          todos.addPomodoroToActive()
          const petReward = pet.completeSession('pomodoro')
          const r = garden.lastReward
          const gift = PET_GIFTS.find((item) => item.id === petReward.keepsake.itemId)
          if (r) {
            const sp = TREE_SPECIES.find((s) => s.id === r.species)
            ui.success(
              r.golden
                ? `幸运！种下金色${sp?.name ?? '树'}；${pet.selectedCat.name}留下${gift?.name ?? '小礼物'}`
                : `${pet.selectedCat.name}留下${gift?.name ?? '小礼物'}，伴学金币 +${petReward.coins}`
            )
          }
        } else if (type === 'workAbandoned') {
          const keepsake = pet.abandonSession('pomodoro')
          const item = PET_TRASH.find((entry) => entry.id === keepsake.itemId)
          ui.info(`${pet.selectedCat.name}把${item?.name ?? '一点小垃圾'}放在桌边，下一次再一起写完`)
        }
        void stats.load()
      })
    )
    updateTray()
    watch(() => settings.activeAccent, updateTray)

    watch(
      [
        () => settings.loaded,
        () => settings.s.petWidget.enabled,
        () => settings.s.petWidget.duringPomodoro,
        () => settings.s.petWidget.duringClass,
        () => settings.s.pomodoro.lockscreen,
        () => pomodoro.phase,
        () => pomodoro.running,
        timetableStatus.current
      ],
      ([ready, enabled, duringPomodoro, duringClass, lockscreen, phase, running, lesson]) => {
        if (!ready) return
        const showForTimer = Boolean(duringPomodoro && phase === 'work' && running && !lockscreen)
        const showForClass = Boolean(duringClass && lesson)
        void window.api.petWidget.sync(Boolean(enabled && (showForTimer || showForClass)))
      },
      { immediate: true }
    )

    // 环境音跟着番茄钟走，而不是跟着页面：切到别的页面继续专注，声音不该断
    watch(
      [
        () => settings.loaded,
        () => settings.s.pomodoro.noise.scene,
        () => settings.s.pomodoro.noise.volume,
        () => settings.s.pomodoro.noise.duringBreak,
        () => pomodoro.phase,
        () => pomodoro.running
      ],
      ([ready]) => {
        if (!ready) return
        const config = settings.s.pomodoro.noise
        if (shouldPlayAmbience(config, { phase: pomodoro.phase, running: pomodoro.running })) {
          ambience.play(config.scene, config.volume)
        } else {
          ambience.stop()
        }
      },
      { immediate: true }
    )

    watch(
      [timetableStatus.current, () => pet.loaded],
      ([lesson, ready]) => {
        if (!ready) return
        const settled = pet.settleActiveClass()
        if (settled) {
          const gift = PET_GIFTS.find((item) => item.id === settled.keepsake.itemId)
          ui.success(`下课啦，${pet.selectedCat.name}留下${gift?.name ?? '小礼物'}，伴学金币 +${settled.coins}`)
        }
        if (!lesson) return
        const endAt = new Date(timetableStatus.now.value)
        const [hours, minutes] = lesson.period.end.split(':').map(Number)
        endAt.setHours(hours, minutes, 0, 0)
        const day = endAt.toISOString().slice(0, 10)
        pet.beginClass({
          id: `${day}:${lesson.id}:${lesson.period.end}`,
          name: lesson.name,
          startedAt: Date.now(),
          endAt: endAt.getTime()
        })
      },
      { immediate: true }
    )
  })

  onBeforeUnmount(() => cleanups.forEach((c) => c()))
}
