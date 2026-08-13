/**
 * 专注环境音：全部用 WebAudio 现场合成，不带任何音频文件。
 *
 * 装机包已经一百多兆，再塞几段几分钟的环境音录音又是几十兆；而且这类素材的
 * 授权很难说清楚。噪音本来就是随机信号，合成出来不循环、不占空间，也不用联网。
 */
import type { PomodoroPhase } from '@/types'

export interface NoiseScene {
  id: string
  label: string
  desc: string
}

export const NOISE_SCENES: NoiseScene[] = [
  { id: 'rain', label: '下雨', desc: '窗外的雨，偶尔有几滴打在窗沿' },
  { id: 'waves', label: '海浪', desc: '一起一落的潮声，节奏很慢' },
  { id: 'wind', label: '风声', desc: '树林里的风，忽远忽近' },
  { id: 'fire', label: '篝火', desc: '低低的火声，偶尔噼啪一下' },
  { id: 'stream', label: '溪流', desc: '细而清亮的流水声' },
  { id: 'white', label: '白噪音', desc: '最平的一种，盖住环境杂音' },
  { id: 'brown', label: '棕噪音', desc: '低沉厚实，比白噪音柔和' }
]

export function isNoiseScene(id: unknown): boolean {
  return typeof id === 'string' && NOISE_SCENES.some((scene) => scene.id === id)
}

export interface AmbienceConfig {
  scene: string
  volume: number
  /** 休息时也继续放 */
  duringBreak: boolean
}

/** 该不该出声。抽出来是因为这条判断散在组件里最容易出现「暂停了还在响」 */
export function shouldPlayAmbience(
  config: AmbienceConfig,
  state: { phase: PomodoroPhase; running: boolean }
): boolean {
  if (!isNoiseScene(config.scene)) return false
  if (!state.running) return false
  if (state.phase === 'work') return true
  return config.duringBreak && (state.phase === 'short' || state.phase === 'long')
}

export type NoiseKind = 'white' | 'pink' | 'brown'

/**
 * 往缓冲区里填噪音。
 * 白噪音各频段均匀，听着发尖；粉、棕噪音能量往低频压，越低越像自然界的声音。
 */
export function fillNoise(data: Float32Array, kind: NoiseKind): void {
  if (kind === 'white') {
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return
  }
  if (kind === 'brown') {
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = Math.max(-1, Math.min(1, last * 3.5))
    }
    return
  }
  // 粉噪音：Paul Kellet 的经典近似，几个一阶滤波器叠出 -3dB/oct
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
    data[i] = Math.max(-1, Math.min(1, pink))
  }
}

interface SceneShape {
  kind: NoiseKind
  filter: BiquadFilterType
  /** 滤波中心频率 */
  frequency: number
  q: number
  /** 缓慢起伏的周期（秒），0 表示不起伏 */
  swellSeconds: number
  swellDepth: number
  /** 随机点缀：雨滴、火星 */
  spark?: { everyMs: number; frequency: number; decay: number; gain: number; jitter: number }
  gain: number
}

const SHAPES: Record<string, SceneShape> = {
  rain: {
    kind: 'pink',
    filter: 'lowpass',
    frequency: 1600,
    q: 0.6,
    swellSeconds: 13,
    swellDepth: 0.18,
    spark: { everyMs: 900, frequency: 2400, decay: 0.09, gain: 0.05, jitter: 1200 },
    gain: 0.5
  },
  waves: {
    kind: 'brown',
    filter: 'lowpass',
    frequency: 700,
    q: 0.7,
    swellSeconds: 9,
    swellDepth: 0.72,
    gain: 0.85
  },
  wind: {
    kind: 'pink',
    filter: 'bandpass',
    frequency: 520,
    q: 0.9,
    swellSeconds: 7,
    swellDepth: 0.5,
    gain: 0.75
  },
  fire: {
    kind: 'brown',
    filter: 'lowpass',
    frequency: 420,
    q: 0.6,
    swellSeconds: 5,
    swellDepth: 0.22,
    spark: { everyMs: 520, frequency: 1700, decay: 0.05, gain: 0.09, jitter: 700 },
    gain: 0.75
  },
  stream: {
    kind: 'white',
    filter: 'bandpass',
    frequency: 1900,
    q: 0.8,
    swellSeconds: 6,
    swellDepth: 0.2,
    gain: 0.32
  },
  white: { kind: 'white', filter: 'lowpass', frequency: 8000, q: 0.5, swellSeconds: 0, swellDepth: 0, gain: 0.3 },
  brown: { kind: 'brown', filter: 'lowpass', frequency: 1400, q: 0.5, swellSeconds: 0, swellDepth: 0, gain: 0.8 }
}

