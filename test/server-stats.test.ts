import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  FocusStats,
  DAILY_CAP_SECONDS,
  RETAIN_DAYS,
  dayKey,
  effectiveStreak,
  monthStart,
  previousDay,
  rangeBounds,
  weekStart
} from '../server/src/stats'

/** 固定到一个周四中午，避开周末与月初月末的巧合 */
const THURSDAY = new Date(2026, 7, 13, 12, 0, 0).getTime()

let clock = THURSDAY
let stats: FocusStats

const atDay = (offset: number): number => {
  const d = new Date(THURSDAY)
  d.setDate(d.getDate() + offset)
  return d.getTime()
}

beforeEach(() => {
  clock = THURSDAY
  stats = new FocusStats({ filePath: ':memory:', now: () => clock })
})

afterEach(() => {
  stats.close()
})

describe('日期推导', () => {
  it('周一为一周之始', () => {
    // 2026-08-13 是周四，本周一应为 08-10
    expect(dayKey(weekStart(THURSDAY))).toBe('2026-08-10')
  })

  it('周一当天的周起点是它自己', () => {
    const monday = new Date(2026, 7, 10, 9, 0, 0).getTime()
    expect(dayKey(weekStart(monday))).toBe('2026-08-10')
  })

  it('周日归属上一周而不是下一周', () => {
    const sunday = new Date(2026, 7, 16, 23, 30, 0).getTime()
    expect(dayKey(weekStart(sunday))).toBe('2026-08-10')
  })

  it('月起点是当月 1 号', () => {
    expect(dayKey(monthStart(THURSDAY))).toBe('2026-08-01')
  })

  it('前一天能跨月', () => {
    expect(previousDay('2026-08-01')).toBe('2026-07-31')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
    // 2028 是闰年
    expect(previousDay('2028-03-01')).toBe('2028-02-29')
  })

  it('三个维度的范围边界', () => {
    expect(rangeBounds('today', THURSDAY)).toEqual({ from: '2026-08-13', to: '2026-08-13' })
    expect(rangeBounds('week', THURSDAY)).toEqual({ from: '2026-08-10', to: '2026-08-13' })
    expect(rangeBounds('month', THURSDAY)).toEqual({ from: '2026-08-01', to: '2026-08-13' })
  })
})

describe('effectiveStreak', () => {
  it('今天学过，连续有效', () => {
    expect(effectiveStreak(7, '2026-08-13', '2026-08-13')).toBe(7)
  })

  it('昨天学过今天还没学，连续仍然有效（今天还有机会续上）', () => {
    expect(effectiveStreak(7, '2026-08-12', '2026-08-13')).toBe(7)
  })

  it('停了两天就算断了', () => {
    expect(effectiveStreak(7, '2026-08-11', '2026-08-13')).toBe(0)
  })

  it('从未专注过', () => {
    expect(effectiveStreak(0, '', '2026-08-13')).toBe(0)
  })
})

describe('累计与排行', () => {
  it('同日多次上报累加到同一天', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    stats.addFocus('d1', 600)
    stats.addFocus('d1', 300)
    expect(stats.secondsIn('d1', 'today')).toBe(900)
  })

  it('按时长降序排名，并列同名次', () => {
    stats.touchProfile('a', '甲', 'mikan')
    stats.touchProfile('b', '乙', 'cloud')
    stats.touchProfile('c', '丙', 'sesame')
    stats.addFocus('a', 900)
    stats.addFocus('b', 900)
    stats.addFocus('c', 300)

    const board = stats.leaderboard('today')
    expect(board.rows.map((r) => r.rank)).toEqual([1, 1, 3])
    expect(board.rows[2].nickname).toBe('丙')
  })

  it('自己未上榜时也返回名次为 0 的自身行', () => {
    stats.touchProfile('a', '甲', 'mikan')
    stats.addFocus('a', 600)
    stats.touchProfile('me', '我', 'cloud')

    const board = stats.leaderboard('today', 'me')
    expect(board.self).not.toBeNull()
    expect(board.self?.rank).toBe(0)
    expect(board.self?.seconds).toBe(0)
    expect(board.self?.nickname).toBe('我')
  })

  it('本周只统计本周，本月只统计本月', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    // 上周三（本周之外，但在本月内）
    clock = atDay(-8)
    stats.addFocus('d1', 3600)
    // 本周一
    clock = atDay(-3)
    stats.addFocus('d1', 1800)
    clock = THURSDAY
    stats.addFocus('d1', 600)

    expect(stats.secondsIn('d1', 'today')).toBe(600)
    expect(stats.secondsIn('d1', 'week')).toBe(2400)
    expect(stats.secondsIn('d1', 'month')).toBe(6000)
  })

  it('单日累计封顶', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (let i = 0; i < 30; i++) stats.addFocus('d1', 3600)
    expect(stats.secondsIn('d1', 'today')).toBe(DAILY_CAP_SECONDS)
  })

  it('昵称与猫咪走同一套清洗', () => {
    stats.touchProfile('d1', '加微信vx123', '../../etc/passwd')
    stats.addFocus('d1', 600)
    const row = stats.leaderboard('today').rows[0]
    expect(row.nickname).toBe('同学')
    expect(row.catId).toBe('mikan')
  })
})

