import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LoopMode, MusicData, MusicTrack } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'
import { softMusic } from '@/lib/audio'

// 内置离线轻音乐（WebAudio 生成，舒缓不刺耳）
const BUILTIN_TRACKS: MusicTrack[] = [
  { id: 'soft-piano', name: '轻柔钢琴（内置）', path: 'soft:calm-piano' },
  { id: 'soft-pad', name: '温柔氛围（内置）', path: 'soft:warm-pad' },
  { id: 'soft-lofi', name: '慵懒键盘（内置）', path: 'soft:lofi' }
]

function isBuiltin(path: string): boolean {
  return path.startsWith('soft:')
}

export const useMusicStore = defineStore('music', () => {
  const tracks = ref<MusicTrack[]>([...BUILTIN_TRACKS])
  const currentId = ref<string | null>(null)
  const playing = ref(false)
  const volume = ref(0.6)
  const loop = ref<LoopMode>('all')
  const loaded = ref(false)

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
    tracks.value = [...BUILTIN_TRACKS, ...(data.tracks ?? [])]
    volume.value = data.volume ?? 0.6
    loop.value = data.loop ?? 'all'
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('music', {
      tracks: tracks.value.filter((t) => !isBuiltin(t.path)),
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

    if (isBuiltin(track.path)) {
      audio?.pause()
      softMusic.start(track.path.slice('soft:'.length), volume.value)
      playing.value = true
    } else {
      softMusic.stop()
      const a = ensureAudio()
      if (changed) a.src = window.api.media.url(track.path)
      void a.play().catch(() => undefined)
    }
  }

  function pause(): void {
    audio?.pause()
    softMusic.stop()
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
    softMusic.setVolume(v)
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

  function remove(id: string): void {
    const track = tracks.value.find((t) => t.id === id)
    if (!track || isBuiltin(track.path)) return
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
    isBuiltin,
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
    remove
  }
})
