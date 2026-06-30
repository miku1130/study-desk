<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore } from '@/stores/todos'

const todos = useTodoStore()
const text = ref('')

function add(): void {
  todos.add(text.value)
  text.value = ''
}
</script>

<template>
  <div class="page">
    <div class="add-row card">
      <input
        v-model="text"
        class="input"
        placeholder="添加一个学习任务，回车确认…"
        @keyup.enter="add"
      />
      <button class="btn" @click="add">添加</button>
    </div>

    <div class="meta-row">
      <span class="badge">{{ todos.remaining }} 项未完成</span>
      <button class="btn-link" @click="todos.clearDone()">清除已完成</button>
    </div>

    <div v-if="todos.items.length" class="card list">
      <TransitionGroup name="list">
        <div v-for="it in todos.items" :key="it.id" class="todo" :class="{ done: it.done }">
          <button class="check" :class="{ on: it.done }" @click="todos.toggle(it.id)">
            <svg
              v-if="it.done"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 8.5l3.2 3.2L13 5" />
            </svg>
          </button>
          <span class="todo-text">{{ it.text }}</span>
          <button class="del" aria-label="删除" @click="todos.remove(it.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>

    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">📝</div>
        <h2>还没有任务</h2>
        <p>添加今天要完成的学习任务，配合番茄钟逐项攻克。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-row {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.add-row .input {
  flex: 1;
}
.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4px 12px;
}
.btn-link {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
}
.btn-link:hover {
  color: var(--accent);
}
.list {
  padding: 8px;
}
.todo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  transition: background 0.15s var(--ease);
}
.todo:hover {
  background: var(--hover);
}
.todo:hover .del {
  opacity: 1;
}
.check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.8px solid var(--text-tertiary);
  background: transparent;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s var(--ease);
}
.check svg {
  width: 13px;
  height: 13px;
}
.check.on {
  background: var(--accent);
  border-color: var(--accent);
}
.todo-text {
  flex: 1;
  font-size: 14px;
}
.todo.done .todo-text {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.del {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}
.del:hover {
  color: #ff453a;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
.list-enter-active,
.list-leave-active {
  transition: all 0.22s var(--ease);
}
.list-leave-active {
  position: absolute;
}
</style>
