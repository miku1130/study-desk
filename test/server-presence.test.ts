import { describe, it, expect, beforeEach } from 'vitest'
import { Presence, type FocusReport } from '../server/src/presence'

const focus = (over: Partial<FocusReport> = {}): FocusReport => ({
  phase: 'work',
  running: true,
  remaining: 1500,
  todayPomodoros: 0,
  todayFocusMinutes: 0,
  ...over
})

let clock = 1_700_000_000_000
let accrued: Array<{ deviceId: string; seconds: number }>
let presence: Presence

beforeEach(() => {
  clock = 1_700_000_000_000
  accrued = []
  presence = new Presence({
    now: () => clock,
    onFocusAccrued: (deviceId, seconds) => accrued.push({ deviceId, seconds })
  })
})

const enter = (conn: string, device: string, roomId = 'room-1'): void => {
  presence.enter({ connectionId: conn, deviceId: device, nickname: '同学', catId: 'mikan', roomId })
}

describe('在座与成员是两回事', () => {
  it('离开房间只结束在座，不涉及任何成员关系', () => {
    enter('c1', 'd1')
    expect(presence.attendeeCount('room-1')).toBe(1)

    const left = presence.leave('c1')
    expect(left.roomId).toBe('room-1')
    expect(presence.attendeeCount('room-1')).toBe(0)
    // Presence 里根本没有成员的概念，退出房间不可能误删成员身份
    expect(presence.roomOf('c1')).toBe('')
  })

  it('同一个人换房时自动离开原来的房间', () => {
    enter('c1', 'd1', 'room-1')
    enter('c1', 'd1', 'room-2')
    expect(presence.attendeeCount('room-1')).toBe(0)
    expect(presence.attendeeCount('room-2')).toBe(1)
  })

  it('同一个人开两个客户端算两条在座记录', () => {
    enter('c1', 'd1')
    enter('c2', 'd1')
    expect(presence.attendeeCount('room-1')).toBe(2)
  })

  it('最后一人离开时房间条目被回收，但这不代表自习室解散', () => {
    enter('c1', 'd1')
    presence.leave('c1')
    expect(presence.activeRoomIds()).toEqual([])
  })
})

describe('座位顺序与在座统计', () => {
  it('按进入先后排座', () => {
    enter('c1', 'd1')
    clock += 1000
    enter('c2', 'd2')
    clock += 1000
    enter('c3', 'd3')
    expect(presence.attendees('room-1').map((a) => a.deviceId)).toEqual(['d1', 'd2', 'd3'])
  })

  it('只统计正在专注的人', () => {
    enter('c1', 'd1')
    enter('c2', 'd2')
    presence.reportFocus('c1', focus())
    presence.reportFocus('c2', focus({ phase: 'short' }))
    expect(presence.focusingCount('room-1')).toBe(1)
  })
})

describe('专注计时', () => {
  it('按真实间隔累计并单步封顶', () => {
    enter('c1', 'd1')
    presence.reportFocus('c1', focus())
    clock += 10_000
    presence.reportFocus('c1', focus())
    // 客户端长时间静默后再上报，只按封顶值计入
    clock += 600_000
    presence.reportFocus('c1', focus())

    const total = accrued.reduce((s, a) => s + a.seconds, 0)
    expect(total).toBe(25)
    expect(accrued.every((a) => a.deviceId === 'd1')).toBe(true)
  })

  it('休息阶段不计时', () => {
    enter('c1', 'd1')
    presence.reportFocus('c1', focus({ phase: 'short' }))
    clock += 60_000
    presence.reportFocus('c1', focus({ phase: 'short' }))
    expect(accrued).toHaveLength(0)
  })

  it('不在座的连接上报不产生任何累计', () => {
    presence.reportFocus('ghost', focus())
    expect(accrued).toHaveLength(0)
  })
})

describe('加油', () => {
  it('白名单外的动作被拒', () => {
    enter('c1', 'd1')
    expect(presence.cheer('c1', 'buy-now', '').ok).toBe(false)
  })

  it('3 秒冷却', () => {
    enter('c1', 'd1')
    enter('c2', 'd2')
    expect(presence.cheer('c1', 'fighting', '').ok).toBe(true)
    expect(presence.cheer('c1', 'fighting', '').ok).toBe(false)
    clock += 3000
    expect(presence.cheer('c1', 'fighting', '').ok).toBe(true)
  })

  it('对全体加油时发送者自己不计数', () => {
    enter('c1', 'd1')
    enter('c2', 'd2')
    enter('c3', 'd3')
    presence.cheer('c1', 'clap', '')
    const map = new Map(presence.attendees('room-1').map((a) => [a.deviceId, a.cheers]))
    expect(map.get('d1')).toBe(0)
    expect(map.get('d2')).toBe(1)
    expect(map.get('d3')).toBe(1)
  })

  it('对已离开的人加油会被拒', () => {
    enter('c1', 'd1')
    enter('c2', 'd2')
    presence.leave('c2')
    expect(presence.cheer('c1', 'fighting', 'd2').ok).toBe(false)
  })
})
