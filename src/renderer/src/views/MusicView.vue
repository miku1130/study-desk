<script setup lang="ts">
import { ref } from 'vue'
import { useMusicStore } from '@/stores/music'
import UrlPromptModal from '@/components/UrlPromptModal.vue'
import OnlineSearchModal from '@/components/OnlineSearchModal.vue'
import type { LoopMode, OnlineTrack } from '@/types'

const music = useMusicStore()
const showUrl = ref(false)
const showSearch = ref(false)
const msg = ref('')

const loops: { v: LoopMode; l: string }[] = [
  { v: 'all', l: '列表循环' },
  { v: 'one', l: '单曲循环' },
  { v: 'none', l: '不循环' }
]

function onVolume(e: Event): void {
  music.setVolume((e.target as HTMLInputElement).valueAsNumber)
}

async function onAddUrl(url: string): Promise<void> {
  const ok = await music.addByUrl(url)
  showUrl.value = false
  msg.value = ok ? '已添加在线音乐' : '添加失败，请检查链接'
  window.setTimeout(() => (msg.value = ''), 2600)
}

async function onPickOnline(t: OnlineTrack): Promise<boolean> {
  const ok = await music.addOnline(t)
  msg.value = ok ? `已添加「${t.name}」` : '添加失败，请重试'
  window.setTimeout(() => (msg.value = ''), 2600)
  return ok
}
</script>

<template>
  <div class="page narrow">
    <div class="player card">
      <div class="np">
        <div class="np-art" :class="{ spin: music.playing }">♫</div>
        <div class="np-info">
          <p class="np-name">{{ music.current ? music.current.name : '未播放' }}</p>
          <p class="np-sub">{{ music.tracks.length }} 首曲目</p>
        </div>
      </div>
      <div class="np-controls">
        <button class="btn-icon lg" aria-label="上一首" @click="music.prev()">⏮</button>
        <button class="btn play" @click="music.toggle()">
          {{ music.playing ? '暂停' : '播放' }}
        </button>
        <button class="btn-icon lg" aria-label="下一首" @click="music.next()">⏭</button>
      </div>
      <div class="np-extra">
        <div class="vol">
          <span>音量</span>
          <input type="range" min="0" max="1" step="0.01" :value="music.volume" @input="onVolume" />
        </div>
        <div class="seg">
          <button
            v-for="o in loops"
            :key="o.v"
            class="seg-btn"
            :class="{ active: music.loop === o.v }"
            @click="music.setLoop(o.v)"
          >
            {{ o.l }}
          </button>
        </div>
      </div>
    </div>

    <div class="list-head">
      <h3 class="section-title">曲库</h3>
      <div class="row">
        <button class="btn btn-secondary btn-sm" @click="showSearch = true">在线搜索</button>
        <button class="btn btn-secondary btn-sm" @click="showUrl = true">链接添加</button>
        <button class="btn btn-secondary btn-sm" @click="music.importTracks()">导入音乐</button>
      </div>
    </div>
    <p v-if="msg" class="s-sub" style="margin: 0 4px 8px">{{ msg }}</p>

    <div v-if="music.tracks.length" class="card list">
      <div
        v-for="t in music.tracks"
        :key="t.id"
        class="track"
        :class="{ active: t.id === music.currentId }"
        @click="music.play(t.id)"
      >
        <span class="t-ico">{{ t.id === music.currentId && music.playing ? '▶' : '♪' }}</span>
        <span class="t-name">{{ t.name }}</span>
        <span v-if="music.isBuiltin(t.path)" class="t-tag">内置</span>
        <button
          v-else
          class="del"
          aria-label="删除"
          @click.stop="music.remove(t.id)"
        >
          ✕
        </button>
      </div>
    </div>

    <UrlPromptModal
      v-if="showUrl"
      title="链接添加音乐"
      placeholder="粘贴音频直链 (mp3 / ogg / wav)…"
      hint="可用 Pixabay、archive.org 等免费资源站的音频直链，下载到本地后离线播放。"
      @confirm="onAddUrl"
      @close="showUrl = false"
    />

    <OnlineSearchModal
      v-if="showSearch"
      title="在线搜索音乐"
      placeholder="输入歌名 / 歌手 / 关键词，如「轻音乐」「钢琴」…"
      default-keyword="轻音乐"
      action-label="添加"
      :on-pick="onPickOnline"
      @close="showSearch = false"
    />

    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">🎧</div>
        <h2>曲库为空</h2>
        <p>导入本地轻音乐或白噪音（mp3 / wav / ogg 等），即可在专注时播放。</p>
        <button class="btn" @click="music.importTracks()">导入音乐</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.narrow {
  max-width: 600px;
}
.player {
  padding: 24px;
  margin-bottom: 16px;
}
.np {
  display: flex;
  align-items: center;
  gap: 16px;
}
.np-art {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, white));
  color: #fff;
  font-size: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.np-art.spin {
  animation: spin 4s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.np-name {
  font-size: 17px;
  font-weight: 700;
}
.np-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 3px;
}
.np-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 22px 0;
}
.btn-icon.lg {
  width: 44px;
  height: 44px;
  font-size: 16px;
  border-radius: 50%;
}
.btn.play {
  width: 120px;
  height: 44px;
  border-radius: 100px;
  font-size: 15px;
}
.np-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.vol {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}
.vol span {
  font-size: 12.5px;
  color: var(--text-secondary);
}
.vol input {
  flex: 1;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.list {
  padding: 8px;
}
.track {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.track:hover {
  background: var(--hover);
}
.track:hover .del {
  opacity: 1;
}
.track.active {
  background: var(--accent-soft);
}
.track.active .t-name {
  color: var(--accent);
  font-weight: 600;
}
.t-ico {
  width: 20px;
  text-align: center;
  color: var(--text-tertiary);
}
.t-name {
  flex: 1;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-tag {
  font-size: 11px;
  color: var(--text-tertiary);
  border: 1px solid var(--separator);
  padding: 1px 8px;
  border-radius: 100px;
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
</style>
