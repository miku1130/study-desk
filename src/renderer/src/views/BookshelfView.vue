<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import BookCover from '@/components/BookCover.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useBooksStore } from '@/stores/books'
import { useUiStore } from '@/stores/ui'
import type { Book, BookStatus } from '@/types'

const books = useBooksStore()
const ui = useUiStore()

type FilterStatus = 'all' | 'favorite' | BookStatus

const category = ref('全部')
const status = ref<FilterStatus>('all')
const query = ref('')
const sort = ref<'recent' | 'progress' | 'name' | 'rating'>('recent')
const selectedId = ref('')

const statusTabs: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '收藏' },
  { key: 'reading', label: '在读' },
  { key: 'finished', label: '读完' },
  { key: 'reference', label: '资料' },
  { key: 'unread', label: '未读' }
]

const statusLabel: Record<BookStatus, string> = {
  unread: '未读',
  reading: '在读',
  finished: '读完',
  reference: '资料'
}

const statusClass: Record<BookStatus, string> = {
  unread: 'is-muted',
  reading: 'is-blue',
  finished: 'is-green',
  reference: 'is-violet'
}

const cats = computed(() => ['全部', ...books.categories])

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const list = books.items.filter((book) => {
    const haystack = [book.name, book.author, book.category, book.note, ...book.tags, ...book.notes.map((n) => n.text)]
      .join(' ')
      .toLowerCase()
    const statusOk =
      status.value === 'all' ||
      (status.value === 'favorite' ? book.favorite : book.status === status.value)
    return (
      (category.value === '全部' || book.category === category.value) &&
      statusOk &&
      (!keyword || haystack.includes(keyword))
    )
  })
  const sorted = list.slice()
  if (sort.value === 'progress') sorted.sort((a, b) => b.progress - a.progress)
  else if (sort.value === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  else if (sort.value === 'rating') sorted.sort((a, b) => b.rating - a.rating)
  else sorted.sort((a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt))
  return sorted
})

const selected = computed(() => {
  if (!selectedId.value) return filtered.value[0]
  return books.items.find((book) => book.id === selectedId.value) ?? filtered.value[0]
})

watch(filtered, (list) => {
  if (!list.length) selectedId.value = ''
  else if (!list.some((book) => book.id === selectedId.value)) selectedId.value = list[0].id
})

