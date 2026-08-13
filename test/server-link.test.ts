import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FocusStats, LINK_CODE_TTL_MS } from '../server/src/stats'

const NOON = new Date(2026, 7, 13, 12, 0, 0).getTime()
let clock = NOON
let db: FocusStats

beforeEach(() => {
  clock = NOON
  db = new FocusStats({ filePath: ':memory:', now: () => clock })
})

afterEach(() => db.close())

describe('配对码', () => {
  it('是六位数字，够短能念给自己听', () => {
    const { code } = db.createLinkCode('phone')
    expect(code).toMatch(/^\d{6}$/)
  })

  it('同一台设备再要一次会换新码，旧码立刻作废', () => {
    const first = db.createLinkCode('phone').code
    const second = db.createLinkCode('phone').code
    expect(second).not.toBe(first)
    expect(db.claimLinkCode(first, 'laptop').ok).toBe(false)
    expect(db.claimLinkCode(second, 'laptop').ok).toBe(true)
  })

  it('过期的码不能用', () => {
    const { code } = db.createLinkCode('phone')
    clock += LINK_CODE_TTL_MS + 1
    const result = db.claimLinkCode(code, 'laptop')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('过期')
  })

  it('用过一次就作废，不能被第三台设备再认领', () => {
    const { code } = db.createLinkCode('phone')
    expect(db.claimLinkCode(code, 'laptop').ok).toBe(true)
    expect(db.claimLinkCode(code, 'stranger').ok).toBe(false)
  })

  it('乱输的码只是失败，不会炸', () => {
    expect(db.claimLinkCode('000000', 'laptop').ok).toBe(false)
    expect(db.claimLinkCode('', 'laptop').ok).toBe(false)
  })

  it('不能把自己连到自己', () => {
    const { code } = db.createLinkCode('phone')
    const result = db.claimLinkCode(code, 'phone')
    expect(result.ok).toBe(false)
  })
})

describe('身份合并', () => {
  const DAY = 24 * 3600 * 1000

  it('两台设备的专注时长按天相加', () => {
    db.addFocus('phone', 1200)
    db.addFocus('laptop', 1800)

    const { code } = db.createLinkCode('phone')
    const result = db.claimLinkCode(code, 'laptop')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.primary).toBe('phone')
    expect(db.secondsIn('phone', 'today')).toBe(3000)
  })

  it('累计天数按并集算，同一天在两台设备学过只算一天', () => {
    db.addFocus('phone', 600)
    clock += DAY
    db.addFocus('phone', 600)
    db.addFocus('laptop', 600)
    clock += DAY
    db.addFocus('laptop', 600)

    const { code } = db.createLinkCode('phone')
    db.claimLinkCode(code, 'laptop')

    const row = db.leaderboard('month', 'phone').self
    // 三天各有记录：并集是 3 天，连续也是 3 天
    expect(row?.totalDays).toBe(3)
    expect(row?.streakDays).toBe(3)
  })

  it('自习室成员关系一并带过去，重复的不会变成两条', () => {
    const room = db.createRoom({
      id: 'r1', code: 'CODE1', ownerDevice: 'owner', name: '自习室', intro: '', goalMinutes: 60
    })
    expect(room.ok).toBe(true)
    db.joinRoom('r1', 'phone')
    db.joinRoom('r1', 'laptop')
    db.addRoomFocus('r1', 'laptop', 900)

    const { code } = db.createLinkCode('phone')
    db.claimLinkCode(code, 'laptop')

    expect(db.myRooms('phone').map((r) => r.id)).toEqual(['r1'])
    expect(db.getRoom('r1')?.memberCount).toBe(2)
    // 房内贡献也要跟过来，不然换台电脑战绩就归零了
    expect(db.roomRecord('r1', 'phone').mySeconds).toBe(900)
  })

  it('旧设备的档案清干净，不会在榜上留一条幽灵', () => {
    db.touchProfile('laptop', '旧设备', 'mikan')
    db.addFocus('laptop', 600)
    db.touchProfile('phone', '我', 'cloud')

    const { code } = db.createLinkCode('phone')
    db.claimLinkCode(code, 'laptop')

    const board = db.leaderboard('today')
    expect(board.rows.map((r) => r.deviceId)).toEqual(['phone'])
    expect(db.secondsIn('laptop', 'today')).toBe(0)
  })

  it('打卡记录合并时保留最早那次，不给刷时间的机会', () => {
    db.checkIn('laptop', 'wake', '06:30')
    db.checkIn('phone', 'wake', '09:00')

    const { code } = db.createLinkCode('phone')
    db.claimLinkCode(code, 'laptop')

    expect(db.todayCheckin('phone').wakeAt).toBe('06:30')
  })
})
