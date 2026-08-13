import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { defaultSettings, type AppSettings } from '@/types'
import { activeAccentOf, resolveThemeMode, type ResolvedTheme } from '@/lib/appearance'
import { clone, loadStore, saveStore } from '@/lib/persist'

export const useSettingsStore = defineStore('settings', () => {
  const s = ref<AppSettings>(clone(defaultSettings))
  const loaded = ref(false)
  /** 实际生效的主题：theme 为 system 时跟随系统 */
  const resolvedTheme = ref<ResolvedTheme>('light')

  /** 当前主题下真正在用的强调色 */
  const activeAccent = computed(() => activeAccentOf(s.value, resolvedTheme.value))

  function applyTheme(): void {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    resolvedTheme.value = resolveThemeMode(s.value.theme, prefersDark)
    root.setAttribute('data-theme', resolvedTheme.value)
    root.style.setProperty('--accent', activeAccent.value)
    root.style.setProperty(
      '--accent-soft',
      `color-mix(in srgb, ${activeAccent.value} 14%, transparent)`
    )
  }

  /**
   * 老配置文件里没有后来新增的嵌套字段，浅合并会让新选项变成 undefined，
   * 所以每一层对象都要单独补默认值。
   */
  function withDefaults(data: Partial<AppSettings>): AppSettings {
    const base = clone(defaultSettings)
    return {
      ...base,
      ...data,
      // 老配置只有一个 accent：深色沿用它，否则用户挑的颜色会在切主题时凭空消失
      accentDark: data.accentDark || data.accent || base.accentDark,
      bell: { ...base.bell, ...data.bell },
      pomodoro: { ...base.pomodoro, ...data.pomodoro },
      water: { ...base.water, ...data.water },
      health: { ...base.health, ...data.health },
      hotkeys: { ...base.hotkeys, ...data.hotkeys },
      petWidget: { ...base.petWidget, ...data.petWidget }
    }
  }

  async function load(): Promise<void> {
    const data = await loadStore<Partial<AppSettings>>('settings')
    s.value = withDefaults(data)
    // 仅迁移历史默认色；用户选择的其它自定义强调色保持不变。
    if (data.accent === '#0a84ff' || data.accent === '#2f6b63') {
      s.value.accent = defaultSettings.accent
      if (!data.accentDark) s.value.accentDark = defaultSettings.accentDark
    }
    loaded.value = true
    applyTheme()
  }

  async function save(): Promise<void> {
    await saveStore('settings', s.value)
    applyTheme()
  }

  /** 改的是当前主题那一份，另一套保持原样 */
  function setActiveAccent(color: string): void {
    if (resolvedTheme.value === 'dark') s.value.accentDark = color
    else s.value.accent = color
    void save()
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (s.value.theme === 'system') applyTheme()
  })

  return { s, loaded, resolvedTheme, activeAccent, load, save, applyTheme, setActiveAccent }
})
