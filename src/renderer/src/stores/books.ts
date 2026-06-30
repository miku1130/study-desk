import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Book, BooksData } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

export const useBooksStore = defineStore('books', () => {
  const items = ref<Book[]>([])
  const loaded = ref(false)

  const categories = computed(() => {
    const set = new Set<string>()
    for (const b of items.value) set.add(b.category || '未分类')
    return Array.from(set)
  })

  async function load(): Promise<void> {
    const data = await loadStore<BooksData>('books')
    items.value = data.items ?? []
    loaded.value = true
  }

  async function save(): Promise<void> {
    await saveStore('books', { items: items.value })
  }

  async function addBooks(): Promise<void> {
    const paths = await window.api.dialog.openFiles([
      {
        name: '文档 / 电子书',
        extensions: ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'md']
      }
    ])
    for (const p of paths) {
      const name = p.split(/[\\/]/).pop() ?? p
      items.value.push({ id: uid(), name, path: p, category: '未分类', addedAt: Date.now() })
    }
    if (paths.length) void save()
  }

  function setCategory(id: string, category: string): void {
    const b = items.value.find((x) => x.id === id)
    if (b) {
      b.category = category.trim() || '未分类'
      void save()
    }
  }

  function rename(id: string, name: string): void {
    const b = items.value.find((x) => x.id === id)
    if (b) {
      b.name = name.trim() || b.name
      void save()
    }
  }

  function remove(id: string): void {
    items.value = items.value.filter((x) => x.id !== id)
    void save()
  }

  function open(path: string): void {
    void window.api.shell.openPath(path)
  }

  return { items, loaded, categories, load, addBooks, setCategory, rename, remove, open }
})
