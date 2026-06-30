<script setup lang="ts">
import { reactive, ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
import UrlPromptModal from '@/components/UrlPromptModal.vue'
import { useCountdownStore, daysLeft } from '@/stores/countdowns'
import { LESSON_COLORS, uid, type Countdown } from '@/types'

const cd = useCountdownStore()

const showEdit = ref(false)
const isEdit = ref(false)
const showUrl = ref(false)
const editing = reactive<Countdown>({ id: '', title: '', date: '', color: LESSON_COLORS[0], bg: '' })

function media(p: string): string {
  return window.api.media.url(p)
}
function openAdd(): void {
  Object.assign(editing, { id: uid(), title: '', date: '', color: LESSON_COLORS[0], bg: '' })
  isEdit.value = false
  showEdit.value = true
}
function openEdit(c: Countdown): void {
  Object.assign(editing, { ...c, bg: c.bg ?? '' })
  isEdit.value = true
  showEdit.value = true
}
function save(): void {
  if (!editing.title.trim() || !editing.date) return
  if (isEdit.value) cd.update({ ...editing })
  else cd.add(editing.title, editing.date, editing.color, editing.bg)
  showEdit.value = false
}
function del(): void {
  cd.remove(editing.id)
  showEdit.value = false
}
function label(n: number): string {
  if (n > 0) return `还有 ${n} 天`
  if (n === 0) return '就是今天'
  return `已过 ${-n} 天`
}

async function pickBgLocal(): Promise<void> {
  const p = await window.api.dialog.openFile([
    { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
  ])
  if (p) editing.bg = p
}
async function pickBgOnline(): Promise<void> {
  const p = await window.api.media.download(`https://picsum.photos/600/360?random=${Date.now()}`)
  if (p) editing.bg = p
}
async function onBgUrl(url: string): Promise<void> {
  const p = await window.api.media.download(url)
  if (p) editing.bg = p
  showUrl.value = false
}
</script>

<template>
  <div class="page">
    <div class="cd-head">
      <h3 class="section-title" style="margin: 0">倒数日</h3>
      <button class="btn btn-secondary btn-sm" @click="openAdd">添加</button>
    </div>

    <div v-if="cd.sorted.length" class="cd-grid">
      <div
        v-for="c in cd.sorted"
        :key="c.id"
        class="cd-card"
        :class="{ 'has-bg': !!c.bg }"
        :style="c.bg ? { backgroundImage: `url('${media(c.bg)}')` } : {}"
        @click="openEdit(c)"
      >
        <div v-if="!c.bg" class="cd-stripe" :style="{ background: c.color }" />
        <div class="cd-inner">
          <p class="cd-title">{{ c.title }}</p>
          <p class="cd-days" :style="{ color: c.bg ? '#fff' : c.color }">
            {{ Math.abs(daysLeft(c.date)) }}<small> 天</small>
          </p>
          <p class="cd-sub">{{ label(daysLeft(c.date)) }} · {{ c.date }}</p>
        </div>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">⏳</div>
        <h2>还没有倒数日</h2>
        <p>添加考试、截止日或重要日子，主界面会显示「距 X 还有 N 天」。</p>
        <button class="btn" @click="openAdd">添加倒数日</button>
      </div>
    </div>

    <AppModal v-if="showEdit" :title="isEdit ? '编辑倒数日' : '添加倒数日'" @close="showEdit = false">
      <div class="form">
        <label class="fld">
          <span>名称</span>
          <input v-model="editing.title" class="input" placeholder="如 期末考试 / 考研" />
        </label>
        <label class="fld">
          <span>日期</span>
          <input v-model="editing.date" type="date" class="input" />
        </label>
        <div class="fld">
          <span>颜色</span>
          <div class="colors">
            <button
              v-for="col in LESSON_COLORS"
              :key="col"
              class="cdot"
              :class="{ on: editing.color === col }"
              :style="{ background: col }"
              :aria-label="col"
              @click="editing.color = col"
            />
          </div>
        </div>
        <div class="fld">
          <span>卡片背景图（可选）{{ editing.bg ? ' · 已设置' : '' }}</span>
          <div class="row wrap">
            <button class="btn btn-secondary btn-sm" @click="pickBgOnline">随机在线</button>
            <button class="btn btn-secondary btn-sm" @click="showUrl = true">从链接</button>
            <button class="btn btn-secondary btn-sm" @click="pickBgLocal">本地</button>
            <button class="btn btn-secondary btn-sm" @click="editing.bg = ''">清除</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button v-if="isEdit" class="btn btn-danger btn-sm" @click="del">删除</button>
        <button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button>
        <button class="btn btn-sm" @click="save">保存</button>
      </template>
    </AppModal>

    <UrlPromptModal
      v-if="showUrl"
      title="卡片背景图链接"
      placeholder="图片直链 (jpg/png/webp)…"
      @confirm="onBgUrl"
      @close="showUrl = false"
    />
  </div>
</template>

<style scoped>
.cd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.cd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.cd-card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 18px 18px 18px 22px;
  cursor: pointer;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  transition: transform 0.12s var(--ease), box-shadow 0.15s var(--ease);
}
.cd-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-pop);
}
.cd-card.has-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.62));
}
.cd-inner {
  position: relative;
}
.cd-card.has-bg .cd-title,
.cd-card.has-bg .cd-sub {
  color: #fff;
}
.cd-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
}
.cd-title {
  font-size: 14px;
  font-weight: 600;
}
.cd-days {
  font-size: 40px;
  font-weight: 800;
  margin: 6px 0 2px;
  font-variant-numeric: tabular-nums;
}
.cd-days small {
  font-size: 14px;
  font-weight: 600;
}
.cd-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
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
.colors {
  display: flex;
  gap: 9px;
}
.cdot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px var(--separator);
}
.cdot.on {
  box-shadow: 0 0 0 2px var(--accent);
}
.row.wrap {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
