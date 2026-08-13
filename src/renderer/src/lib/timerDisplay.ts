/**
 * 各处计时卡片显示什么，统一在这里算。
 *
 * 侧边栏、锁屏、时钟浮窗、桌面浮窗、猫咪挂件、番茄钟主卡片都要显示同一个计时，
 * 各自算一遍就会出现「主界面在正计时、浮窗停在 00:00」这种自相矛盾。
 *
 * 一条容易踩的规则：正计时与不计时只作用于**专注段**，休息一律有终点。
 * 所以判断该显示剩余还是已过，看的是当前阶段有没有 total，而不是看模式。
 */
import type { PomodoroMode, PomodoroPhase } from '@/types'

export interface TimerState {
  phase: PomodoroPhase
  mode: PomodoroMode
  remaining: number
  elapsed: number
  total: number
  running: boolean
}

export interface TimerFace {
  /** 主数字，如 25:00；不计时的专注段为空串 */
  clock: string
  /** 没有数字时给的替代文案 */
  label: string
  /** 翻页钟 / 像素样式要的四位；分钟超过两位时为 null，让调用方回退成文本 */
  digits: [string, string, string, string] | null
  seconds: number
}

function clamp(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function format(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * @param idleSeconds 空闲时要展示的时长（倒计时是计划时长，其余为 0）
 */
export function timerFace(state: TimerState, idleSeconds = 0): TimerFace {
  if (state.phase === 'idle') return face(clamp(idleSeconds), '')
  // 不计时的意义就是别盯着数字看，所以专注段不给
  if (state.mode === 'untimed' && state.phase === 'work') {
    return { clock: '', label: '在学', digits: null, seconds: clamp(state.elapsed) }
  }
  const counting = state.total > 0
  return face(clamp(counting ? state.remaining : state.elapsed), '')
}

function face(seconds: number, label: string): TimerFace {
  const clock = format(seconds)
  const digits =
    clock.length === 5
      ? ([clock[0], clock[1], clock[3], clock[4]] as [string, string, string, string])
      : null
  return { clock, label, digits, seconds }
}
