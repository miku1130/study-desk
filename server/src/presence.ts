/**
 * 在座状态：谁此刻在房间里学习。
 *
 * 这一层与成员关系是两回事，务必分清：
 *   - 成员关系（room_members 表）是账号级别的，加入了就一直是成员，关掉应用也不变；
 *   - 在座（本文件）是今天来不来学习，进出房间随时发生，只活在内存里。
 *
 * 所以这里不创建也不销毁自习室，只记录「谁在座、在座的人当前什么状态」，
 * 广播时也只发给在座的人——999 人的自习室，同时在座的通常只有几十个。
 */

import { STUDY_ROOM_MAX_FOCUS_STEP_SEC, isCheerId, sanitizeCatId, sanitizeNickname } from '../../src/main/studyRoom/protocol'

export type RoomPhase = 'idle' | 'work' | 'short' | 'long'

export interface FocusReport {
  phase: RoomPhase
  running: boolean
  remaining: number
  todayPomodoros: number
  todayFocusMinutes: number
}

/** 一位在座成员的实时状态 */
export interface Attendee {
  /** 连接级 id，同一个人开两个客户端会有两条 */
  connectionId: string
  deviceId: string
  nickname: string
  catId: string
  /** 进入房间的时刻，决定座位顺序 */
  enteredAt: number
  focus: FocusReport
  /** 本次在座期间的专注秒数 */
  sessionSeconds: number
  cheers: number
  lastCheerAt: number
  lastSampleAt: number
  counting: boolean
}

export interface PresenceOptions {
  now?: () => number
  /** 专注增量回调，交给持久层累计到排行榜与房间战绩 */
  onFocusAccrued?: (deviceId: string, seconds: number, roomId: string) => void
}

const DEFAULT_FOCUS: FocusReport = {
  phase: 'idle',
  running: false,
  remaining: 0,
  todayPomodoros: 0,
  todayFocusMinutes: 0
}

export class Presence {
  /** roomId -> connectionId -> Attendee，Map 保持进入顺序 */
  private readonly rooms = new Map<string, Map<string, Attendee>>()
  /** connectionId -> roomId */
  private readonly location = new Map<string, string>()
  private readonly now: () => number
  private readonly onFocusAccrued: (deviceId: string, seconds: number, roomId: string) => void

  constructor(options: PresenceOptions = {}) {
    this.now = options.now ?? Date.now
    this.onFocusAccrued = options.onFocusAccrued ?? ((): void => {})
  }

  roomOf(connectionId: string): string {
    return this.location.get(connectionId) ?? ''
  }

  /** 某个自习室此刻在座的人 */
  attendees(roomId: string): Attendee[] {
    return [...(this.rooms.get(roomId)?.values() ?? [])]
  }

  attendeeCount(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0
  }

  focusingCount(roomId: string): number {
    let count = 0
    for (const a of this.rooms.get(roomId)?.values() ?? []) {
      if (a.focus.running && a.focus.phase === 'work') count++
    }
    return count
  }

  /** 在座的连接 id，用于定向广播 */
  connectionsIn(roomId: string): string[] {
    return [...(this.rooms.get(roomId)?.keys() ?? [])]
  }

  /** 进入房间。同一个人重复进入视为换房 */
  enter(params: {
    connectionId: string
    deviceId: string
    nickname: string
    catId: string
    roomId: string
  }): Attendee {
    this.leave(params.connectionId)
    const attendee: Attendee = {
      connectionId: params.connectionId,
      deviceId: params.deviceId,
      nickname: sanitizeNickname(params.nickname),
      catId: sanitizeCatId(params.catId),
      enteredAt: this.now(),
      focus: { ...DEFAULT_FOCUS },
      sessionSeconds: 0,
      cheers: 0,
      lastCheerAt: 0,
      lastSampleAt: this.now(),
      counting: false
    }
    const room = this.rooms.get(params.roomId) ?? new Map<string, Attendee>()
    room.set(params.connectionId, attendee)
    this.rooms.set(params.roomId, room)
    this.location.set(params.connectionId, params.roomId)
    return attendee
  }

  /**
   * 离开房间。注意这只结束今天的在座，成员关系一点不动——
   * 用户仍然是这个自习室的成员，明天还能回来。
   */
  leave(connectionId: string): { roomId: string; attendee: Attendee | null } {
    const roomId = this.location.get(connectionId)
    if (!roomId) return { roomId: '', attendee: null }
    const room = this.rooms.get(roomId)
    const attendee = room?.get(connectionId) ?? null
    room?.delete(connectionId)
    if (room && room.size === 0) this.rooms.delete(roomId)
    this.location.delete(connectionId)
    return { roomId, attendee }
  }

  /**
   * 专注上报。时长按两次上报的真实间隔累计并单步封顶，
   * 客户端报什么都改不了这个口径。
   */
  reportFocus(connectionId: string, raw: FocusReport): string {
    const roomId = this.location.get(connectionId)
    const attendee = roomId ? this.rooms.get(roomId)?.get(connectionId) : undefined
    if (!roomId || !attendee) return ''

    const now = this.now()
    if (attendee.counting && attendee.lastSampleAt > 0) {
      const gap = Math.floor((now - attendee.lastSampleAt) / 1000)
      if (gap > 0) {
        const step = Math.min(gap, STUDY_ROOM_MAX_FOCUS_STEP_SEC)
        attendee.sessionSeconds += step
        this.onFocusAccrued(attendee.deviceId, step, roomId)
      }
    }
    attendee.focus = normalizeFocus(raw)
    attendee.counting = attendee.focus.running && attendee.focus.phase === 'work'
    attendee.lastSampleAt = now
    return roomId
  }

  cheer(
    connectionId: string,
    cheerId: string,
    toDeviceId: string
  ): { ok: true; roomId: string; from: Attendee; toDeviceId: string } | { ok: false; reason: string } {
    const roomId = this.location.get(connectionId)
    const from = roomId ? this.rooms.get(roomId)?.get(connectionId) : undefined
    if (!roomId || !from) return { ok: false, reason: '你还没进入自习室' }
    if (!isCheerId(cheerId)) return { ok: false, reason: '不支持的加油动作' }

    const now = this.now()
    if (now - from.lastCheerAt < 3000) return { ok: false, reason: '加油太快了，歇一下' }
    from.lastCheerAt = now

    const room = this.rooms.get(roomId)
    if (toDeviceId) {
      let hit = false
      for (const a of room?.values() ?? []) {
        if (a.deviceId === toDeviceId) {
          a.cheers += 1
          hit = true
        }
      }
      if (!hit) return { ok: false, reason: '对方已经离开了' }
    } else {
      for (const a of room?.values() ?? []) if (a !== from) a.cheers += 1
    }
    return { ok: true, roomId, from, toDeviceId }
  }

  /** 有人在座的自习室 id，用于大厅只展示"此刻有人"的房间 */
  activeRoomIds(): string[] {
    return [...this.rooms.keys()]
  }
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
