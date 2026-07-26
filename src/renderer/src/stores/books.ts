import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Book, BookNote, BookStatus, BooksData, ReadSession } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

const READING_EXTS = new Set(['pdf', 'epub', 'mobi', 'azw3'])
const OFFICE_EXTS = new Set(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'])

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function extension(name: string): string {
  return name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? ''
}

function inferCategory(name: string): string {
  const ext = extension(name)
  if (READING_EXTS.has(ext)) return '阅读书库'
  if (OFFICE_EXTS.has(ext)) return '课程资料'
  if (IMAGE_EXTS.has(ext)) return '图片资料'
  if (ext === 'md' || ext === 'txt') return '笔记文档'
  return '未分类'
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 12)
}

function normalizeStatus(value: unknown, progress: number, name: string): BookStatus {
  if (value === 'unread' || value === 'reading' || value === 'finished' || value === 'reference') return value
  const ext = extension(name)
  if (progress >= 100) return 'finished'
  if (progress > 0) return 'reading'
  if (OFFICE_EXTS.has(ext) || ext === 'md' || ext === 'txt') return 'reference'
  if (IMAGE_EXTS.has(ext)) return 'reference'
  return 'unread'
}

function normalizeProgress(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizePage(value: unknown): number {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

function normalizeNotes(value: unknown): BookNote[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.text === 'string' && x.text.trim())
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : uid(),
      text: String(x.text).trim(),
      page: normalizePage(x.page),
      createdAt: typeof x.createdAt === 'number' ? x.createdAt : Date.now()
    }))
}

function normalizeReadLog(value: unknown): ReadSession[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => x as Record<string, unknown>)
    .filter((x) => Number(x.minutes) > 0)
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : uid(),
      at: typeof x.at === 'number' ? x.at : Date.now(),
      minutes: Math.max(1, Math.round(Number(x.minutes)))
    }))
    .slice(-200)
}

function normalizeBook(raw: Record<string, unknown>, index: number): Book {
  const path = typeof raw.path === 'string' ? raw.path : ''
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : fileName(path) || `资料 ${index + 1}`
  const totalPages = normalizePage(raw.totalPages)
  const currentPage = Math.min(normalizePage(raw.currentPage), totalPages || Number.MAX_SAFE_INTEGER)
  const progress =
    totalPages > 0 ? Math.round((Math.min(currentPage, totalPages) / totalPages) * 100) : normalizeProgress(raw.progress)
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name,
    path,
    category:
      typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : inferCategory(name),
    addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : Date.now(),
    author: typeof raw.author === 'string' ? raw.author : '',
    status: normalizeStatus(raw.status, progress, name),
    progress,
    rating: Math.max(0, Math.min(5, Number(raw.rating ?? 0) || 0)),
    tags: normalizeTags(raw.tags),
    note: typeof raw.note === 'string' ? raw.note : '',
    lastOpenedAt: typeof raw.lastOpenedAt === 'number' ? raw.lastOpenedAt : 0,
    openCount: typeof raw.openCount === 'number' ? raw.openCount : 0,
    favorite: Boolean(raw.favorite),
    totalPages,
    currentPage: totalPages > 0 ? Math.min(currentPage, totalPages) : currentPage,
    notes: normalizeNotes(raw.notes),
    readLog: normalizeReadLog(raw.readLog)
  }
}

function makeBook(path: string): Book {
  const name = fileName(path)
  return normalizeBook(
    {
      id: uid(),
      name,
      path,
      category: inferCategory(name),
      addedAt: Date.now()
    },
    0
  )
}

