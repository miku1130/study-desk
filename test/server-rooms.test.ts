import { describe, it, expect, beforeEach } from 'vitest'
import { Rooms, CREATE_MAX_PER_WINDOW, CREATE_WINDOW_MS } from '../server/src/rooms'
import type { FocusReport } from '../server/src/rooms'

const focus = (over: Partial<FocusReport> = {}): FocusReport => ({
  phase: 'work',
  running: true,
  remaining: 1500,
  todayPomodoros: 0,
  todayFocusMinutes: 0,
  ...over
})

let clock = 1_700_000_000_000
let idSeq = 0

function makeRooms(random = (): number => 0): Rooms {
  return new Rooms({
    now: () => clock,
    random,
    idFactory: () => `r${++idSeq}`
  })
}

/** 建一个房并塞入若干名成员，返回房间 id */
function seedRoom(rooms: Rooms, name: string, memberCount: number, ip: string): string {
  const created = rooms.create({
    memberId: `${name}-host`,
    nickname: '房主',
    catId: 'mikan',
    ip,
    name,
    goalMinutes: 120
  })
  if (!created.ok) throw new Error(`建房失败：${created.message}`)
  for (let i = 1; i < memberCount; i++) {
    rooms.join({
      memberId: `${name}-m${i}`,
      nickname: `同学${i}`,
      catId: 'mikan',
      roomId: created.room.id
    })
  }
  return created.room.id
}

beforeEach(() => {
  clock = 1_700_000_000_000
  idSeq = 0
})

describe('大厅排序', () => {
  it('按人数降序', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'small', 1, '1.1.1.1')
    seedRoom(rooms, 'big', 5, '2.2.2.2')
    seedRoom(rooms, 'mid', 3, '3.3.3.3')
    expect(rooms.lobby().map((r) => r.name)).toEqual(['big', 'mid', 'small'])
  })

  it('人数相同时按累计专注时长降序', () => {
    const rooms = makeRooms()
    const quiet = seedRoom(rooms, 'quiet', 2, '1.1.1.1')
    const busy = seedRoom(rooms, 'busy', 2, '2.2.2.2')

    // busy 房的成员先上报一次建立采样起点，再推进时间制造专注时长
    rooms.reportFocus('busy-host', focus())
    clock += 15_000
    rooms.reportFocus('busy-host', focus())
    for (let i = 0; i < 4; i++) {
      clock += 15_000
      rooms.reportFocus('busy-host', focus())
    }

    const lobby = rooms.lobby()
    expect(lobby[0].name).toBe('busy')
    expect(lobby[0].focusMinutes).toBeGreaterThan(0)
    expect(rooms.getRoom(quiet)?.name).toBe('quiet')
  })

  it('空房间不出现在大厅里', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'solo', 1, '1.1.1.1')
    expect(rooms.lobby()).toHaveLength(1)
    rooms.leave('solo-host')
    expect(rooms.lobby()).toHaveLength(0)
  })
})

describe('房主顺延', () => {
  it('房主离开后顺延给进房顺序次位，房间名与目标保留', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 3, '1.1.1.1')
    expect(rooms.getRoom(id)?.hostId).toBe('room-host')

    const result = rooms.leave('room-host')

    expect(result.destroyed).toBe(false)
    const room = rooms.getRoom(id)
    expect(room?.hostId).toBe('room-m1')
    expect(room?.name).toBe('room')
    expect(room?.goalMinutes).toBe(120)
    expect(result.events.some((e) => e.type === 'notice' && e.kind === 'host')).toBe(true)
  })

  it('连续顺延，始终按进房顺序', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 3, '1.1.1.1')
    rooms.leave('room-host')
    rooms.leave('room-m1')
    expect(rooms.getRoom(id)?.hostId).toBe('room-m2')
  })

  it('最后一人离开则销毁房间', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 2, '1.1.1.1')
    rooms.leave('room-host')
    const last = rooms.leave('room-m1')
    expect(last.destroyed).toBe(true)
    expect(rooms.getRoom(id)).toBeUndefined()
  })

  it('非房主离开不改变房主', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 3, '1.1.1.1')
    rooms.leave('room-m2')
    expect(rooms.getRoom(id)?.hostId).toBe('room-host')
  })
})