const BUFFER_SECONDS = 6
const FADE_SECONDS = 1.2

/**
 * 环境音播放器。
 *
 * 起停一律走淡入淡出：环境音突然出现或消失比一直响更让人分心。
 */
export class Ambience {
  private ctx: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private master: GainNode | null = null
  private lfo: OscillatorNode | null = null
  private sparkTimer: number | null = null
  private scene = ''
  private volume = 0.5

  get current(): string {
    return this.scene
  }

  play(scene: string, volume: number): void {
    if (!isNoiseScene(scene)) return this.stop()
    if (this.scene === scene && this.source) return this.setVolume(volume)
    this.stop()

    const shape = SHAPES[scene]
    const ctx = this.context()
    const t0 = ctx.currentTime

    const buffer = ctx.createBuffer(1, ctx.sampleRate * BUFFER_SECONDS, ctx.sampleRate)
    fillNoise(buffer.getChannelData(0), shape.kind)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = shape.filter
    filter.frequency.value = shape.frequency
    filter.Q.value = shape.q

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, t0)
    master.gain.linearRampToValueAtTime(volume * shape.gain, t0 + FADE_SECONDS)

    source.connect(filter)
    filter.connect(master)
    master.connect(ctx.destination)
    source.start(t0)

    // 缓慢起伏：固定音量的噪音听久了很闷，潮声更是全靠这个
    if (shape.swellSeconds > 0) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 1 / shape.swellSeconds
      const depth = ctx.createGain()
      depth.gain.value = volume * shape.gain * shape.swellDepth
      lfo.connect(depth)
      depth.connect(master.gain)
      lfo.start(t0)
      this.lfo = lfo
    }

    if (shape.spark) this.startSparks(shape)

    this.ctx = ctx
    this.source = source
    this.master = master
    this.scene = scene
    this.volume = volume
  }

  setVolume(volume: number): void {
    this.volume = volume
    const shape = SHAPES[this.scene]
    if (!this.ctx || !this.master || !shape) return
    this.master.gain.setTargetAtTime(volume * shape.gain, this.ctx.currentTime, 0.2)
  }

  stop(): void {
    if (this.sparkTimer !== null) {
      window.clearTimeout(this.sparkTimer)
      this.sparkTimer = null
    }
    const ctx = this.ctx
    const source = this.source
    const master = this.master
    const lfo = this.lfo
    this.source = null
    this.master = null
    this.lfo = null
    this.scene = ''
    if (!ctx || !source || !master) return

    const end = ctx.currentTime + FADE_SECONDS * 0.5
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2)
    try {
      source.stop(end)
      lfo?.stop(end)
    } catch {
      /* 已经停了 */
    }
    // 断连接放在停止之后，否则淡出还没走完声音就被切断
    window.setTimeout(() => {
      try {
        source.disconnect()
        master.disconnect()
        lfo?.disconnect()
      } catch {
        /* noop */
      }
    }, FADE_SECONDS * 1000)
  }

  private startSparks(shape: SceneShape): void {
    const spark = shape.spark
    if (!spark) return
    const tick = (): void => {
      const ctx = this.ctx
      if (!ctx || !this.master) return
      const t0 = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = spark.frequency * (0.7 + Math.random() * 0.6)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(spark.gain * this.volume + 0.0001, t0 + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spark.decay)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(t0)
      o.stop(t0 + spark.decay + 0.02)
      this.sparkTimer = window.setTimeout(tick, spark.everyMs + Math.random() * spark.jitter)
    }
    this.sparkTimer = window.setTimeout(tick, spark.everyMs)
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    void this.ctx.resume()
    return this.ctx
  }
}

/** 常驻播放：跟着番茄钟起停，由全局副作用统一控制 */
export const ambience = new Ambience()

let preview: Ambience | null = null
let previewTimer = 0

/**
 * 试听几秒。用独立实例，避免和常驻播放抢同一份状态——
 * 用户在空闲页面点场景，不该把正在计时的那份声音掐掉。
 */
export function previewAmbience(scene: string, volume: number, ms = 4500): void {
  stopPreview()
  if (!isNoiseScene(scene)) return
  preview = new Ambience()
  preview.play(scene, volume)
  previewTimer = window.setTimeout(stopPreview, ms)
}

export function stopPreview(): void {
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = 0
  }
  preview?.stop()
  preview = null
}