export const useBooksStore = defineStore('books', () => {
  const items = ref<Book[]>([])
  const loaded = ref(false)
  /** path 丢失（被移动/删除）的书 id 集合，仅运行期状态不持久化 */
  const missingIds = ref<Set<string>>(new Set())
  /** 正在计时阅读的书 id 与开始时间 */
  const readingId = ref('')
  const readingStartAt = ref(0)

  const categories = computed(() => {
    const set = new Set<string>()
    for (const b of items.value) set.add(b.category || '未分类')
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  const tags = computed(() => {
    const set = new Set<string>()
    for (const b of items.value) for (const t of b.tags) set.add(t)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  const stats = computed(() => {
    const total = items.value.length
    const reading = items.value.filter((b) => b.status === 'reading').length
    const finished = items.value.filter((b) => b.status === 'finished').length
    const reference = items.value.filter((b) => b.status === 'reference').length
    const progress = total
      ? Math.round(items.value.reduce((sum, b) => sum + b.progress, 0) / total)
      : 0
    const recentlyOpened = items.value.filter((b) => b.lastOpenedAt > 0).length
    const favorite = items.value.filter((b) => b.favorite).length
    const noteCount = items.value.reduce((sum, b) => sum + b.notes.length, 0)
    const readMinutes = items.value.reduce(
      (sum, b) => sum + b.readLog.reduce((s, r) => s + r.minutes, 0),
      0
    )
    return { total, reading, finished, reference, progress, recentlyOpened, favorite, noteCount, readMinutes }
  })

  /** 最近在读的一本（用于「继续阅读」） */
  const continueReading = computed(() => {
    const list = items.value
      .filter((b) => b.status === 'reading' || (b.lastOpenedAt > 0 && b.status !== 'finished'))
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    return list[0] ?? null
  })

  const readingBook = computed(() => items.value.find((b) => b.id === readingId.value) ?? null)

  async function load(): Promise<void> {
    const data = await loadStore<BooksData>('books')
    const raw = (data.items ?? []) as unknown as Array<Record<string, unknown>>
    const seen = new Set<string>()
    items.value = raw
      .map((b, i) => normalizeBook(b, i))
      .filter((b) => {
        const key = b.path || b.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    loaded.value = true
    void checkMissing()
  }

  async function save(): Promise<void> {
    await saveStore('books', { items: items.value })
  }

  async function checkMissing(): Promise<void> {
    const next = new Set<string>()
    await Promise.all(
      items.value.map(async (b) => {
        if (!b.path) return
        const ok = await window.api.fs.exists(b.path).catch(() => true)
        if (!ok) next.add(b.id)
      })
    )
    missingIds.value = next
  }

  async function addBooks(): Promise<number> {
    const paths = await window.api.dialog.openFiles([
      {
        name: '文档 / 电子书 / 图片',
        extensions: ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'md', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
      }
    ])
    const existing = new Set(items.value.map((b) => b.path))
    const next = paths.filter((p) => !existing.has(p)).map(makeBook)
    if (!next.length) return 0
    items.value.unshift(...next)
    void save()
    return next.length
  }

  /** 文件被移动后重新选择路径 */
  async function relocate(id: string): Promise<boolean> {
    const b = items.value.find((x) => x.id === id)
    if (!b) return false
    const p = await window.api.dialog.openFile([
      {
        name: '文档 / 电子书 / 图片',
        extensions: ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'md', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
      }
    ])
    if (!p) return false
    b.path = p
    missingIds.value.delete(b.id)
    missingIds.value = new Set(missingIds.value)
    void save()
    return true
  }

  function update(book: Book): void {
    const index = items.value.findIndex((x) => x.id === book.id)
    if (index < 0) return
    items.value[index] = normalizeBook(
      {
        ...book,
        name: book.name.trim() || items.value[index].name,
        category: book.category.trim() || '未分类',
        author: book.author.trim(),
        status: book.status,
        tags: book.tags.map((x) => x.trim()).filter(Boolean).slice(0, 12)
      } as unknown as Record<string, unknown>,
      index
    )
    void save()
  }

  function setCategory(id: string, category: string): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.category = category.trim() || '未分类'
    void save()
  }

  function rename(id: string, name: string): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.name = name.trim() || b.name
    void save()
  }

  function syncStatusFromProgress(b: Book): void {
    if (b.progress >= 100) b.status = 'finished'
    else if (b.progress > 0 && (b.status === 'unread' || b.status === 'finished')) b.status = 'reading'
  }

  function setProgress(id: string, progress: number): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.progress = normalizeProgress(progress)
    if (b.totalPages > 0) b.currentPage = Math.round((b.progress / 100) * b.totalPages)
    syncStatusFromProgress(b)
    void save()
  }

  /** 记录读到第几页；设置了总页数时进度自动换算 */
  function setPages(id: string, currentPage: number, totalPages: number): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.totalPages = normalizePage(totalPages)
    b.currentPage = b.totalPages > 0 ? Math.min(normalizePage(currentPage), b.totalPages) : normalizePage(currentPage)
    if (b.totalPages > 0) {
      b.progress = Math.round((b.currentPage / b.totalPages) * 100)
      syncStatusFromProgress(b)
    }
    void save()
  }

  function toggleFavorite(id: string): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.favorite = !b.favorite
    void save()
  }

  function addNote(id: string, text: string, page = 0): void {
    const b = items.value.find((x) => x.id === id)
    const t = text.trim()
    if (!b || !t) return
    b.notes.unshift({ id: uid(), text: t, page: normalizePage(page), createdAt: Date.now() })
    void save()
  }

  function updateNote(id: string, noteId: string, text: string, page: number): void {
    const b = items.value.find((x) => x.id === id)
    const n = b?.notes.find((x) => x.id === noteId)
    if (!b || !n || !text.trim()) return
    n.text = text.trim()
    n.page = normalizePage(page)
    void save()
  }

  function removeNote(id: string, noteId: string): void {
    const b = items.value.find((x) => x.id === id)
    if (!b) return
    b.notes = b.notes.filter((x) => x.id !== noteId)
    void save()
  }

  /** 开始阅读计时；对同一本再次调用则结束并落账，返回本次分钟数 */
  function toggleReadingTimer(id: string): { started: boolean; minutes: number } {
    if (readingId.value === id) {
      const minutes = Math.max(1, Math.round((Date.now() - readingStartAt.value) / 60000))
      logReading(id, minutes)
      readingId.value = ''
      readingStartAt.value = 0
      return { started: false, minutes }
    }
    readingId.value = id
    readingStartAt.value = Date.now()
    return { started: true, minutes: 0 }
  }

  function logReading(id: string, minutes: number): void {
    const b = items.value.find((x) => x.id === id)
    const m = Math.max(1, Math.round(minutes))
    if (!b) return
    b.readLog.push({ id: uid(), at: Date.now(), minutes: m })
    if (b.readLog.length > 200) b.readLog = b.readLog.slice(-200)
    b.lastOpenedAt = Date.now()
    if (b.status === 'unread') b.status = 'reading'
    void save()
  }

  function remove(id: string): void {
    items.value = items.value.filter((x) => x.id !== id)
    if (readingId.value === id) {
      readingId.value = ''
      readingStartAt.value = 0
    }
    void save()
  }

  function open(target: Book | string): void {
    if (typeof target === 'string') {
      void window.api.shell.openPath(target)
      return
    }
    const b = items.value.find((x) => x.id === target.id)
    if (b) {
      b.lastOpenedAt = Date.now()
      b.openCount += 1
      if (b.status === 'unread') b.status = 'reading'
      void save()
    }
    void window.api.shell.openPath(target.path)
  }

  return {
    items,
    loaded,
    missingIds,
    readingId,
    readingStartAt,
    readingBook,
    categories,
    tags,
    stats,
    continueReading,
    load,
    save,
    checkMissing,
    addBooks,
    relocate,
    update,
    setCategory,
    rename,
    setProgress,
    setPages,
    toggleFavorite,
    addNote,
    updateNote,
    removeNote,
    toggleReadingTimer,
    logReading,
    remove,
    open
  }
})
