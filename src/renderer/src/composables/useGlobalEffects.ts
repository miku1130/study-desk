import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'
import { useGardenStore } from '@/stores/garden'
import { makeTrayIcon } from '@/lib/trayIcon'
import { playChime } from '@/lib/audio'

/** 主窗口专用：铃声 / 番茄完成音效、统计刷新、托盘图标、专注森林奖励。 */
export function useGlobalEffects(): void {
  const settings = useSettingsStore()
  const stats = useStatsStore()
  const garden = useGardenStore()
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
    const url = makeTrayIcon(settings.s.accent || '#0a84ff')
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
          garden.reward()
        }
        void stats.load()
      })
    )
    updateTray()
    watch(() => settings.s.accent, updateTray)
  })

  onBeforeUnmount(() => cleanups.forEach((c) => c()))
}
