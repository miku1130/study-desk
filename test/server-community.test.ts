import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  FocusStats,
  JOINED_ROOM_LIMIT,
  WISH_AUTO_HIDE_REPORTS,
  WISH_COOLDOWN_MS,
  checkFreeText
} from '../server/src/stats'

const NOON = new Date(2026, 7, 13, 12, 0, 0).getTime()
let clock = NOON
let db: FocusStats
let roomSeq = 0

const newRoom = (owner: string, over: Partial<{ name: string; intro: string }> = {}): string => {
  roomSeq += 1
  const id = `r${roomSeq}`
  const result = db.createRoom({
    id,
    code: `CODE${roomSeq}`,
    ownerDevice: owner,
    name: over.name ?? `自习室${roomSeq}`,
    intro: over.intro ?? '',
    goalMinutes: 120
  })
  if (!result.ok) throw new Error(`建房失败：${result.reason}`)
  return id
}

beforeEach(() => {
  clock = NOON
  roomSeq = 0
  db = new FocusStats({ filePath: ':memory:', now: () => clock })
})

afterEach(() => db.close())

describe('自由文本过滤', () => {
  it.each(['一战成硕', '今年一定上岸', '每天六点起床', 'Keep going'])('放行正常内容：%s', (t) => {
    expect(checkFreeText(t, 30, '简介').ok).toBe(true)
  })

  it.each([
    '加我微信 abc',
    '看 example.top 有惊喜',
    'qq群 12345',
    '手机13800138000',
    '联系我 987654321'
  ])('拦截推广与联系方式：%s', (t) => {
    expect(checkFreeText(t, 30, '简介').ok).toBe(false)
  })

  it('拦截长串数字（绕过关键词最常见的手法）', () => {
    expect(checkFreeText('我的号 1234567', 30, '愿望').ok).toBe(false)
    // 年份这类短数字仍然要能用
    expect(checkFreeText('2026上岸', 30, '愿望').ok).toBe(true)
  })

  it('空内容给出可行动的提示', () => {
    const r = checkFreeText('   ', 30, '简介')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('简介')
  })

  it('超长内容按上限截断而不是拒绝', () => {
    const r = checkFreeText('好'.repeat(100), 30, '简介')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toHaveLength(30)
  })
})

describe('房间与成员关系', () => {
  it('建房者自动成为成员与房主', () => {
    const id = newRoom('owner')
    const room = db.getRoom(id)
    expect(room?.ownerDevice).toBe('owner')
    expect(room?.memberCount).toBe(1)
    expect(db.isMember(id, 'owner')).toBe(true)
  })

  it('加入后成员关系是持久的，与在线无关', () => {
    const id = newRoom('owner')
    expect(db.joinRoom(id, 'u1').ok).toBe(true)
    expect(db.getRoom(id)?.memberCount).toBe(2)
    // 没有任何「离线即退出」的路径，成员关系只能被显式退出改变
    expect(db.isMember(id, 'u1')).toBe(true)
  })

  it('重复加入不会重复计数', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.joinRoom(id, 'u1')
    expect(db.getRoom(id)?.memberCount).toBe(2)
  })

  it('退出后不再是成员', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.leaveRoom(id, 'u1')
    expect(db.isMember(id, 'u1')).toBe(false)
    expect(db.getRoom(id)?.memberCount).toBe(1)
  })

  it('房主退出时交给最早加入的剩余成员', () => {
    const id = newRoom('owner')
    clock += 1000
    db.joinRoom(id, 'early')
    clock += 1000
    db.joinRoom(id, 'late')

    const result = db.leaveRoom(id, 'owner')
    expect(result.dissolved).toBe(false)
    expect(result.newOwner).toBe('early')
    expect(db.getRoom(id)?.ownerDevice).toBe('early')
  })

  it('最后一人退出才解散，并清掉该房的愿望', () => {
    const id = newRoom('owner')
    db.addWish(id, 'owner', '好好学习')
    const result = db.leaveRoom(id, 'owner')
    expect(result.dissolved).toBe(true)
    expect(db.getRoom(id)).toBeNull()
    expect(db.wishes(id, 'owner')).toHaveLength(0)
  })

  it('主人可以解散，成员关系与愿望一并清掉', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.addWish(id, 'owner', '一起上岸')

    expect(db.dissolveRoom(id, 'owner').ok).toBe(true)
    expect(db.getRoom(id)).toBeNull()
    expect(db.isMember(id, 'u1')).toBe(false)
    expect(db.myRooms('u1')).toHaveLength(0)
    expect(db.wishes(id, 'owner')).toHaveLength(0)
  })

  it('非主人不能解散', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    expect(db.dissolveRoom(id, 'u1').ok).toBe(false)
    expect(db.getRoom(id)).not.toBeNull()
  })

  it('退出自习室不影响其它成员', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.joinRoom(id, 'u2')
    db.leaveRoom(id, 'u1')
    expect(db.isMember(id, 'u2')).toBe(true)
    expect(db.getRoom(id)?.memberCount).toBe(2)
  })

  it('限制同时加入的房间数', () => {
    for (let i = 0; i < JOINED_ROOM_LIMIT; i++) newRoom(`o${i}`)
    for (let i = 0; i < JOINED_ROOM_LIMIT; i++) db.joinRoom(`r${i + 1}`, 'busy')
    const extra = newRoom('spare')
    const blocked = db.joinRoom(extra, 'busy')
    expect(blocked.ok).toBe(false)
  })

  it('按加入码找房间，大小写不敏感', () => {
    const id = newRoom('owner')
    expect(db.getRoomByCode('code1')?.id).toBe(id)
  })

  it('广告房间名被拒绝', () => {
    const bad = db.createRoom({
      id: 'rx',
      code: 'CODEX',
      ownerDevice: 'ad',
      name: '加微信vx123',
      intro: '',
      goalMinutes: 60
    })
    expect(bad.ok).toBe(false)
  })

  it('只有房主能改房间信息', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    expect(db.setRoomMeta(id, 'u1', { intro: '一起加油' }).ok).toBe(false)
    expect(db.setRoomMeta(id, 'owner', { intro: '一起加油' }).ok).toBe(true)
    expect(db.getRoom(id)?.intro).toBe('一起加油')
  })
})

