import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LoopMode, MusicData, MusicTrack, OnlineTrack } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

/** 音乐页自动展示的在线轻音乐默认关键词 */
export const AUTO_MUSIC_KEYWORD = '轻音乐'

export const useMusicStore = defineStore('music', () => {
  const tracks = ref<MusicTrack[]>([])
  const currentId = ref<string | null>(null)
  const playing = ref(false)
  const volume = ref(0.6)
  const loop = ref<LoopMode>('all')
  const loaded = ref(false)

  // 在线轻音乐列表（自动获取，不持久化）
  const onlineTracks = ref<OnlineTrack[]>([])
  const onlineLoading = ref(false)
  const onlineError = ref('')

  let audio: HTMLAudioElement | null = null

  const current = computed(() => tracks.value.find((t) => t.id === currentId.value) ?? null)

  function ensureAudio(): HTMLAudioElement {
    if (!audio) {
      audio = new Audio()
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('play', () => (playing.value = true))
      audio.addEventListener('pause', () => (playing.value = false))
    }
    audio.volume = volume.value
    return audio
  }

  async function load(): Promise<void> {
    const data = await loadStore<MusicData>('music')
    tracks.value = data.tracks ?? []
    volume.value = data.volume ?? 0.6
    loop.value = data.loop ?? 'all'
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('music', {
      tracks: tracks.value,
      volume: volume.value,
      loop: loop.value
    })
  }

  function play(id?: string): void {
    const target = id ?? currentId.value ?? tracks.value[0]?.id
    if (!target) return
    const track = tracks.value.find((t) => t.id === target)
    if (!track) return
    const changed = currentId.value !== track.id
    currentId.value = track.id
    const a = ensureAudio()
    if (changed) a.src = window.api.media.url(track.path)
    void a.play().catch(() => undefined)
  }

  function pause(): void {
    audio?.pause()
    playing.value = false
  }

  function toggle(): void {
    if (playing.value) pause()
    else play()
  }

  function indexOfCurrent(): number {
    return tracks.value.findIndex((t) => t.id === currentId.value)
  }

  function next(): void {
    if (tracks.value.length === 0) return
    const i = indexOfCurrent()
    play(tracks.value[(i + 1) % tracks.value.length].id)
  }

  function prev(): void {
    if (tracks.value.length === 0) return
    const i = indexOfCurrent()
    play(tracks.value[(i - 1 + tracks.value.length) % tracks.value.length].id)
  }

  function handleEnded(): void {
    if (loop.value === 'one') play(currentId.value ?? undefined)
    else if (loop.value === 'all') next()
    else playing.value = false
  }

  function setVolume(v: number): void {
    volume.value = v
    if (audio) audio.volume = v
    void persist()
  }

  function setLoop(mode: LoopMode): void {
    loop.value = mode
    void persist()
  }

  async function importTracks(): Promise<void> {
    const paths = await window.api.dialog.openFiles([
      { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }
    ])
    for (const p of paths) {
      const name = (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, '')
      tracks.value.push({ id: uid(), name, path: p })
    }
    if (paths.length) void persist()
  }

  async function addByUrl(url: string): Promise<boolean> {
    const path = await window.api.media.download(url)
    if (!path) return false
    const name = (url.split('/').pop() ?? '在线音乐').split('?')[0].replace(/\.[^.]+$/, '') || '在线音乐'
    tracks.value.push({ id: uid(), name, path })
    void persist()
    return true
  }

  async function searchOnline(keyword: string): Promise<OnlineTrack[]> {
    return (await window.api.online.search(keyword)) as OnlineTrack[]
  }

  /** 自动获取在线轻音乐列表填充推荐区 */
  async function loadOnlineList(keyword = AUTO_MUSIC_KEYWORD): Promise<void> {
    onlineLoading.value = true
    onlineError.value = ''
    try {
      onlineTracks.value = (await window.api.online.search(keyword)) as OnlineTrack[]
      if (!onlineTracks.value.length) onlineError.value = '未获取到在线轻音乐，请检查网络或手动添加'
    } catch {
      onlineTracks.value = []
      onlineError.value = '在线轻音乐获取失败，请检查网络后刷新'
    } finally {
      onlineLoading.value = false
    }
  }

  /** 一键导入网易云/QQ 音乐歌单：解析结果填入在线列表 */
  async function importPlaylist(url: string): Promise<{ ok: boolean; count: number; error?: string }> {
    onlineLoading.value = true
    onlineError.value = ''
    try {
      const res = await window.api.playlist.import(url)
      if (res.ok && res.tracks && res.tracks.length) {
        onlineTracks.value = res.tracks as OnlineTrack[]
        return { ok: true, count: res.tracks.length }
      }
      onlineError.value = res.error || '歌单导入失败'
      return { ok: false, count: 0, error: res.error }
    } catch {
      onlineError.value = '歌单导入失败，请检查链接或网络'
      return { ok: false, count: 0, error: '歌单导入失败' }
    } finally {
      onlineLoading.value = false
    }
  }

  /** 收藏在线曲目：下载到本地入库，返回新曲目 id（失败返回空串） */
  async function addOnline(track: OnlineTrack): Promise<string> {
    const path = await window.api.media.download(track.url)
    if (!path) return ''
    const id = uid()
    const name = track.artist ? `${track.name} - ${track.artist}` : track.name
    tracks.value.push({ id, name, path })
    void persist()
    return id
  }

  /** 播放在线轻音乐：下载入库后立即播放 */
  async function playOnline(track: OnlineTrack): Promise<boolean> {
    const id = await addOnline(track)
    if (!id) return false
    play(id)
    return true
  }

  function remove(id: string): void {
    tracks.value = tracks.value.filter((t) => t.id !== id)
    if (currentId.value === id) {
      pause()
      currentId.value = null
    }
    void persist()
  }

  return {
    tracks,
    currentId,
    current,
    playing,
    volume,
    loop,
    loaded,
    onlineTracks,
    onlineLoading,
    onlineError,
    load,
    play,
    pause,
    toggle,
    next,
    prev,
    setVolume,
    setLoop,
    importTracks,
    addByUrl,
    searchOnline,
    addOnline,
    playOnline,
    loadOnlineList,
    importPlaylist,
    remove
  }
})
