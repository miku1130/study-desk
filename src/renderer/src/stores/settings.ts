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
  }

  async function load(): Promise<void> {
    const data = await loadStore<Partial<AppSettings>>('settings')
    s.value = { ...clone(defaultSettings), ...data }
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
