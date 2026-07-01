<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMusicStore } from '@/stores/music'
import UrlPromptModal from '@/components/UrlPromptModal.vue'
import OnlineSearchModal from '@/components/OnlineSearchModal.vue'
import type { LoopMode, OnlineTrack } from '@/types'

const music = useMusicStore()
const showUrl = ref(false)
const showSearch = ref(false)
const showPlaylist = ref(false)
const msg = ref('')

const loops: { v: LoopMode; l: string }[] = [
  { v: 'all', l: '列表循环' },
  { v: 'one', l: '单曲循环' },
  { v: 'none', l: '不循环' }
]

function onVolume(e: Event): void {
  music.setVolume((e.target as HTMLInputElement).valueAsNumber)
}

function flash(text: string): void {
  msg.value = text
  window.setTimeout(() => (msg.value = ''), 2600)
}

async function onAddUrl(url: string): Promise<void> {
  const ok = await music.addByUrl(url)
  showUrl.value = false
  flash(ok ? '已添加在线音乐' : '添加失败，请检查链接')
}

async function onPickOnline(t: OnlineTrack): Promise<boolean> {
  const id = await music.addOnline(t)
  flash(id ? `已收藏「${t.name}」` : '收藏失败，请重试')
  return !!id
}

async function onPlayOnline(t: OnlineTrack): Promise<void> {
  flash(`加载「${t.name}」…`)
  const ok = await music.playOnline(t)
  flash(ok ? `正在播放「${t.name}」` : '播放失败，请重试')
}

async function onImportPlaylist(url: string): Promise<void> {
  showPlaylist.value = false
  flash('正在解析歌单…')
  const r = await music.importPlaylist(url)
  flash(r.ok ? `已导入歌单 ${r.count} 首，见下方在线列表` : r.error || '歌单导入失败')
}

onMounted(() => {
  if (!music.onlineTracks.length) void music.loadOnlineList()
})
</script>

<template>
  <div class="page narrow">
    <div class="player card">
      <div class="np">
        <div class="np-art" :class="{ spin: music.playing }">♫</div>
        <div class="np-info">
          <p class="np-name">{{ music.current ? music.current.name : '未播放' }}</p>
          <p class="np-sub">{{ music.tracks.length }} 首已收藏</p>
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

    <p v-if="msg" class="s-sub" style="margin: 0 4px 8px">{{ msg }}</p>

    <div class="list-head">
      <h3 class="section-title">在线曲库</h3>
      <div class="row">
        <button class="btn btn-secondary btn-sm" @click="showPlaylist = true">导入歌单</button>
        <button class="btn btn-secondary btn-sm" :disabled="music.onlineLoading" @click="music.loadOnlineList()">
          {{ music.onlineLoading ? '获取中…' : '换一批' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="showSearch = true">搜索</button>
      </div>
    </div>
    <div class="card list">
      <div v-if="music.onlineLoading" class="hint pad">正在获取在线轻音乐…</div>
      <template v-else-if="music.onlineTracks.length">
        <div
          v-for="t in music.onlineTracks"
          :key="t.url"
          class="track"
          @click="onPlayOnline(t)"
        >
          <span class="t-ico">▶</span>
          <span class="t-name">{{ t.name }}<span class="t-artist"> · {{ t.artist || '未知' }}</span></span>
          <button class="fav" aria-label="收藏" @click.stop="onPickOnline(t)">＋ 收藏</button>
        </div>
      </template>
      <div v-else class="hint pad">{{ music.onlineError || '暂无在线轻音乐，点「换一批」重试' }}</div>
    </div>

    <div class="list-head" style="margin-top: 18px">
      <h3 class="section-title">我的曲库</h3>
      <div class="row">
        <button class="btn btn-secondary btn-sm" @click="showUrl = true">链接添加</button>
        <button class="btn btn-secondary btn-sm" @click="music.importTracks()">导入本地</button>
      </div>
    </div>
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
        <button class="del" aria-label="删除" @click.stop="music.remove(t.id)">✕</button>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-state">
        <div class="emoji">🎧</div>
        <h2>曲库为空</h2>
        <p>从上方「轻音乐推荐」点 ＋收藏，或导入本地音乐 / 链接添加，专注时即可播放。</p>
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
      placeholder="输入歌名 / 歌手 / 关键词，如「纯音乐」「钢琴」…"
      default-keyword="轻音乐"
      action-label="收藏"
      :on-pick="onPickOnline"
      @close="showSearch = false"
    />

    <UrlPromptModal
      v-if="showPlaylist"
      title="导入网易云 / QQ音乐 歌单"
      placeholder="粘贴歌单分享链接…"
      hint="粘贴网易云或 QQ 音乐的歌单分享链接一键导入。部分歌曲受版权限制可能只能试听或无法播放；如接口失效可在「设置 → 音乐接口」更换为自建地址。"
      @confirm="onImportPlaylist"
      @close="showPlaylist = false"
    />
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
.hint.pad {
  padding: 22px 12px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
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
.track:hover .del,
.track:hover .fav {
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
.t-artist {
  color: var(--text-tertiary);
  font-size: 12px;
}
.fav {
  border: 1px solid var(--separator);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 100px;
  opacity: 0;
  transition: opacity 0.15s var(--ease), color 0.15s var(--ease);
  flex-shrink: 0;
}
.fav:hover {
  color: var(--accent);
  border-color: var(--accent);
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
