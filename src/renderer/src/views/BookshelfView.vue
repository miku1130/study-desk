<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import { useBooksStore } from '@/stores/books'
import type { Book } from '@/types'

const books = useBooksStore()
const filter = ref('全部')

const cats = computed(() => ['全部', ...books.categories])
const filtered = computed(() =>
  filter.value === '全部'
    ? books.items
    : books.items.filter((b) => (b.category || '未分类') === filter.value)
)

function ext(name: string): string {
  const m = name.match(/\.([^.]+)$/)
  return m ? m[1].toUpperCase() : 'FILE'
}
function extColor(name: string): string {
  const e = ext(name).toLowerCase()
  if (e === 'pdf') return '#ff453a'
  if (['doc', 'docx'].includes(e)) return '#0a84ff'
  if (['ppt', 'pptx'].includes(e)) return '#ff9f0a'
  if (['xls', 'xlsx'].includes(e)) return '#30d158'
  if (['epub', 'mobi', 'azw3'].includes(e)) return '#bf5af2'
  return '#8e8e93'
}

const showEdit = ref(false)
const editing = reactive<Book>({ id: '', name: '', path: '', category: '未分类', addedAt: 0 })
function openEdit(b: Book): void {
  Object.assign(editing, b)
  showEdit.value = true
}
function saveEdit(): void {
  books.rename(editing.id, editing.name)
  books.setCategory(editing.id, editing.category)
  showEdit.value = false
}
function delEdit(): void {
  books.remove(editing.id)
  showEdit.value = false
}
</script>

<template>
  <div class="page wide">
    <div class="bs-toolbar">
      <div class="seg">
        <button
          v-for="c in cats"
          :key="c"
          class="seg-btn"
          :class="{ active: filter === c }"
          @click="filter = c"
        >
          {{ c }}
        </button>
      </div>
      <span class="spacer" />
      <button class="btn btn-secondary btn-sm" @click="books.addBooks()">添加文件</button>
    </div>

    <div v-if="filtered.length" class="bs-grid">
      <div v-for="b in filtered" :key="b.id" class="book" @click="books.open(b.path)">
        <div class="book-cover" :style="{ background: extColor(b.name) }">
          <span class="book-ext">{{ ext(b.name) }}</span>
        </div>
        <div class="book-name" :title="b.name">{{ b.name }}</div>
        <div class="book-cat">{{ b.category || '未分类' }}</div>
        <button class="book-edit" aria-label="编辑" @click.stop="openEdit(b)">⋯</button>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">📚</div>
        <h2>书架是空的</h2>
        <p>添加 PDF / 电子书 / 文档，按分类整理，点击即可用系统默认程序打开。</p>
        <button class="btn" @click="books.addBooks()">添加文件</button>
      </div>
    </div>

    <AppModal v-if="showEdit" title="编辑书目" @close="showEdit = false">
      <div class="form">
        <label class="fld">
          <span>名称</span>
          <input v-model="editing.name" class="input" />
        </label>
        <label class="fld">
          <span>分类</span>
          <input v-model="editing.category" class="input" list="bs-cats" placeholder="如 数学 / 英语 / 课外" />
          <datalist id="bs-cats">
            <option v-for="c in books.categories" :key="c" :value="c" />
          </datalist>
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
.wide {
  max-width: 1000px;
}
.bs-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.spacer {
  flex: 1;
}
.bs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}
.book {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--separator);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  transition: transform 0.12s var(--ease), box-shadow 0.15s var(--ease);
}
.book:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-pop);
}
.book:hover .book-edit {
  opacity: 1;
}
.book-cover {
  height: 96px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.book-ext {
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.book-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.book-cat {
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}
.book-edit {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
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
}
.fld > span {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.fld-hint {
  font-size: 11.5px;
  color: var(--text-tertiary);
  word-break: break-all;
}
</style>