describe('房内榜单', () => {
  it('按时段专注时长排序，并带上真实的连续与累计天数', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.touchProfile('owner', '房主', 'mikan')
    db.touchProfile('u1', '同学', 'cloud')

    // u1 连着两天专注，今天更多
    clock -= 24 * 3600 * 1000
    db.addFocus('u1', 600)
    clock += 24 * 3600 * 1000
    db.addFocus('u1', 1800)
    db.addFocus('owner', 600)

    const rows = db.roomMembers(id, 'today')
    expect(rows[0].deviceId).toBe('u1')
    expect(rows[0].rank).toBe(1)
    expect(rows[0].seconds).toBe(1800)
    expect(rows[0].streakDays).toBe(2)
    expect(rows[0].totalDays).toBe(2)
    expect(rows[1].deviceId).toBe('owner')
  })

  it('分页时名次接着上一页算', () => {
    const id = newRoom('owner')
    for (let i = 0; i < 5; i++) {
      db.joinRoom(id, `u${i}`)
      db.addFocus(`u${i}`, (5 - i) * 600)
    }
    const page2 = db.roomMembers(id, 'today', 2, 2)
    expect(page2[0].rank).toBe(3)
    expect(page2[1].rank).toBe(4)
  })

  it('带出今日打卡时间', () => {
    const id = newRoom('owner')
    db.checkIn('owner', 'wake', '07:21')
    const row = db.roomMembers(id, 'today')[0]
    expect(row.wakeAt).toBe('07:21')
  })
})

describe('作息打卡', () => {
  it('记录起床与睡觉', () => {
    expect(db.checkIn('d1', 'wake', '06:30')).toEqual({ ok: true, value: '06:30' })
    expect(db.checkIn('d1', 'sleep', '23:10')).toEqual({ ok: true, value: '23:10' })
    expect(db.todayCheckin('d1')).toEqual({ wakeAt: '06:30', sleepAt: '23:10' })
  })

  it('同一天重复打卡以第一次为准', () => {
    db.checkIn('d1', 'wake', '06:30')
    const again = db.checkIn('d1', 'wake', '09:00')
    expect(again).toEqual({ ok: true, value: '06:30' })
  })

  it('拒绝非法时间', () => {
    expect(db.checkIn('d1', 'wake', '25:00').ok).toBe(false)
    expect(db.checkIn('d1', 'wake', '7:5').ok).toBe(false)
    expect(db.checkIn('d1', 'wake', 'morning').ok).toBe(false)
  })

  it('跨天后重新计', () => {
    db.checkIn('d1', 'wake', '06:30')
    clock += 24 * 3600 * 1000
    expect(db.todayCheckin('d1').wakeAt).toBe('')
    expect(db.checkIn('d1', 'wake', '07:00').ok).toBe(true)
  })
})

