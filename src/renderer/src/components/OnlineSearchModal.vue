<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppModal from './AppModal.vue'
import type { OnlineTrack } from '@/types'

const props = withDefaults(
  defineProps<{
    title: string
    placeholder?: string
    defaultKeyword?: string
    actionLabel?: string
    closeAfterPick?: boolean
    onPick: (track: OnlineTrack) => Promise<boolean>
  }>(),
  {
    placeholder: '输入歌名 / 歌手 / 关键词…',
    defaultKeyword: '',
    actionLabel: '添加',
    closeAfterPick: false
  }
)
const emit = defineEmits<{ close: [] }>()

const keyword = ref(props.defaultKeyword)
const loading = ref(false)
const searched = ref(false)
const results = ref<OnlineTrack[]>([])
const pending = ref(-1)
const added = ref<Set<string>>(new Set())
const note = ref('')

async function search(): Promise<void> {
  const kw = keyword.value.trim()
  if (!kw || loading.value) return
  loading.value = true
  searched.value = true
  note.value = ''
  try {
    results.value = await window.api.online.search(kw)
    if (!results.value.length) note.value = '没有找到结果，换个关键词再试试'
  } catch {
    results.value = []
    note.value = '搜索失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

async function pick(track: OnlineTrack, i: number): Promise<void> {
  if (pending.value !== -1 || added.value.has(track.url)) return
  pending.value = i
  try {
    const ok = await props.onPick(track)
    if (ok) {
      added.value.add(track.url)
      if (props.closeAfterPick) emit('close')
    } else {
      note.value = '处理失败，可能是网络或资源问题，请重试'
    }
  } finally {
    pending.value = -1
  }
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

onMounted(() => {
  if (keyword.value.trim()) void search()
})
</script>

<template>
  <AppModal :title="title" @close="emit('close')">
    <div class="search-bar">
      <input v-model="keyword" class="input" :placeholder="placeholder" @keyup.enter="search" />
      <button class="btn btn-sm" :disabled="loading || !keyword.trim()" @click="search">
        {{ loading ? '搜索中…' : '搜索' }}
      </button>
    </div>
    <p class="s-sub hint">在线片段来自公开音乐接口（约 30 秒预览），选择后会下载到本地离线使用。</p>

    <div v-if="results.length" class="results">
      <div v-for="(r, i) in results" :key="r.url" class="res">
        <div class="res-info">
          <p class="res-name">{{ r.name }}</p>
          <p class="res-sub">{{ r.artist || '未知歌手' }} · {{ fmt(r.duration) }}</p>
        </div>
        <button v-if="added.has(r.url)" class="btn btn-secondary btn-sm" disabled>已添加</button>
        <button
          v-else
          class="btn btn-secondary btn-sm"
          :disabled="pending !== -1"
          @click="pick(r, i)"
        >
          {{ pending === i ? '处理中…' : actionLabel }}
        </button>
      </div>
    </div>
    <p v-else-if="loading" class="s-sub empty-note">正在搜索…</p>
    <p v-else-if="note" class="s-sub empty-note">{{ note }}</p>
    <p v-else-if="!searched" class="s-sub empty-note">输入关键词后回车或点「搜索」</p>

    <template #footer>
      <button class="btn btn-secondary btn-sm" @click="emit('close')">关闭</button>
    </template>
  </AppModal>
</template>

<style scoped>
.search-bar {
  display: flex;
  gap: 10px;
}
.search-bar .input {
  flex: 1;
}
.hint {
  margin-top: 8px;
}
.results {
  margin-top: 14px;
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.res {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.15s var(--ease);
}
.res:hover {
  background: var(--hover);
}
.res-info {
  flex: 1;
  min-width: 0;
}
.res-name {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.res-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty-note {
  margin-top: 18px;
  text-align: center;
}
</style>