function formatDate(ts: number): string {
  if (!ts) return '尚未打开'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isMissing(book: Book): boolean {
  return books.missingIds.has(book.id)
}

function openBook(book: Book): void {
  selectedId.value = book.id
  if (isMissing(book)) {
    ui.error('文件不存在，可能已被移动或删除，请点「重新定位」')
    return
  }
  books.open(book)
}

async function relocateBook(book: Book): Promise<void> {
  const ok = await books.relocate(book.id)
  if (ok) ui.success('已更新文件位置')
}

async function addBooks(): Promise<void> {
  const n = await books.addBooks()
  if (n > 0) ui.success(`已添加 ${n} 份资料`)
}

/* ---- 阅读计时 ---- */
const nowTick = ref(Date.now())
let tickTimer: number | undefined

function ensureTick(): void {
  if (tickTimer) return
  tickTimer = window.setInterval(() => (nowTick.value = Date.now()), 1000)
}
onUnmounted(() => {
  if (tickTimer) window.clearInterval(tickTimer)
})

const readingElapsed = computed(() => {
  if (!books.readingId) return ''
  const sec = Math.max(0, Math.floor((nowTick.value - books.readingStartAt) / 1000))
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
})

function toggleTimer(book: Book): void {
  const r = books.toggleReadingTimer(book.id)
  if (r.started) {
    ensureTick()
    ui.info(`开始阅读「${book.name.slice(0, 18)}」，再次点击结束计时`)
  } else {
    ui.success(`本次阅读 ${r.minutes} 分钟，已记入阅读记录`)
  }
}

/* ---- 读书笔记 ---- */
const noteText = ref('')
const notePage = ref<number | null>(null)

function addNote(): void {
  if (!selected.value || !noteText.value.trim()) return
  books.addNote(selected.value.id, noteText.value, notePage.value ?? 0)
  noteText.value = ''
  notePage.value = null
  ui.success('笔记已保存')
}

async function removeNote(noteId: string): Promise<void> {
  if (!selected.value) return
  const ok = await ui.confirm({
    title: '删除这条笔记？',
    message: '删除后无法恢复。',
    confirmText: '删除',
    danger: true
  })
  if (ok) books.removeNote(selected.value.id, noteId)
}

/* ---- 页码 ---- */
const pageDraft = reactive({ current: 0, total: 0 })

watch(
  selected,
  (b) => {
    pageDraft.current = b?.currentPage ?? 0
    pageDraft.total = b?.totalPages ?? 0
  },
  { immediate: true }
)

function savePages(): void {
  if (!selected.value) return
  books.setPages(selected.value.id, pageDraft.current, pageDraft.total)
  ui.success('页码进度已更新')
}

/* ---- 阅读记录聚合 ---- */
const recentSessions = computed(() => {
  if (!selected.value) return []
  return [...selected.value.readLog].sort((a, b) => b.at - a.at).slice(0, 6)
})

const totalReadMinutes = computed(() =>
  selected.value ? selected.value.readLog.reduce((s, r) => s + r.minutes, 0) : 0
)

/* ---- 编辑弹窗 ---- */
const showEdit = ref(false)
const editing = reactive<Book>({
  id: '',
  name: '',
  path: '',
  category: '未分类',
  addedAt: 0,
  author: '',
  status: 'unread',
  progress: 0,
  rating: 0,
  tags: [],
  note: '',
  lastOpenedAt: 0,
  openCount: 0,
  favorite: false,
  totalPages: 0,
  currentPage: 0,
  notes: [],
  readLog: []
})
const tagText = ref('')

function openEdit(book: Book): void {
  Object.assign(editing, {
    ...book,
    tags: [...book.tags],
    notes: book.notes.map((n) => ({ ...n })),
    readLog: book.readLog.map((r) => ({ ...r }))
  })
  tagText.value = book.tags.join('，')
  showEdit.value = true
}

function saveEdit(): void {
  editing.tags = tagText.value
    .split(/[，,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
  books.update({ ...editing, tags: [...editing.tags] })
  selectedId.value = editing.id
  showEdit.value = false
  ui.success('资料信息已保存')
}

async function delEdit(): Promise<void> {
  const ok = await ui.confirm({
    title: '从书架移除？',
    message: `「${editing.name.slice(0, 24)}」的进度、笔记和阅读记录都会一并删除（不会删除源文件）。`,
    confirmText: '移除',
    danger: true
  })
  if (!ok) return
  books.remove(editing.id)
  selectedId.value = ''
  showEdit.value = false
  ui.info('已从书架移除')
}

function setProgress(book: Book, event: Event): void {
  books.setProgress(book.id, (event.target as HTMLInputElement).valueAsNumber)
}
</script>

<template>
  <div class="page library-page">
    <section class="library-hero">
      <div>
        <p class="eyebrow">学习资料库</p>
        <h2>把电子书、课件和笔记整理成真正可追踪的书架</h2>
        <p class="hero-copy">页码进度、阅读计时、读书笔记、收藏管理，常用资料一键打开。</p>
      </div>
      <button class="btn" @click="addBooks">添加资料</button>
    </section>

    <section
      v-if="books.continueReading && !books.readingId"
      class="continue-strip card"
      @click="selectedId = books.continueReading.id"
    >
      <div class="cs-cover">
        <BookCover :name="books.continueReading.name" compact />
      </div>
      <div class="cs-main">
        <p class="cs-label">继续阅读</p>
        <h3>{{ books.continueReading.name }}</h3>
        <div class="cs-progress"><span :style="{ width: books.continueReading.progress + '%' }" /></div>
      </div>
      <span class="cs-pct">{{ books.continueReading.progress }}%</span>
      <button class="btn btn-sm" @click.stop="openBook(books.continueReading)">打开</button>
      <button class="btn btn-secondary btn-sm" @click.stop="toggleTimer(books.continueReading)">开始计时</button>
    </section>

    <section v-if="books.readingBook" class="reading-strip card">
      <span class="reading-dot" />
      <div class="cs-main">
        <p class="cs-label">阅读计时中 · {{ readingElapsed }}</p>
        <h3>{{ books.readingBook.name }}</h3>
      </div>
      <button class="btn btn-sm" @click="toggleTimer(books.readingBook)">结束并记录</button>
    </section>

    <section class="library-stats">
      <div class="metric">
        <span class="metric-label">总资料</span>
        <strong>{{ books.stats.total }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">正在读</span>
        <strong>{{ books.stats.reading }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">完成率</span>
        <strong>{{ books.stats.progress }}%</strong>
      </div>
      <div class="metric">
        <span class="metric-label">读书笔记</span>
        <strong>{{ books.stats.noteCount }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">累计阅读</span>
        <strong>{{ Math.round(books.stats.readMinutes / 60 * 10) / 10 }}<small> 小时</small></strong>
      </div>
    </section>

    <section class="library-tools">
      <input v-model="query" class="input search" placeholder="搜索书名、作者、标签、笔记..." />
      <div class="seg status-seg">
        <button
          v-for="tabItem in statusTabs"
          :key="tabItem.key"
          class="seg-btn"
          :class="{ active: status === tabItem.key }"
          @click="status = tabItem.key"
        >
          {{ tabItem.label }}
        </button>
      </div>
      <select v-model="category" class="input input-sm select">
        <option v-for="cat in cats" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="sort" class="input input-sm select">
        <option value="recent">最近打开</option>
        <option value="progress">阅读进度</option>
        <option value="rating">评分</option>
        <option value="name">名称</option>
      </select>
    </section>

    <div class="library-layout">
      <section class="shelf-panel card">
        <div v-if="filtered.length" class="book-grid">
          <article
            v-for="book in filtered"
            :key="book.id"
            class="book-card"
            :class="{ active: selected?.id === book.id, missing: isMissing(book) }"
            @click="selectedId = book.id"
            @dblclick="openBook(book)"
          >
            <div class="book-cover">
              <BookCover :name="book.name" compact />
              <span class="book-progress">{{ book.progress }}%</span>
              <button
                class="fav-btn"
                :class="{ on: book.favorite }"
                :title="book.favorite ? '取消收藏' : '收藏'"
                @click.stop="books.toggleFavorite(book.id)"
              >
                <AppIcon name="star" :size="13" :stroke-width="2" />
              </button>
              <span v-if="isMissing(book)" class="missing-badge">文件丢失</span>
            </div>
            <div class="book-body">
              <h3 :title="book.name">{{ book.name }}</h3>
              <p>{{ book.author || book.category || '未分类' }}</p>
              <div class="progress-line"><span :style="{ width: book.progress + '%' }" /></div>
              <div class="book-meta">
                <span class="state" :class="statusClass[book.status]">{{ statusLabel[book.status] }}</span>
                <span v-if="book.rating" class="rate"><AppIcon name="star" :size="11" />{{ book.rating }}.0</span>
                <span v-else class="rate muted">未评分</span>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="compact-empty">
          <EmptyState icon="book" title="还没有匹配资料" desc="添加 PDF / 电子书 / 课件 / 笔记后，可以按进度、分类和标签整理。">
            <button class="btn" @click="addBooks">添加资料</button>
          </EmptyState>
        </div>
      </section>

      <aside v-if="selected" class="detail-panel card">
        <div class="detail-cover">
          <BookCover :name="selected.name" />
        </div>
        <div class="detail-main">
          <p class="detail-kicker">{{ selected.category }}</p>
          <h2>
            <button
              class="fav-inline"
              :class="{ on: selected.favorite }"
              :title="selected.favorite ? '取消收藏' : '收藏'"
              @click="books.toggleFavorite(selected.id)"
            >
              <AppIcon name="star" :size="16" :stroke-width="2" />
            </button>
            {{ selected.name }}
          </h2>
          <p class="detail-sub">{{ selected.author || '未填写作者' }}</p>
        </div>

        <p v-if="isMissing(selected)" class="missing-tip">
          <span class="mt-text"><AppIcon name="warning" :size="13" />源文件不存在（可能被移动或删除）</span>
          <button class="btn btn-secondary btn-sm" @click="relocateBook(selected)">重新定位</button>
        </p>

        <div class="detail-actions">
          <button class="btn" @click="openBook(selected)">打开</button>
          <button
            class="btn btn-secondary"
            :class="{ 'timer-on': books.readingId === selected.id }"
            @click="toggleTimer(selected)"
          >
            <AppIcon :name="books.readingId === selected.id ? 'pause' : 'timer'" :size="13" />
            {{ books.readingId === selected.id ? readingElapsed : '计时阅读' }}
          </button>
          <button class="btn btn-secondary" @click="openEdit(selected)">编辑</button>
        </div>

        <label class="progress-editor">
          <span>阅读进度 {{ selected.progress }}%</span>
          <input type="range" min="0" max="100" :value="selected.progress" @input="setProgress(selected, $event)" />
        </label>

        <div class="pages-editor">
          <span class="pages-label">页码进度</span>
          <div class="pages-row">
            <input v-model.number="pageDraft.current" type="number" min="0" class="input input-sm" placeholder="当前页" />
            <span class="pages-sep">/</span>
            <input v-model.number="pageDraft.total" type="number" min="0" class="input input-sm" placeholder="总页数" />
            <button class="btn btn-secondary btn-sm" @click="savePages">记一笔</button>
          </div>
        </div>

        <div class="detail-facts">
          <div><span>状态</span><strong>{{ statusLabel[selected.status] }}</strong></div>
          <div><span>打开次数</span><strong>{{ selected.openCount }}</strong></div>
          <div><span>最近打开</span><strong>{{ formatDate(selected.lastOpenedAt) }}</strong></div>
          <div><span>累计阅读</span><strong>{{ totalReadMinutes }} 分</strong></div>
        </div>

        <div v-if="selected.tags.length" class="tag-list">
          <span v-for="tag in selected.tags" :key="tag">#{{ tag }}</span>
        </div>

        <section class="notes-block">
          <p class="block-head">读书笔记 <small>{{ selected.notes.length }} 条</small></p>
          <div class="note-add">
            <textarea
              v-model="noteText"
              class="input"
              rows="2"
              placeholder="摘录一句话、记一个想法...（Ctrl+Enter 保存）"
              @keydown.ctrl.enter="addNote"
            />
            <div class="note-add-row">
              <input v-model.number="notePage" type="number" min="0" class="input input-sm page-input" placeholder="页码" />
              <button class="btn btn-sm" @click="addNote">保存笔记</button>
            </div>
          </div>
          <div v-if="selected.notes.length" class="note-list">
            <article v-for="n in selected.notes" :key="n.id" class="note-item">
              <p class="note-text">{{ n.text }}</p>
              <div class="note-meta">
                <span>{{ n.page ? `P.${n.page} · ` : '' }}{{ formatDateTime(n.createdAt) }}</span>
                <button @click="removeNote(n.id)">删除</button>
              </div>
            </article>
          </div>
        </section>

        <section v-if="recentSessions.length" class="log-block">
          <p class="block-head">阅读记录</p>
          <div class="log-list">
            <div v-for="r in recentSessions" :key="r.id" class="log-row">
              <span>{{ formatDateTime(r.at) }}</span>
              <strong>{{ r.minutes }} 分钟</strong>
            </div>
          </div>
        </section>

        <p v-if="selected.note" class="detail-note">{{ selected.note }}</p>
        <p class="path-tip">{{ selected.path }}</p>
      </aside>
    </div>

    <AppModal v-if="showEdit" title="编辑资料" @close="showEdit = false">
      <div class="form">
        <label class="fld">
          <span>名称</span>
          <input v-model="editing.name" class="input" />
        </label>
        <div class="fld-row">
          <label class="fld">
            <span>作者 / 来源</span>
            <input v-model="editing.author" class="input" placeholder="选填" />
          </label>
          <label class="fld">
            <span>分类</span>
            <input v-model="editing.category" class="input" list="bs-cats" placeholder="如 数学 / 英语 / 论文" />
            <datalist id="bs-cats">
              <option v-for="cat in books.categories" :key="cat" :value="cat" />
            </datalist>
          </label>
        </div>
        <div class="fld-row">
          <label class="fld">
            <span>状态</span>
            <select v-model="editing.status" class="input select">
              <option value="unread">未读</option>
              <option value="reading">在读</option>
              <option value="finished">读完</option>
              <option value="reference">资料</option>
            </select>
          </label>
          <label class="fld">
            <span>评分</span>
            <select v-model.number="editing.rating" class="input select">
              <option :value="0">未评分</option>
              <option v-for="n in 5" :key="n" :value="n">{{ n }} 星</option>
            </select>
          </label>
        </div>
        <div class="fld-row">
          <label class="fld">
            <span>当前页</span>
            <input v-model.number="editing.currentPage" type="number" min="0" class="input" />
          </label>
          <label class="fld">
            <span>总页数</span>
            <input v-model.number="editing.totalPages" type="number" min="0" class="input" />
          </label>
        </div>
        <label v-if="!editing.totalPages" class="fld">
          <span>阅读进度：{{ editing.progress }}%</span>
          <input v-model.number="editing.progress" type="range" min="0" max="100" />
        </label>
        <label class="fld">
          <span>标签</span>
          <input v-model="tagText" class="input" placeholder="用空格或逗号分隔，如 考研 英语 精读" />
        </label>
        <label class="fld">
          <span>备注</span>
          <textarea v-model="editing.note" class="input" rows="3" placeholder="记录章节、使用场景..." />
        </label>
        <p class="fld-hint">{{ editing.path }}</p>
      </div>
      <template #footer>
        <button class="btn btn-danger btn-sm" @click="delEdit">移除</button>
        <button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button>
        <button class="btn btn-sm" @click="saveEdit">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.library-page {
  max-width: 1180px;
}
.library-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
  padding: 12px 4px 2px 18px;
}
.library-hero::before {
  content: '';
  position: absolute;
  inset-block: 12px 2px;
  inset-inline-start: 0;
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(var(--brand-highlight), var(--accent));
}
.eyebrow {
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.07em;
  margin-bottom: 6px;
}
.library-hero h2 {
  font-size: 26px;
  letter-spacing: -0.025em;
  line-height: 1.2;
  max-width: 620px;
}
.hero-copy {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13.5px;
}
.continue-strip,
.reading-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  margin-bottom: 12px;
  cursor: pointer;
}
.continue-strip {
  background:
    linear-gradient(110deg, color-mix(in srgb, var(--brand-sky) 11%, transparent), transparent 38%),
    linear-gradient(290deg, color-mix(in srgb, var(--brand-peach) 9%, transparent), transparent 34%),
    var(--surface-card);
}
.reading-strip {
  cursor: default;
  border-color: color-mix(in srgb, var(--status-success) 42%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--status-success) 9%, transparent), var(--surface-card));
}
.reading-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--status-success);
  flex-shrink: 0;
  animation: reading-pulse 1.4s infinite;
}
@keyframes reading-pulse {
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--status-success) 14%, transparent);
  }
}
.cs-cover {
  width: 46px;
  height: 60px;
  flex-shrink: 0;
  font-size: 14px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.16));
}
/* 小尺寸封面放不下类型徽章 */
.cs-cover :deep(.bk-type) {
  display: none;
}
.cs-main {
  flex: 1;
  min-width: 0;
}
.cs-label {
  color: var(--accent-strong);
  font-size: 11.5px;
  font-weight: 800;
  margin-bottom: 3px;
}
.cs-main h3 {
  font-size: 14.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-progress {
  height: 5px;
  margin-top: 8px;
  max-width: 380px;
  border-radius: 999px;
  background: var(--active);
  overflow: hidden;
}
.cs-progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
}
.cs-pct {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
}
.library-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.metric {
  position: relative;
  overflow: hidden;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
}
.metric::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: color-mix(in srgb, var(--accent) 42%, transparent);
}
.metric:nth-child(2)::before {
  background: var(--brand-sky);
}
.metric:nth-child(3)::before {
  background: var(--brand-sun);
}
.metric:nth-child(4)::before {
  background: var(--brand-peach);
}
.metric:nth-child(5)::before {
  background: var(--brand-lilac);
}
.metric-label {
  display: block;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-bottom: 6px;
}
.metric strong {
  font-size: 23px;
  font-variant-numeric: tabular-nums;
}
.metric strong small {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}
.library-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.search {
  flex: 1;
  min-width: 200px;
}
.status-seg {
  flex-shrink: 0;
}
.library-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 16px;
  align-items: start;
}
.shelf-panel {
  min-height: 520px;
  padding: 14px;
  background: color-mix(in srgb, var(--surface-card) 90%, transparent);
}
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(172px, 1fr));
  gap: 14px;
}
.book-card {
  min-height: 236px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-raised);
  padding: 12px;
  cursor: pointer;
  transition: transform 0.16s var(--ease), border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.book-card:hover,