describe('许愿墙', () => {
  it('成员才能发愿', () => {
    const id = newRoom('owner')
    expect(db.addWish(id, 'stranger', '我想上岸').ok).toBe(false)
    expect(db.addWish(id, 'owner', '我想上岸').ok).toBe(true)
  })

  it('发愿有冷却', () => {
    const id = newRoom('owner')
    expect(db.addWish(id, 'owner', '第一个愿望').ok).toBe(true)
    expect(db.addWish(id, 'owner', '第二个愿望').ok).toBe(false)
    clock += WISH_COOLDOWN_MS
    expect(db.addWish(id, 'owner', '过一会儿再来').ok).toBe(true)
  })

  it('带链接或联系方式的愿望发不出去', () => {
    const id = newRoom('owner')
    expect(db.addWish(id, 'owner', '加我qq 123456').ok).toBe(false)
    expect(db.addWish(id, 'owner', '来 my.site 玩').ok).toBe(false)
  })

  it('按时间倒序返回，并标出哪些是自己发的', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    db.addWish(id, 'owner', '早睡早起')
    clock += WISH_COOLDOWN_MS
    db.addWish(id, 'u1', '专业课上90')

    const list = db.wishes(id, 'u1')
    expect(list[0].text).toBe('专业课上90')
    expect(list[0].mine).toBe(true)
    expect(list[1].mine).toBe(false)
  })

  it('举报到阈值自动隐藏', () => {
    const id = newRoom('owner')
    const wish = db.addWish(id, 'owner', '一个愿望')
    if (!wish.ok) throw new Error('发愿失败')

    for (let i = 0; i < WISH_AUTO_HIDE_REPORTS - 1; i++) {
      expect(db.reportWish(wish.id, `reporter${i}`).hidden).toBe(false)
    }
    expect(db.reportWish(wish.id, 'last').hidden).toBe(true)
    expect(db.wishes(id, 'owner')).toHaveLength(0)
  })

  it('同一人重复举报只算一次', () => {
    const id = newRoom('owner')
    const wish = db.addWish(id, 'owner', '一个愿望')
    if (!wish.ok) throw new Error('发愿失败')
    for (let i = 0; i < 5; i++) db.reportWish(wish.id, 'same-person')
    expect(db.wishes(id, 'owner')).toHaveLength(1)
  })

  it('作者与房主可以删，其他人不行', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    clock += WISH_COOLDOWN_MS
    const wish = db.addWish(id, 'u1', '我的愿望')
    if (!wish.ok) throw new Error('发愿失败')

    expect(db.deleteWish(wish.id, 'someone')).toBe(false)
    expect(db.deleteWish(wish.id, 'u1')).toBe(true)
  })

  it('房主可以删别人的', () => {
    const id = newRoom('owner')
    db.joinRoom(id, 'u1')
    clock += WISH_COOLDOWN_MS
    const wish = db.addWish(id, 'u1', '我的愿望')
    if (!wish.ok) throw new Error('发愿失败')
    expect(db.deleteWish(wish.id, 'owner')).toBe(true)
  })
})

describe('个人简介', () => {
  it('设置与读取', () => {
    expect(db.setIntro('d1', '一战成硕').ok).toBe(true)
    expect(db.getIntro('d1')).toBe('一战成硕')
  })

  it('推广内容被拒', () => {
    expect(db.setIntro('d1', '加微信 abc123').ok).toBe(false)
    expect(db.getIntro('d1')).toBe('')
  })

  it('简介会出现在房内榜里', () => {
    const id = newRoom('owner')
    db.touchProfile('owner', '房主', 'mikan')
    db.setIntro('owner', '一战成硕')
    db.addFocus('owner', 600)
    expect(db.roomMembers(id, 'today')[0].intro).toBe('一战成硕')
  })
})
