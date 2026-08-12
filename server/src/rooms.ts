/**
 * 公网自习室的房间与大厅管理。
 *
 * 这里是唯一权威状态：客户端只做镜像。整个模块不依赖 socket 与计时器，
 * 时间由外部注入，因此房主顺延、随机匹配、限流都能直接单测。
 */

import {
  STUDY_ROOM_MAX_FOCUS_STEP_SEC,
  STUDY_ROOM_MAX_MEMBERS,
  isCheerId,
  sanitizeCatId,
  sanitizeNickname,
  sanitizeRoomName,
  validateRoomName
} from '../../src/main/studyRoom/protocol'

export type RoomPhase = 'idle' | 'work' | 'short' | 'long'

export interface FocusReport {
  phase: RoomPhase
  running: boolean
  remaining: number
  todayPomodoros: number
  todayFocusMinutes: number
}

export interface Member {
  id: string
  nickname: string
  catId: string
  /** 进房序号，决定座位顺序与房主顺延次序 */
  seq: number
  focus: FocusReport
  /** 本次在房内的专注秒数，由服务端按真实时间戳累计 */
  roomFocusSeconds: number
  cheers: number
  lastCheerAt: number
  lastSampleAt: number
  counting: boolean
}

export interface Room {
  id: string
  name: string
  hostId: string
  goalMinutes: number
  createdAt: number
  goalReached: boolean
  /** 建房者 IP，销毁时据此 O(1) 归还配额 */
  ownerIp: string
  /** 全房累计专注秒数，增量维护；每次上报都全量求和的话是白付一次 O(n) */
  totalFocusSeconds: number
  /** Map 保持插入顺序，即进房顺序 */
  members: Map<string, Member>
}

export interface LobbyEntry {
  id: string
  name: string
  memberCount: number
  maxMembers: number
  focusingCount: number
  focusMinutes: number
  /** 排序用；人数与专注时长都相同时按开房先后定序 */
  createdAt: number
}

export interface RoomSnapshot {
  id: string
  name: string
  hostId: string
  goalMinutes: number
  memberCount: number
  focusMinutes: number
  goalReached: boolean
}

export type RoomsEvent =
  | { type: 'roster'; roomId: string }
  | { type: 'lobby' }
  | { type: 'notice'; roomId: string; kind: NoticeKind; text: string }
  | { type: 'goal'; roomId: string; goalMinutes: number }

export type NoticeKind = 'join' | 'leave' | 'host' | 'goal'

