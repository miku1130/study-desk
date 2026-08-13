import { describe, expect, it } from 'vitest'
import {
  NOISE_SCENES,
  fillNoise,
  isNoiseScene,
  shouldPlayAmbience
} from '../src/renderer/src/lib/noise'

describe('白噪音场景表', () => {
  it('每个场景都有唯一 id 和说明', () => {
    const ids = NOISE_SCENES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(NOISE_SCENES.every((s) => s.label && s.desc)).toBe(true)
  })

  it('只认识表里的场景，脏数据当作关闭', () => {
    expect(isNoiseScene('rain')).toBe(true)
    expect(isNoiseScene('')).toBe(false)
    expect(isNoiseScene('drop table')).toBe(false)
  })
})

describe('噪音波形', () => {
  const sample = (kind: 'white' | 'pink' | 'brown'): Float32Array => {
    const data = new Float32Array(8192)
    fillNoise(data, kind)
    return data
  }

  const roughness = (data: Float32Array): number => {
    let sum = 0
    for (let i = 1; i < data.length; i++) sum += Math.abs(data[i] - data[i - 1])
    return sum / (data.length - 1)
  }

  it.each(['white', 'pink', 'brown'] as const)('%s 噪音不越界也不出 NaN', (kind) => {
    const data = sample(kind)
    expect(data.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)).toBe(true)
  })

  it.each(['white', 'pink', 'brown'] as const)('%s 噪音确实在动，不是一条直线', (kind) => {
    expect(roughness(sample(kind))).toBeGreaterThan(0)
  })

  it('越往低频走波形越平滑：白 > 粉 > 棕', () => {
    expect(roughness(sample('white'))).toBeGreaterThan(roughness(sample('pink')))
    expect(roughness(sample('pink'))).toBeGreaterThan(roughness(sample('brown')))
  })
})

describe('什么时候该响', () => {
  const on = { scene: 'rain', volume: 0.5, duringBreak: false }

  it('没选场景就永远不响', () => {
    const off = { scene: '', volume: 0.5, duringBreak: true }
    expect(shouldPlayAmbience(off, { phase: 'work', running: true })).toBe(false)
  })

  it('专注进行中才响，暂停就停', () => {
    expect(shouldPlayAmbience(on, { phase: 'work', running: true })).toBe(true)
    expect(shouldPlayAmbience(on, { phase: 'work', running: false })).toBe(false)
  })

  it('休息默认安静，打开开关后休息也继续', () => {
    expect(shouldPlayAmbience(on, { phase: 'short', running: true })).toBe(false)
    expect(shouldPlayAmbience({ ...on, duringBreak: true }, { phase: 'short', running: true })).toBe(
      true
    )
    expect(shouldPlayAmbience({ ...on, duringBreak: true }, { phase: 'long', running: true })).toBe(
      true
    )
  })

  it('还没开始计时时不响，免得一进页面就出声', () => {
    expect(shouldPlayAmbience({ ...on, duringBreak: true }, { phase: 'idle', running: false })).toBe(
      false
    )
  })
})
