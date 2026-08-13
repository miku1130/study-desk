/**
 * 专注统计的唯一写入口。
 *
 * 番茄引擎负责计时，但「这段专注怎么记账」不该散在它里面：
 * 主进程要用今日累计做自习室画像，渲染层要用明细画图表，
 * 各自去读同一份文件、各自解释一遍，迟早出现两个地方数字对不上的情况。
 *
 * 明细（sessions）是事实来源，按日聚合（days）是旧版留下的冗余，
 * 两份都写、读的时候取大的——升级当天两边各记了一半，取小的会凭空少一截。
 */
import { localDateKey } from './time'

export type FocusMode = 'countdown' | 'countup' | 'untimed'

/** 一次专注的明细 */
export interface FocusSession {
  id: string
  startAt: number
  endAt: number
  /** 实际专注分钟数，不是配置里的那个值 */
  minutes: number
  mode: FocusMode
  /** 关联的待办 id，空表示只是单纯计时 */
  targetId: string
  /** 冗余存一份名字，待办删了历史记录也还看得懂 */
  targetName: string
  /** 是否走完了整段，中途放弃为 false */
  completed: boolean
}

export interface DayTotals {
  pomodoros: number
  focusMinutes: number
}

/** 明细上限，按每天 10 次算能存两年多 */
export const SESSION_LIMIT = 8000

/** 只依赖 get/set，方便测试传假实现 */
export interface StatsStoreLike {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

function readSessions(store: StatsStoreLike): FocusSession[] {
  const raw = store.get('sessions')
  return Array.isArray(raw) ? (raw as FocusSession[]) : []
}

function readDays(store: StatsStoreLike): Record<string, DayTotals> {
  const raw = store.get('days')
  return raw && typeof raw === 'object' ? (raw as Record<string, DayTotals>) : {}
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 记一段专注：明细与当日聚合一起更新 */
export function appendSession(
  store: StatsStoreLike,
  session: FocusSession,
  limit = SESSION_LIMIT
): void {
  store.set('sessions', [...readSessions(store), session].slice(-limit))

  const key = localDateKey(new Date(session.startAt))
  const days = readDays(store)
  const day = days[key] ?? { pomodoros: 0, focusMinutes: 0 }
  days[key] = {
    pomodoros: num(day.pomodoros) + (session.completed ? 1 : 0),
    focusMinutes: num(day.focusMinutes) + num(session.minutes)
  }
  store.set('days', days)
}

/** 某一天的累计。明细优先，历史数据用旧聚合兜底 */
export function dayTotals(store: StatsStoreLike, at: number = Date.now()): DayTotals {
  const key = localDateKey(new Date(at))
  const fromSessions = readSessions(store).reduce<DayTotals>(
    (total, session) => {
      if (localDateKey(new Date(num(session.startAt))) !== key) return total
      return {
        pomodoros: total.pomodoros + (session.completed ? 1 : 0),
        focusMinutes: total.focusMinutes + num(session.minutes)
      }
    },
    { pomodoros: 0, focusMinutes: 0 }
  )
  const legacy = readDays(store)[key]
  if (!legacy) return fromSessions
  return {
    pomodoros: Math.max(fromSessions.pomodoros, num(legacy.pomodoros)),
    focusMinutes: Math.max(fromSessions.focusMinutes, num(legacy.focusMinutes))
  }
}