.book-card.active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 38%, transparent);
  box-shadow: 0 10px 24px rgba(27, 36, 32, 0.09);
}
.book-card.active {
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 50%),
    var(--surface-raised);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),
    0 10px 24px rgba(27, 36, 32, 0.09);
}
.book-card.missing {
  opacity: 0.75;
}
.book-cover {
  position: relative;
  height: 128px;
  margin-bottom: 12px;
  font-size: 22px;
  filter: drop-shadow(0 7px 10px rgba(28, 36, 32, 0.12));
}
.book-progress {
  position: absolute;
  right: 10px;
  bottom: 9px;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.24);
}
.fav-btn {
  position: absolute;
  top: 7px;
  left: 7px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.62);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s var(--ease), color 0.15s var(--ease);
  backdrop-filter: blur(4px);
}
.book-card:hover .fav-btn,
.fav-btn.on {
  opacity: 1;
}
.fav-btn.on {
  color: #f5c84c;
}
.fav-btn.on :deep(svg) {
  fill: #f5c84c;
}
.missing-badge {
  position: absolute;
  left: 10px;
  bottom: 9px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 3px 7px;
  border-radius: 999px;
  background: #ff453a;
}
.book-body h3 {
  font-size: 14px;
  line-height: 1.35;
  min-height: 38px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.book-body p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.progress-line {
  height: 5px;
  margin: 10px 0;
  border-radius: 999px;
  background: var(--active);
  overflow: hidden;
}
.progress-line span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.3s var(--ease);
}
.book-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}
.rate {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #b8891f;
  font-weight: 700;
}
.rate :deep(svg) {
  fill: #f5c84c;
  color: #d9a72e;
}
.rate.muted {
  color: var(--text-tertiary);
  font-weight: 500;
}
.rate.muted :deep(svg) {
  fill: none;
  color: var(--text-tertiary);
}
.state {
  font-weight: 700;
}
.is-blue {
  color: #4f97cc;
}
.is-green {
  color: var(--status-success);
}
.is-violet {
  color: #715b83;
}
.is-muted {
  color: var(--text-tertiary);
}
.detail-panel {
  position: sticky;
  top: 0;
  padding: 18px;
  background: var(--surface-card);
}
.detail-cover {
  width: 126px;
  height: 164px;
  margin: 0 auto 14px;
  font-size: 24px;
  filter: drop-shadow(0 12px 18px rgba(26, 35, 31, 0.16));
}
.detail-main h2 {
  font-size: 18px;
  line-height: 1.3;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.fav-inline {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  padding: 1px 0 0;
  flex-shrink: 0;
  display: inline-flex;
}
.fav-inline.on {
  color: #d9a72e;
}
.fav-inline.on :deep(svg) {
  fill: #f5c84c;
}
.detail-kicker,
.detail-sub,
.path-tip {
  color: var(--text-secondary);
  font-size: 12.5px;
}
.detail-kicker {
  margin-bottom: 5px;
  font-weight: 700;
  color: var(--accent-strong);
}
.detail-sub {
  margin-top: 5px;
}
.missing-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 12px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--status-danger) 11%, transparent);
  color: var(--status-danger);
  font-size: 12.5px;
  font-weight: 700;
}
.mt-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1.3fr 1fr;
  gap: 8px;
  margin: 14px 0;
}
.timer-on {
  border-color: var(--status-success);
  color: var(--status-success);
  font-variant-numeric: tabular-nums;
}
.progress-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.pages-editor {
  margin-top: 12px;
}
.pages-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-bottom: 7px;
}
.pages-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.pages-row .input {
  width: 74px;
  text-align: center;
}
.pages-sep {
  color: var(--text-tertiary);
}
.detail-facts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin: 14px 0;
}
.detail-facts div {
  padding: 9px 7px;
  border-radius: 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  text-align: center;
}
.detail-facts span {
  display: block;
  color: var(--text-tertiary);
  font-size: 10.5px;
  margin-bottom: 4px;
}
.detail-facts strong {
  font-size: 12px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.tag-list span {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11.5px;
  font-weight: 700;
}
.notes-block,
.log-block {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--separator);
}
.block-head {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
}
.block-head small {
  color: var(--text-tertiary);
  font-weight: 600;
  margin-left: 4px;
}
.note-add textarea {
  width: 100%;
}
.note-add-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.page-input {
  width: 74px;
  text-align: center;
}
.note-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  max-height: 260px;
  overflow-y: auto;
}
.note-item {
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--surface-muted);
  border-left: 3px solid var(--accent);
}
.note-text {
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 7px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.note-meta button {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
}
.note-meta button:hover {
  color: #ff453a;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.log-row {
  display: flex;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 9px;
  background: var(--surface-muted);
  font-size: 12px;
  color: var(--text-secondary);
}
.log-row strong {
  color: var(--text-primary);
}
.detail-note {
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-input);
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 12.5px;
}
.path-tip {
  margin-top: 12px;
  word-break: break-all;
}
.compact-empty {
  min-height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.fld > span {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
}
.fld-row {
  display: flex;
  gap: 12px;
}
.fld-hint {
  color: var(--text-tertiary);
  font-size: 11.5px;
  word-break: break-all;
}
@media (max-width: 980px) {
  .library-layout {
    grid-template-columns: 1fr;
  }
  .detail-panel {
    position: static;
  }
  .library-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .library-tools {
    flex-wrap: wrap;
  }
}
</style>