describe('随机加入', () => {
  it('优先进入 2-6 人的房间', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'solo', 1, '1.1.1.1')
    seedRoom(rooms, 'sweet', 4, '2.2.2.2')
    seedRoom(rooms, 'crowded', 8, '3.3.3.3')

    const result = rooms.quickJoin({ memberId: 'new', nickname: '新人', catId: 'mikan', ip: '9.9.9.9' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.room.name).toBe('sweet')
      expect(result.created).toBe(false)
    }
  })

  it('没有适中房间时进入单人房，帮落单的人凑伴', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'solo', 1, '1.1.1.1')
    seedRoom(rooms, 'crowded', 8, '3.3.3.3')

    const result = rooms.quickJoin({ memberId: 'new', nickname: '新人', catId: 'mikan', ip: '9.9.9.9' })
    expect(result.ok && result.room.name).toBe('solo')
  })

  it('只剩大房间时也能进', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'crowded', 8, '3.3.3.3')
    const result = rooms.quickJoin({ memberId: 'new', nickname: '新人', catId: 'mikan', ip: '9.9.9.9' })
    expect(result.ok && result.room.name).toBe('crowded')
  })

  it('大厅为空时自动建房，而不是把用户挡在门外', () => {
    const rooms = makeRooms()
    const result = rooms.quickJoin({ memberId: 'new', nickname: '新人', catId: 'mikan', ip: '9.9.9.9' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.room.hostId).toBe('new')
      expect(result.room.name).toMatch(/^一起自习/)
    }
  })

  it('满员房间不参与随机匹配', () => {
    const rooms = makeRooms()
    const full = seedRoom(rooms, 'full', 24, '1.1.1.1')
    expect(rooms.getRoom(full)?.members.size).toBe(24)

    const result = rooms.quickJoin({ memberId: 'new', nickname: '新人', catId: 'mikan', ip: '9.9.9.9' })
    expect(result.ok && result.created).toBe(true)
  })
})

describe('加入限制', () => {
  it('满员时拒绝并给出可读理由', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'full', 24, '1.1.1.1')
    const result = rooms.join({ memberId: 'x', nickname: '晚来的', catId: 'mikan', roomId: id })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ROOM_FULL')
  })

  it('房间不存在时拒绝', () => {
    const rooms = makeRooms()
    const result = rooms.join({ memberId: 'x', nickname: '小明', catId: 'mikan', roomId: 'nope' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ROOM_NOT_FOUND')
  })

  it('已在房内时不能重复加入', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 1, '1.1.1.1')
    const again = rooms.join({ memberId: 'room-host', nickname: '房主', catId: 'mikan', roomId: id })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('ALREADY_IN_ROOM')
  })
})

describe('反滥用限流', () => {
  it('同一 IP 同时只能持有一个房间', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'first', 1, '5.5.5.5')
    const second = rooms.create({
      memberId: 'other',
      nickname: '同人',
      catId: 'mikan',
      ip: '5.5.5.5',
      name: 'second',
      goalMinutes: 60
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('HOST_LIMIT')
  })

  it('房间销毁后同一 IP 可以再开', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'first', 1, '5.5.5.5')
    rooms.leave('first-host')
    const again = rooms.create({
      memberId: 'first-host',
      nickname: '房主',
      catId: 'mikan',
      ip: '5.5.5.5',
      name: 'second',
      goalMinutes: 60
    })
    expect(again.ok).toBe(true)
  })

  it('窗口期内创建次数超限被拒', () => {
    const rooms = makeRooms()
    for (let i = 0; i < CREATE_MAX_PER_WINDOW; i++) {
      const created = rooms.create({
        memberId: `u${i}`,
        nickname: '房主',
        catId: 'mikan',
        ip: '6.6.6.6',
        name: `room${i}`,
        goalMinutes: 60
      })
      expect(created.ok).toBe(true)
      rooms.leave(`u${i}`)
    }
    const blocked = rooms.create({
      memberId: 'u-last',
      nickname: '房主',
      catId: 'mikan',
      ip: '6.6.6.6',
      name: 'again',
      goalMinutes: 60
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('RATE_LIMITED')
  })

  it('窗口滑过后恢复', () => {
    const rooms = makeRooms()
    for (let i = 0; i < CREATE_MAX_PER_WINDOW; i++) {
      rooms.create({
        memberId: `u${i}`,
        nickname: '房主',
        catId: 'mikan',
        ip: '6.6.6.6',
        name: `room${i}`,
        goalMinutes: 60
      })
      rooms.leave(`u${i}`)
    }
    clock += CREATE_WINDOW_MS + 1
    const ok = rooms.create({
      memberId: 'u-late',
      nickname: '房主',
      catId: 'mikan',
      ip: '6.6.6.6',
      name: 'later',
      goalMinutes: 60
    })
    expect(ok.ok).toBe(true)
  })

  it('广告房间名被拒绝', () => {
    const rooms = makeRooms()
    const result = rooms.create({
      memberId: 'ad',
      nickname: '推广',
      catId: 'mikan',
      ip: '7.7.7.7',
      name: '加微信vx123',
      goalMinutes: 60
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_NAME')
  })

  it('年份房间名可以正常创建', () => {
    const rooms = makeRooms()
    const result = rooms.create({
      memberId: 'y',
      nickname: '2026考研',
      catId: 'mikan',
      ip: '8.8.8.8',
      name: '2026考研冲刺',
      goalMinutes: 60
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(rooms.roster(result.room)[0].nickname).toBe('2026考研')
    }
  })
})

describe('服务端计时', () => {
  it('专注时长按真实间隔累计，单步封顶 15 秒', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 1, '1.1.1.1')
    rooms.reportFocus('room-host', focus())

    clock += 10_000
    rooms.reportFocus('room-host', focus())
    // 客户端长时间静默后再上报，也只按封顶值计入
    clock += 600_000
    rooms.reportFocus('room-host', focus())

    const room = rooms.getRoom('r1')
    const member = room?.members.get('room-host')
    expect(member?.roomFocusSeconds).toBe(25)
  })

  it('休息阶段不计入专注时长', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 1, '1.1.1.1')
    rooms.reportFocus('room-host', focus({ phase: 'short' }))
    clock += 60_000
    rooms.reportFocus('room-host', focus({ phase: 'short' }))
    expect(rooms.getRoom('r1')?.members.get('room-host')?.roomFocusSeconds).toBe(0)
  })

  it('成员离开后房间累计时长不倒退', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 2, '1.1.1.1')
    rooms.reportFocus('room-m1', focus())
    for (let i = 0; i < 5; i++) {
      clock += 15_000
      rooms.reportFocus('room-m1', focus())
    }
    const before = rooms.lobby()[0].focusMinutes
    expect(before).toBeGreaterThan(0)

    rooms.leave('room-m1')
    // 大家一起学过的时长属于这个房间，不该因为有人退出就回退，否则目标进度条会倒着走
    expect(rooms.lobby()[0].focusMinutes).toBe(before)
  })

  it('达成集体目标只触发一次', () => {
    const rooms = makeRooms()
    const created = rooms.create({
      memberId: 'host',
      nickname: '房主',
      catId: 'mikan',
      ip: '1.1.1.1',
      name: 'goal',
      goalMinutes: 1
    })
    expect(created.ok).toBe(true)

    rooms.reportFocus('host', focus())
    let goalEvents = 0
    for (let i = 0; i < 10; i++) {
      clock += 15_000
      goalEvents += rooms.reportFocus('host', focus()).filter((e) => e.type === 'goal').length
    }
    expect(goalEvents).toBe(1)
  })
})

