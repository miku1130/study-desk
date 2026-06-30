// 纯 WebAudio 合成：提示音预设 + 生成式舒缓轻音乐（无需任何音频文件）

let ctx: AudioContext | null = null
function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  void ctx.resume()
  return ctx
}

/** 短提示音预设（铃声 / 番茄完成 / 通用提醒） */
export function playChime(id: string, volume = 0.8): void {
  const c = ac()
  const t0 = c.currentTime
  const master = c.createGain()
  master.gain.value = volume
  master.connect(c.destination)

  const note = (freq: number, start: number, dur: number, type: OscillatorType = 'sine'): void => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0 + start)
    g.gain.exponentialRampToValueAtTime(0.9, t0 + start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    o.connect(g)
    g.connect(master)
    o.start(t0 + start)
    o.stop(t0 + start + dur + 0.05)
  }

  switch (id) {
    case 'dingdong':
      note(987.77, 0, 0.7)
      note(659.25, 0.28, 0.9)
      break
    case 'bell':
      note(1318.51, 0, 1.4, 'triangle')
      note(1975.53, 0, 1.2, 'sine')
      break
    case 'marimba':
      note(523.25, 0, 0.35, 'triangle')
      note(659.25, 0.11, 0.35, 'triangle')
      note(783.99, 0.22, 0.5, 'triangle')
      break
    case 'chord':
      note(523.25, 0, 1.0)
      note(659.25, 0, 1.0)
      note(783.99, 0, 1.0)
      break
    default:
      note(880, 0, 0.45)
      note(1174.66, 0.14, 0.5)
  }
}

export const CHIME_PRESETS: { id: string; label: string }[] = [
  { id: 'ding', label: '清脆双音' },
  { id: 'dingdong', label: '叮咚' },
  { id: 'bell', label: '清亮铃声' },
  { id: 'marimba', label: '木琴' },
  { id: 'chord', label: '和弦' }
]

const PROG: number[][] = [
  [261.63, 329.63, 392.0],
  [220.0, 277.18, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66]
]
const ARP = [523.25, 587.33, 659.25, 783.99, 880.0]

/** 生成式舒缓轻音乐：缓和的和弦垫底 + 轻柔琶音，循环演奏。 */
export class SoftMusic {
  private c: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private timer: number | null = null
  private bar = 0
  private volume = 0.6
  private preset = 'calm-piano'

  start(preset: string, volume: number): void {
    this.stop()
    this.preset = preset
    this.volume = volume
    const c = ac()
    this.c = c
    this.filter = c.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 1700
    this.master = c.createGain()
    this.master.gain.value = volume
    this.filter.connect(this.master)
    this.master.connect(c.destination)
    this.bar = 0
    this.playBar()
    this.timer = window.setInterval(() => this.playBar(), 3600)
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  stop(): void {
    if (this.timer) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    if (this.master) {
      try {
        this.master.disconnect()
      } catch {
        /* noop */
      }
      this.master = null
    }
    if (this.filter) {
      try {
        this.filter.disconnect()
      } catch {
        /* noop */
      }
      this.filter = null
    }
  }

  private playBar(): void {
    const c = this.c
    const out = this.filter
    if (!c || !out) return
    const t0 = c.currentTime
    const chord = PROG[this.bar % PROG.length]

    for (const f of chord) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(0.16, t0 + 1.0)
      g.gain.linearRampToValueAtTime(0.12, t0 + 2.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6)
      o.connect(g)
      g.connect(out)
      o.start(t0)
      o.stop(t0 + 3.7)
    }

    if (this.preset !== 'warm-pad') {
      const count = this.preset === 'lofi' ? 3 : 4
      for (let i = 0; i < count; i++) {
        const f = ARP[(this.bar * 2 + i) % ARP.length]
        const start = 0.2 + i * 0.7
        const o = c.createOscillator()
        o.type = 'triangle'
        o.frequency.value = f
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t0 + start)
        g.gain.exponentialRampToValueAtTime(0.22, t0 + start + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.9)
        o.connect(g)
        g.connect(out)
        o.start(t0 + start)
        o.stop(t0 + start + 1.0)
      }
    }
    this.bar++
  }
}

export const softMusic = new SoftMusic()
