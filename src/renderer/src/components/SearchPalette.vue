<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTimetableStore } from '@/stores/timetable'
import { useTodoStore } from '@/stores/todos'
import { useBooksStore } from '@/stores/books'
import { useCountdownStore } from '@/stores/countdowns'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const tt = useTimetableStore()
const todos = useTodoStore()
const books = useBooksStore()
const cd = useCountdownStore()

const q = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
onMounted(() => inputEl.value?.focus())

interface Item {
  label: string
  sub: string
  action: () => void
}

function go(path: string): void {
  router.push(path)
  emit('close')
}
function openBook(p: string): void {
  void window.api.shell.openPath(p)
  emit('close')
}

const pages: Item[] = (
  [
    ['仪表盘', '/'],
    ['课表', '/timetable'],
    ['番茄钟', '/pomodoro'],
    ['背景音乐', '/music'],
    ['待办清单', '/todo'],
    ['书架', '/bookshelf'],
    ['倒数日', '/countdown'],
    ['专注统计', '/stats'],
    ['设置', '/settings']
  ] as [string, string][]
).map(([label, to]) => ({ label, sub: '页面', action: () => go(to) }))

const results = computed<Item[]>(() => {
  const k = q.value.trim().toLowerCase()
  if (!k) return pages
  const all: Item[] = [...pages]
  for (const l of tt.lessons) all.push({ label: l.name, sub: `课表 · ${l.location || ''}`, action: () => go('/timetable') })
  for (const t of todos.items) all.push({ label: t.text, sub: '待办', action: () => go('/todo') })
  for (const b of books.items) all.push({ label: b.name, sub: `书架 · ${b.category}`, action: () => openBook(b.path) })
  for (const c of cd.items) all.push({ label: c.title, sub: '倒数日', action: () => go('/countdown') })
  return all.filter((i) => i.label.toLowerCase().includes(k)).slice(0, 40)
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'Enter') results.value[0]?.action()
}
</script>

<template>
  <Teleport to="body">
    <div class="sp-mask" @click.self="emit('close')">
      <div class="sp">
        <input
          ref="inputEl"
          v-model="q"
          class="sp-input"
          placeholder="搜索页面 / 课程 / 待办 / 书架 / 倒数日…  （Esc 关闭）"
          @keydown="onKey"
        />
        <div class="sp-list">
          <button v-for="(it, i) in results" :key="i" class="sp-item" @click="it.action()">
            <span class="sp-label">{{ it.label }}</span>
            <span class="sp-sub">{{ it.sub }}</span>
          </button>
          <div v-if="!results.length" class="sp-empty">无结果</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sp-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  z-index: 200;
}
.sp {
  width: 560px;
  max-width: calc(100vw - 48px);
  background: var(--bg-card-strong);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}
.sp-input {
  width: 100%;
  height: 52px;
  padding: 0 18px;
  border: none;
  border-bottom: 1px solid var(--separator);
  background: transparent;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
}
.sp-list {
  max-height: 50vh;
  overflow-y: auto;
  padding: 6px;
}
.sp-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--text-primary);
  padding: 10px 12px;
  border-radius: 8px;
}
.sp-item:hover {
  background: var(--accent);
  color: #fff;
}
.sp-item:hover .sp-sub {
  color: rgba(255, 255, 255, 0.8);
}
.sp-label {
  font-size: 14px;
  font-weight: 500;
}
.sp-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.sp-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
