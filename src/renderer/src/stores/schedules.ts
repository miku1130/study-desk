import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { clone, loadStore, saveStore } from '@/lib/persist'
import { uid, type ScheduleItem, type SchedulesData } from '@/types'

const COLORS = ['#4f8fd8', '#5ca786', '#d28a55', '#9a78c8', '#d36b75']

function normalize(raw: Partial<ScheduleItem>, index: number): ScheduleItem {
  const now = Date.now()
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : ''
  const start = typeof raw.start === 'string' ? raw.start : '09:00'
  const end = typeof raw.end === 'string' ? raw.end : '10:00'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${uid()}-${index}`,
    date,
    start,
    end,
    title: typeof raw.title === 'string' ? raw.title : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    color: typeof raw.color === 'string' && raw.color ? raw.color : COLORS[index % COLORS.length],
    allDay: Boolean(raw.allDay),
    createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : now
  }
}

export const useSchedulesStore = defineStore('schedules', () => {
  const items = ref<ScheduleItem[]>([])
  const loaded = ref(false)
  const upcoming = computed(() => [...items.value].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)))

  async function load(): Promise<void> {
    const data = await loadStore<SchedulesData>('schedules')
    items.value = ((data.items ?? []) as Partial<ScheduleItem>[]).map(normalize)
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('schedules', { items: clone(items.value) })
  }

  function upsert(item: ScheduleItem): void {
    const next = normalize({ ...item, updatedAt: Date.now() }, items.value.length)
    const index = items.value.findIndex((entry) => entry.id === next.id)
    if (index >= 0) items.value[index] = next
    else items.value.push(next)
    void save()
  }

  function add(input: Omit<ScheduleItem, 'id' | 'createdAt' | 'updatedAt'>): ScheduleItem {
    const now = Date.now()
    const item = normalize({ ...input, id: uid(), createdAt: now, updatedAt: now }, items.value.length)
    items.value.push(item)
    void save()
    return item
  }

  function remove(id: string): void {
    items.value = items.value.filter((item) => item.id !== id)
    void save()
  }

  function replaceAll(data: SchedulesData): void {
    items.value = (data.items ?? []).map(normalize)
    void save()
  }

  return { items, loaded, upcoming, load, save, add, upsert, remove, replaceAll }
})

