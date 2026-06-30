import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LoopMode, MusicData, MusicTrack } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

export const useMusicStore = defineStore('music', () => {
  const tracks = ref<MusicTrack[]>([])
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
    tracks.value = data.tracks ?? []
    volume.value = data.volume ?? 0.6
    loop.value = data.loop ?? 'all'
    loaded.value = true
  }

  async function persist(): Promise<void> {
    await saveStore('music', { tracks: tracks.value, volume: volume.value, loop: loop.value })
  }

  function play(id?: string): void {
    const target = id ?? currentId.value ?? tracks.value[0]?.id
    if (!target) return
    const track = tracks.value.find((t) => t.id === target)
    if (!track) return
    const a = ensureAudio()
    if (currentId.value !== track.id) {
      a.src = window.api.media.url(track.path)
      currentId.value = track.id
    }
    void a.play().catch(() => undefined)
  }

  function pause(): void {
    audio?.pause()
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
    load,
    play,
    pause,
    toggle,
    next,
    prev,
    setVolume,
    setLoop,
    importTracks,
    remove
  }
})