describe('加油', () => {
  it('白名单外的动作被拒绝', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 2, '1.1.1.1')
    const result = rooms.cheer('room-host', 'buy-now', '')
    expect(result.ok).toBe(false)
  })

  it('3 秒内重复加油被节流', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 2, '1.1.1.1')
    expect(rooms.cheer('room-host', 'fighting', '').ok).toBe(true)
    expect(rooms.cheer('room-host', 'fighting', '').ok).toBe(false)
    clock += 3000
    expect(rooms.cheer('room-host', 'fighting', '').ok).toBe(true)
  })

  it('对全体加油时发送者自己不加计数', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 3, '1.1.1.1')
    rooms.cheer('room-host', 'clap', '')
    const room = rooms.getRoom('r1')
    expect(room?.members.get('room-host')?.cheers).toBe(0)
    expect(room?.members.get('room-m1')?.cheers).toBe(1)
    expect(room?.members.get('room-m2')?.cheers).toBe(1)
  })
})

describe('房主特权', () => {
  it('只有房主能设目标', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 2, '1.1.1.1')
    expect(rooms.setGoal('room-m1', 90).ok).toBe(false)
    expect(rooms.setGoal('room-host', 90).ok).toBe(true)
    expect(rooms.getRoom('r1')?.goalMinutes).toBe(90)
  })

  it('顺延后的新房主拿到设目标权限', () => {
    const rooms = makeRooms()
    seedRoom(rooms, 'room', 2, '1.1.1.1')
    rooms.leave('room-host')
    expect(rooms.setGoal('room-m1', 45).ok).toBe(true)
  })
})

describe('座位顺序', () => {
  it('roster 始终按进房顺序，与加入先后一致', () => {
    const rooms = makeRooms()
    const id = seedRoom(rooms, 'room', 4, '1.1.1.1')
    const room = rooms.getRoom(id)
    if (!room) throw new Error('房间丢失')
    expect(rooms.roster(room).map((m) => m.id)).toEqual([
      'room-host',
      'room-m1',
      'room-m2',
      'room-m3'
    ])
  })

  it('同名成员自动加后缀区分', () => {
    const rooms = makeRooms()
    const created = rooms.create({
      memberId: 'a',
      nickname: '小明',
      catId: 'mikan',
      ip: '1.1.1.1',
      name: 'room',
      goalMinutes: 60
    })
    if (!created.ok) throw new Error('建房失败')
    rooms.join({ memberId: 'b', nickname: '小明', catId: 'mikan', roomId: created.room.id })
    expect(rooms.roster(created.room).map((m) => m.nickname)).toEqual(['小明', '小明·2'])
  })
})