describe('连续天数与累计天数', () => {
  it('连着几天就是几天', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (const offset of [-4, -3, -2, -1, 0]) {
      clock = atDay(offset)
      stats.addFocus('d1', 600)
    }
    clock = THURSDAY
    const self = stats.leaderboard('today', 'd1').self
    expect(self?.streakDays).toBe(5)
    expect(self?.totalDays).toBe(5)
  })

  it('中间断一天，连续从头算但累计天数继续涨', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (const offset of [-5, -4, -3]) {
      clock = atDay(offset)
      stats.addFocus('d1', 600)
    }
    // 跳过 -2，隔了两天再来
    for (const offset of [-1, 0]) {
      clock = atDay(offset)
      stats.addFocus('d1', 600)
    }
    clock = THURSDAY
    const self = stats.leaderboard('today', 'd1').self
    expect(self?.streakDays).toBe(2)
    expect(self?.totalDays).toBe(5)
  })

  it('同一天反复上报不会重复计入天数', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (let i = 0; i < 10; i++) stats.addFocus('d1', 60)
    const self = stats.leaderboard('today', 'd1').self
    expect(self?.streakDays).toBe(1)
    expect(self?.totalDays).toBe(1)
  })

  it('停超过一天后，展示的连续天数归零', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (const offset of [-5, -4, -3]) {
      clock = atDay(offset)
      stats.addFocus('d1', 600)
    }
    clock = THURSDAY // 距最后一次已隔两天
    const self = stats.leaderboard('today', 'd1').self
    expect(self?.streakDays).toBe(0)
    // 但累计天数不会因为断了就清零
    expect(self?.totalDays).toBe(3)
  })

  it('清理旧数据后，累计天数与连续天数不受影响', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    for (const offset of [-3, -2, -1, 0]) {
      clock = atDay(offset)
      stats.addFocus('d1', 600)
    }
    clock = THURSDAY
    // 把时间推到超出保留窗口之后再清理，制造「历史被裁掉」的场景
    clock = atDay(RETAIN_DAYS + 10)
    stats.addFocus('d1', 600)
    stats.prune()

    const self = stats.leaderboard('today', 'd1').self
    // 早期的 4 天已从明细里裁掉，但累计天数仍然记得
    expect(self?.totalDays).toBe(5)
  })

  it('未上榜的自己也能看到连续天数', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    clock = atDay(-1)
    stats.addFocus('d1', 600)
    clock = THURSDAY
    // 今天还没学，今日榜上没有成绩，但连续天数要显示出来
    const self = stats.leaderboard('today', 'd1').self
    expect(self?.seconds).toBe(0)
    expect(self?.rank).toBe(0)
    expect(self?.streakDays).toBe(1)
  })
})

describe('数据保留', () => {
  it('清理超出窗口的明细，保留窗口内的', () => {
    stats.touchProfile('d1', '小明', 'mikan')
    clock = atDay(-(RETAIN_DAYS + 5))
    stats.addFocus('d1', 600)
    clock = atDay(-1)
    stats.addFocus('d1', 900)
    clock = THURSDAY

    stats.prune()
    expect(stats.secondsIn('d1', 'month')).toBe(900)
  })
})
