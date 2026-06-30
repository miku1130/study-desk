import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LoopMode, MusicData, MusicTrack } from '@/types'
import { uid } from '@/types'
import { loadStore, saveStore } from '@/lib/persist'

type NoiseType = 'white' | 'pink' | 'brown'

// 内置离线默认：WebAudio 生成的噪音，无需任何文件 / 网络
const BUILTIN_TRACKS: MusicTrack[] = [
  { id: 'noise-white', name: '白噪音（内置）', path: 'builtin:white' },
  { id: 'noise-pink', name: '粉噪音（内置）', path: 'builtin:pink' },
  { id: 'noise-brown', name: '棕噪音（内置）', path: 'builtin:brown' }
]

function isBuiltin(path: string): boolean {
  return path.startsWith('builtin:')
}

function makeNoiseBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  } else if (type === 'pink') {
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  return buf
}

export const useMusicStore = defineStore('music', () => {
  const tracks = ref<MusicTrack[]>([...BUILTIN_TRACKS])
  const currentId = ref<string | null>(null)
  const playing = ref(false)
  const volume = ref(0.6)
  const loop = ref<LoopMode>('all')
  const loaded = ref(false)

  let audio: HTMLAudioElement | null = null
  let noiseCtx: AudioContext | null = null
  let noiseSrc: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null

  const current = computed(() => tracks.value.find((t) => t.id === currentId.value) ?? null)

  function ensureAudio(): HTMLAudioElement {
    if (!audio) {
      audio = new Audio()
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('play', () => (playing.value = true))
      audio.addEventListener('pause', () => {
        if (!noiseSrc) playing.value = false
      })
    }
    audio.volume = volume.value
    return audio
  }

  function stopNoise(): void {
    if (noiseSrc) {
      try {
        noiseSrc.stop()
      } catch {
        /* 已停止 */
      }
      noiseSrc.disconnect()
      noiseSrc = null
    }
    if (noiseGain) {
      noiseGain.disconnect()
      noiseGain = null
    }
  }

  function startNoise(type: NoiseType): void {
    stopNoise()
    if (!noiseCtx) noiseCtx = new AudioContext()
    const ctx = noiseCtx
    void ctx.resume()
    noiseGain = ctx.createGain()
    noiseGain.gain.value = volume.value
    noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = makeNoiseBuffer(ctx, type)
    noiseSrc.loop = true
    noiseSrc.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseSrc.start()
    playing.value = true
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
      startNoise(track.path.slice('builtin:'.length) as NoiseType)
    } else {
      stopNoise()
      const a = ensureAudio()
      if (changed) a.src = window.api.media.url(track.path)
      void a.play().catch(() => undefined)
    }
  }

  function pause(): void {
    audio?.pause()
    stopNoise()
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
    if (noiseGain) noiseGain.gain.value = v
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
