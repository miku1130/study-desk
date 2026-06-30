import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'
import { makeTrayIcon } from '@/lib/trayIcon'

/** 主窗口专用：铃声 / 番茄完成音效、统计刷新、托盘图标。 */
export function useGlobalEffects(): void {
  const settings = useSettingsStore()
  const stats = useStatsStore()
  const cleanups: Array<() => void> = []

  function beep(): void {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.05
      osc.start()
      window.setTimeout(() => {
        osc.stop()
        void ctx.close()
      }, 350)
    } catch {
      /* 忽略音频上下文异常 */
    }
  }

  function playSound(path: string, volume: number): void {
    if (!path) {
      beep()
      return
    }
    const audio = new Audio(window.api.media.url(path))
    audio.volume = volume
    audio.play().catch(() => beep())
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
        if (type === 'workComplete') playSound(settings.s.pomodoro.sound, settings.s.pomodoro.volume)
        void stats.load()
      })
    )
    updateTray()
    watch(() => settings.s.accent, updateTray)
  })

  onBeforeUnmount(() => cleanups.forEach((c) => c()))
}
