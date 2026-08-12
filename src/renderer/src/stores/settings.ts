import { defineStore } from 'pinia'
import { ref } from 'vue'
import { defaultSettings, type AppSettings } from '@/types'
import { clone, loadStore, saveStore } from '@/lib/persist'

export const useSettingsStore = defineStore('settings', () => {
  const s = ref<AppSettings>(clone(defaultSettings))
  const loaded = ref(false)

  function applyTheme(): void {
    const root = document.documentElement
    const mode =
      s.value.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : s.value.theme
    root.setAttribute('data-theme', mode)
    root.style.setProperty('--accent', s.value.accent)
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${s.value.accent} 14%, transparent)`)
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
    }
    loaded.value = true
    applyTheme()
  }

  async function save(): Promise<void> {
    await saveStore('settings', s.value)
    applyTheme()
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (s.value.theme === 'system') applyTheme()
  })

  return { s, loaded, load, save, applyTheme }
})