export interface Failure {
  ok: false
  code: ErrorCode
  message: string
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ALREADY_IN_ROOM'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'INVALID_NAME'
  | 'RATE_LIMITED'
  | 'HOST_LIMIT'

/** 同一 IP 同时只能持有 1 个房间，10 分钟内最多创建 3 个 */
export const CREATE_WINDOW_MS = 10 * 60 * 1000
export const CREATE_MAX_PER_WINDOW = 3
/** 限流日志全表回收的最小间隔 */
export const SWEEP_INTERVAL_MS = 5 * 60 * 1000

/** 随机匹配偏好的人数区间：有氛围但不嘈杂 */
const SWEET_SPOT_MIN = 2
const SWEET_SPOT_MAX = 6

const DEFAULT_FOCUS: FocusReport = {
  phase: 'idle',
  running: false,
  remaining: 0,
  todayPomodoros: 0,
  todayFocusMinutes: 0
}

export interface RoomsOptions {
  now?: () => number
  /** 注入随机数便于测试确定化 */
  random?: () => number
  idFactory?: () => string
}

let autoSeq = 0

function defaultId(): string {
  autoSeq += 1
  return `${Date.now().toString(36)}${autoSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export class Rooms {
  private readonly rooms = new Map<string, Room>()
  /** memberId -> roomId */
  private readonly memberRoom = new Map<string, string>()
  /** ip -> 创建时间戳列表，用于频率限制 */
  private readonly createLog = new Map<string, number[]>()
  /** ip -> 该 IP 当前持有的房间 id 集合 */
  private readonly ownedRooms = new Map<string, Set<string>>()
  private readonly now: () => number
  private readonly random: () => number
  private readonly newId: () => string
  private autoRoomSeq = 0
  private lastSweepAt = 0

  constructor(options: RoomsOptions = {}) {
    this.now = options.now ?? Date.now
    this.random = options.random ?? Math.random
    this.newId = options.idFactory ?? defaultId
  }

  /* ---------------------------------------------------------------- *
   * 查询
   * ---------------------------------------------------------------- */

  get size(): number {
    return this.rooms.size
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  roomOf(memberId: string): Room | undefined {
    const roomId = this.memberRoom.get(memberId)
    return roomId ? this.rooms.get(roomId) : undefined
  }

  /** 大厅列表：人数降序 → 累计专注降序 → 创建时间升序 */
  lobby(): LobbyEntry[] {
    const list: LobbyEntry[] = []
    for (const room of this.rooms.values()) {
      if (room.members.size === 0) continue
      // 一次遍历同时算出专注人数，避免每个房间被扫两遍
      let focusing = 0
      for (const m of room.members.values()) {
        if (m.focus.running && m.focus.phase === 'work') focusing++
      }
      list.push({
        id: room.id,
        name: room.name,
        memberCount: room.members.size,
        maxMembers: STUDY_ROOM_MAX_MEMBERS,
        focusingCount: focusing,
        focusMinutes: Math.floor(room.totalFocusSeconds / 60),
        createdAt: room.createdAt
      })
    }
    // 比较函数里不再回查 Map，否则每次比较都要付两次查找
    return list.sort(
      (a, b) =>
        b.memberCount - a.memberCount ||
        b.focusMinutes - a.focusMinutes ||
        a.createdAt - b.createdAt
    )
  }

  snapshot(room: Room): RoomSnapshot {
    return {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      goalMinutes: room.goalMinutes,
      memberCount: room.members.size,
      focusMinutes: this.roomFocusMinutes(room),
      goalReached: room.goalReached
    }
  }

  /** 座位顺序即进房顺序。Map 本身保持插入顺序，seq 也随插入递增，无需再排序 */
  roster(room: Room): Member[] {
    return [...room.members.values()]
  }

  /* ---------------------------------------------------------------- *
   * 创建 / 加入 / 离开
   * ---------------------------------------------------------------- */

  create(
    params: { memberId: string; nickname: string; catId: string; ip: string; name: string; goalMinutes: number }
  ): { ok: true; room: Room; events: RoomsEvent[] } | Failure {
    if (this.memberRoom.has(params.memberId)) {
      return fail('ALREADY_IN_ROOM', '你已经在一个自习室里了')
    }
    const nameCheck = validateRoomName(params.name)
    if (!nameCheck.ok) return fail('INVALID_NAME', nameCheck.reason)

    const limit = this.checkCreateLimit(params.ip)
    if (limit) return limit

    return { ok: true, ...this.spawnRoom(params.ip, nameCheck.value, params.goalMinutes, params) }
  }

  join(
    params: { memberId: string; nickname: string; catId: string; roomId: string }
  ): { ok: true; room: Room; events: RoomsEvent[] } | Failure {
    if (this.memberRoom.has(params.memberId)) {
      return fail('ALREADY_IN_ROOM', '你已经在一个自习室里了')
    }
    const room = this.rooms.get(params.roomId)
    if (!room) return fail('ROOM_NOT_FOUND', '自习室不存在或已解散')
    if (room.members.size >= STUDY_ROOM_MAX_MEMBERS) return fail('ROOM_FULL', '自习室已满员')

    const member = this.addMember(room, params)
    return {
      ok: true,
      room,
      events: [
        { type: 'roster', roomId: room.id },
        { type: 'lobby' },
        { type: 'notice', roomId: room.id, kind: 'join', text: `${member.nickname} 来了` }
      ]
    }
  }

  /**
   * 随机加入。优先人数适中的房间，其次帮落单的人凑伴；
   * 一个可用房间都没有时自动开一个，否则冷启动阶段用户会直接被劝退。
   */
  quickJoin(
    params: { memberId: string; nickname: string; catId: string; ip: string }
  ): { ok: true; room: Room; events: RoomsEvent[]; created: boolean } | Failure {
    if (this.memberRoom.has(params.memberId)) {
      return fail('ALREADY_IN_ROOM', '你已经在一个自习室里了')
    }
    const open = [...this.rooms.values()].filter(
      (room) => room.members.size > 0 && room.members.size < STUDY_ROOM_MAX_MEMBERS
    )
    const tiers = [
      open.filter((r) => r.members.size >= SWEET_SPOT_MIN && r.members.size <= SWEET_SPOT_MAX),
      open.filter((r) => r.members.size === 1),
      open.filter((r) => r.members.size > SWEET_SPOT_MAX)
    ]
    const candidates = tiers.find((tier) => tier.length > 0)

    if (candidates) {
      const picked = candidates[Math.floor(this.random() * candidates.length) % candidates.length]
      const result = this.join({ ...params, roomId: picked.id })
      return result.ok ? { ...result, created: false } : result
    }

    // 自动开房走系统预设名，避免随机加入被当成第二个建房入口
    this.autoRoomSeq += 1
    const spawned = this.spawnRoom(params.ip, `一起自习 ${this.autoRoomSeq}`, 120, params)
    return { ok: true, ...spawned, created: true }
  }

  /** 离开房间。房主离开时顺延给进房顺序次位，最后一人离开则销毁房间。 */
  leave(memberId: string): { room: Room | null; events: RoomsEvent[]; destroyed: boolean } {
    const room = this.roomOf(memberId)
    if (!room) return { room: null, events: [], destroyed: false }

    const member = room.members.get(memberId)
    room.members.delete(memberId)
    this.memberRoom.delete(memberId)

    const events: RoomsEvent[] = []
    if (member) {
      events.push({
        type: 'notice',
        roomId: room.id,
        kind: 'leave',
        text: `${member.nickname} 离开了`
      })
    }

    if (room.members.size === 0) {
      this.destroyRoom(room)
      events.push({ type: 'lobby' })
      return { room, events, destroyed: true }
    }

    if (room.hostId === memberId) {
      const next = this.roster(room)[0]
      room.hostId = next.id
      events.push({
        type: 'notice',
        roomId: room.id,
        kind: 'host',
        text: `${next.nickname} 成为新房主`
      })
    }

    events.push({ type: 'roster', roomId: room.id }, { type: 'lobby' })
    return { room, events, destroyed: false }
  }

  /* ---------------------------------------------------------------- *
   * 房内行为
   * ---------------------------------------------------------------- */

  setGoal(memberId: string, goalMinutes: number): { ok: true; events: RoomsEvent[] } | Failure {
    const room = this.roomOf(memberId)
    if (!room) return fail('NOT_IN_ROOM', '你不在任何自习室里')
    if (room.hostId !== memberId) return fail('NOT_HOST', '只有房主可以设置目标')
    const next = Math.max(0, Math.min(24 * 60, Math.floor(goalMinutes) || 0))
    room.goalMinutes = next
    room.goalReached = false
    return { ok: true, events: [{ type: 'roster', roomId: room.id }] }
  }

  /**
   * 专注状态上报。房内专注时长完全由服务端按两次上报的真实间隔累计，
   * 单步封顶，客户端无法伪造大额时长。
   */
  reportFocus(memberId: string, focus: FocusReport): RoomsEvent[] {
    const room = this.roomOf(memberId)
    const member = room?.members.get(memberId)
    if (!room || !member) return []

    const now = this.now()
    if (member.counting && member.lastSampleAt > 0) {
      const gapSec = Math.floor((now - member.lastSampleAt) / 1000)
      if (gapSec > 0) {
        const step = Math.min(gapSec, STUDY_ROOM_MAX_FOCUS_STEP_SEC)
        member.roomFocusSeconds += step
        room.totalFocusSeconds += step
      }
    }
    member.focus = normalizeFocus(focus)
    member.counting = member.focus.running && member.focus.phase === 'work'
    member.lastSampleAt = now

    const events: RoomsEvent[] = [{ type: 'roster', roomId: room.id }]
    if (
      !room.goalReached &&
      room.goalMinutes > 0 &&
      this.roomFocusMinutes(room) >= room.goalMinutes
    ) {
      room.goalReached = true
      events.push({ type: 'goal', roomId: room.id, goalMinutes: room.goalMinutes })
      events.push({
        type: 'notice',
        roomId: room.id,
        kind: 'goal',
        text: `集体目标 ${room.goalMinutes} 分钟达成`
      })
    }
    return events
  }

  cheer(
    memberId: string,
    cheerId: string,
    toId: string
  ): { ok: true; room: Room; from: Member; toId: string } | Failure {
    const room = this.roomOf(memberId)
    const from = room?.members.get(memberId)
    if (!room || !from) return fail('NOT_IN_ROOM', '你不在任何自习室里')
    if (!isCheerId(cheerId)) return fail('INVALID_NAME', '不支持的加油动作')

    const now = this.now()
    if (now - from.lastCheerAt < 3000) return fail('RATE_LIMITED', '加油太快了，歇一下')

    const target = toId ? room.members.get(toId) : null
    if (toId && !target) return fail('NOT_IN_ROOM', '对方已经离开了')

    from.lastCheerAt = now
    if (target) target.cheers += 1
    else for (const m of room.members.values()) if (m !== from) m.cheers += 1

    return { ok: true, room, from, toId: target ? target.id : '' }
  }

  /* ---------------------------------------------------------------- *
   * 内部
   * ---------------------------------------------------------------- */

  private spawnRoom(
    ip: string,
    name: string,
    goalMinutes: number,
    who: { memberId: string; nickname: string; catId: string }
  ): { room: Room; events: RoomsEvent[] } {
    const room: Room = {
      id: this.newId(),
      name: sanitizeRoomName(name),
      hostId: who.memberId,
      goalMinutes: Math.max(0, Math.min(24 * 60, Math.floor(goalMinutes) || 0)),
      createdAt: this.now(),
      goalReached: false,
      ownerIp: ip,
      totalFocusSeconds: 0,
      members: new Map()
    }
    this.rooms.set(room.id, room)
    this.addMember(room, who)

    const owned = this.ownedRooms.get(ip) ?? new Set<string>()
    owned.add(room.id)
    this.ownedRooms.set(ip, owned)
    const log = this.createLog.get(ip) ?? []
    log.push(this.now())
    this.createLog.set(ip, log)

    return { room, events: [{ type: 'roster', roomId: room.id }, { type: 'lobby' }] }
  }

  private addMember(
    room: Room,
    who: { memberId: string; nickname: string; catId: string }
  ): Member {
    const member: Member = {
      id: who.memberId,
      nickname: this.uniqueNickname(room, sanitizeNickname(who.nickname)),
      catId: sanitizeCatId(who.catId),
      seq: room.members.size,
      focus: { ...DEFAULT_FOCUS },
      roomFocusSeconds: 0,
      cheers: 0,
      lastCheerAt: 0,
      lastSampleAt: this.now(),
      counting: false
    }
    room.members.set(member.id, member)
    this.memberRoom.set(member.id, room.id)
    return member
  }

  private destroyRoom(room: Room): void {
    this.rooms.delete(room.id)
    const owned = this.ownedRooms.get(room.ownerIp)
    if (owned) {
      owned.delete(room.id)
      if (owned.size === 0) this.ownedRooms.delete(room.ownerIp)
    }
  }

  private checkCreateLimit(ip: string): Failure | null {
    if ((this.ownedRooms.get(ip)?.size ?? 0) > 0) {
      return fail('HOST_LIMIT', '你已经开了一个自习室，先解散它再开新的')
    }
    this.sweepCreateLog()
    const now = this.now()
    const recent = (this.createLog.get(ip) ?? []).filter((at) => now - at < CREATE_WINDOW_MS)
    if (recent.length === 0) this.createLog.delete(ip)
    else this.createLog.set(ip, recent)
    if (recent.length >= CREATE_MAX_PER_WINDOW) {
      return fail('RATE_LIMITED', '创建太频繁了，过一会儿再试')
    }
    return null
  }

  /**
   * 限流日志按 IP 存，只在该 IP 再次建房时清理的话，来过一次的 IP 会永久占位。
   * 服务端是长跑进程，必须定期全表回收。
   */
  sweepCreateLog(): void {
    const now = this.now()
    if (now - this.lastSweepAt < SWEEP_INTERVAL_MS) return
    this.lastSweepAt = now
    for (const [ip, log] of this.createLog) {
      const recent = log.filter((at) => now - at < CREATE_WINDOW_MS)
      if (recent.length === 0) this.createLog.delete(ip)
      else this.createLog.set(ip, recent)
    }
  }

  private uniqueNickname(room: Room, base: string): string {
    const taken = new Set([...room.members.values()].map((m) => m.nickname))
    if (!taken.has(base)) return base
    for (let n = 2; ; n++) {
      const candidate = `${base}·${n}`
      if (!taken.has(candidate)) return candidate
    }
  }

  private roomFocusMinutes(room: Room): number {
    return Math.floor(room.totalFocusSeconds / 60)
  }
}

function fail(code: ErrorCode, message: string): Failure {
  return { ok: false, code, message }
}

function normalizeFocus(raw: FocusReport): FocusReport {
  const phase: RoomPhase =
    raw?.phase === 'work' || raw?.phase === 'short' || raw?.phase === 'long' ? raw.phase : 'idle'
  return {
    phase,
    running: Boolean(raw?.running),
    remaining: clampInt(raw?.remaining, 0, 24 * 3600),
    todayPomodoros: clampInt(raw?.todayPomodoros, 0, 999),
    todayFocusMinutes: clampInt(raw?.todayFocusMinutes, 0, 24 * 60)
  }
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
