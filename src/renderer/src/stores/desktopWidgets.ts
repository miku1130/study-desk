import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { clone, loadStore, saveStore } from '@/lib/persist'
import {
  uid,
  type DesktopWidgetConfig,
  type DesktopWidgetKind,
  type DesktopWidgetsData
} from '@/types'

const DEFAULTS: Omit<DesktopWidgetConfig, 'id' | 'kind' | 'sourceId' | 'title'> = {
  enabled: true,
  launchOnStartup: false,
  locked: false,
  alwaysOnTop: false,
  size: 'medium',
  background: '',
  backgroundColor: '#24312c',
  overlayOpacity: 0.42,
  surfaceOpacity: 0.94,
  font: 'system',
  fontColor: '#ffffff',
  accentColor: '#7ed4b5',
  memoDisplayMode: 'list',
  memoImageAttachmentId: ''
}

function normalize(raw: Partial<DesktopWidgetConfig>, index: number): DesktopWidgetConfig {
  const kind: DesktopWidgetKind =
    raw.kind === 'timetable' || raw.kind === 'memo' ? raw.kind : 'countdown'
  const size = raw.size === 'small' || raw.size === 'large' ? raw.size : 'medium'
  const font =
    raw.font === 'serif' ||
    raw.font === 'rounded' ||
    raw.font === 'mono' ||
    raw.font === 'handwriting' ||
    raw.font === 'literary' ||
    raw.font === 'display'
      ? raw.font
      : 'system'
  const clamp = (value: unknown, fallback: number): number => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback
  }
  return {
    ...DEFAULTS,
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${uid()}-${index}`,
    kind,
    sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    size,
    font,
    memoDisplayMode: raw.memoDisplayMode === 'image' ? 'image' : 'list',
    memoImageAttachmentId:
      typeof raw.memoImageAttachmentId === 'string' ? raw.memoImageAttachmentId : '',
    overlayOpacity: clamp(raw.overlayOpacity, DEFAULTS.overlayOpacity),
    surfaceOpacity: clamp(raw.surfaceOpacity, DEFAULTS.surfaceOpacity),
    enabled: raw.enabled !== false,
    launchOnStartup: Boolean(raw.launchOnStartup),
    locked: Boolean(raw.locked),
    alwaysOnTop: false
  }
}

export const useDesktopWidgetsStore = defineStore('desktopWidgets', () => {
  const items = ref<DesktopWidgetConfig[]>([])
  const loaded = ref(false)
  const active = computed(() => items.value.filter((item) => item.enabled))

  async function load(): Promise<void> {
    const data = await loadStore<DesktopWidgetsData>('desktopWidgets')
    items.value = ((data.items ?? []) as Partial<DesktopWidgetConfig>[]).map(normalize)
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('desktopWidgets', { items: items.value })
  }

  function add(kind: DesktopWidgetKind, sourceId = '', title = ''): DesktopWidgetConfig {
    const item = normalize({ id: uid(), kind, sourceId, title }, items.value.length)
    if (kind === 'countdown') item.backgroundColor = '#2f3b36'
    if (kind === 'timetable') {
      item.backgroundColor = '#25343b'
      item.accentColor = '#77bdd4'
      item.size = 'large'
    }
    if (kind === 'memo') {
      item.backgroundColor = '#3a3428'
      item.accentColor = '#e4bd68'
    }
    items.value.push(item)
    void save()
    return item
  }

  function update(patch: DesktopWidgetConfig): void {
    const index = items.value.findIndex((item) => item.id === patch.id)
    if (index < 0) return
    items.value[index] = normalize(clone(patch), index)
    void save()
  }

  function remove(id: string): void {
    items.value = items.value.filter((item) => item.id !== id)
    void save()
  }

  function setEnabled(id: string, enabled: boolean): void {
    const item = items.value.find((entry) => entry.id === id)
    if (!item) return
    item.enabled = enabled
    void save()
  }

  return { items, active, loaded, load, save, add, update, remove, setEnabled }
})
