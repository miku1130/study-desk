/**
 * 公网自习室客户端：通过 wss 连到自建服务器。
 *
 * 与局域网模式最大的区别是权威归属——这里服务器才是权威，本地只做镜像。
 *
 * 两个概念务必分清，UI 文案也要跟着分：
 *   - 加入 / 退出「自习室」改变的是成员身份，账号级别，关掉应用也还在；
 *   - 进入 / 离开「房间」只是今天来不来学，走了仍然是成员。
 */

import { WebSocket } from 'ws'
import {
  STUDY_ROOM_PROTOCOL_VERSION,
  sanitizeCatId,
  sanitizeNickname,
  type StudyRoomFocusReport
} from './protocol'

export type OnlineStatus = 'idle' | 'connecting' | 'online' | 'error'
export type LeaderboardRange = 'today' | 'week' | 'month'

export interface RoomBrief {
  id: string
  code?: string
  name: string
  intro: string
  memberCount: number
  attendeeCount: number
  focusingCount?: number
  isOwner?: boolean
}

export interface RoomMemberView {
  deviceId: string
  nickname: string
  catId: string
  intro: string
  seconds: number
  streakDays: number
  totalDays: number
  wakeAt: string
  sleepAt: string
  rank: number
  online: boolean
  focusing: boolean
}

export interface RoomDetail {
  id: string
  code: string
  name: string
  intro: string
  goalMinutes: number
  memberCount: number
  attendeeCount: number
  focusingCount: number
  isOwner: boolean
  isMember: boolean
  range: LeaderboardRange
  members: RoomMemberView[]
}

export interface WishView {
  id: number
  nickname: string
  catId: string
  text: string
  createdAt: number
  mine: boolean
}

export interface OnlineSnapshot {
  status: OnlineStatus
  error: string
  deviceId: string
  intro: string
  checkin: { wakeAt: string; sleepAt: string }
  myRooms: RoomBrief[]
  browse: RoomBrief[]
  room: RoomDetail | null
  wishes: WishView[]
}

export interface OnlineRoomDeps {
  url: string
  deviceId: string
  getNickname: () => string
  getCatId: () => string
  getFocus: () => StudyRoomFocusReport
  onChanged: () => void
  onNotice: (kind: string, text: string) => void
  onCheer: (cheerId: string, fromDeviceId: string, fromNickname: string, toDeviceId: string) => void
  socketFactory?: (url: string) => WebSocket
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30_000

export class OnlineRoomClient {
  private socket: WebSocket | null = null
  private status: OnlineStatus = 'idle'
  private error = ''
  private intro = ''
  private checkin = { wakeAt: '', sleepAt: '' }
  private myRooms: RoomBrief[] = []
  private browse: RoomBrief[] = []
  private room: RoomDetail | null = null
  private wishes: WishView[] = []
  private watchingBrowse = false
  private range: LeaderboardRange = 'today'
  /** 断线前所在的房间，重连后自动回去继续今天的学习 */
  private lastRoomId = ''
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private disposed = false
  private manualClose = false
  private pending: Array<Record<string, unknown>> = []

  constructor(private readonly deps: OnlineRoomDeps) {}

  snapshot(): OnlineSnapshot {
    return {
      status: this.status,
      error: this.error,
      deviceId: this.deps.deviceId,
      intro: this.intro,
      checkin: { ...this.checkin },
      myRooms: this.myRooms.map((r) => ({ ...r })),
      browse: this.browse.map((r) => ({ ...r })),
      room: this.room ? { ...this.room, members: this.room.members.map((m) => ({ ...m })) } : null,
      wishes: this.wishes.map((w) => ({ ...w }))
    }
  }

  isInRoom(): boolean {
    return Boolean(this.room)
  }

  /* ---------------------------------------------------------------- *
   * 连接
   * ---------------------------------------------------------------- */

  connect(): void {
    if (this.disposed) return
    if (this.socket && (this.status === 'connecting' || this.status === 'online')) return
    this.manualClose = false
    this.status = 'connecting'
    this.error = ''
    this.deps.onChanged()

    let socket: WebSocket
    try {
      socket = this.deps.socketFactory
        ? this.deps.socketFactory(this.deps.url)
        : new WebSocket(this.deps.url)
    } catch (err) {
      this.failAndRetry(`无法连接自习室服务器：${String(err)}`)
      return
    }
    this.socket = socket

    socket.on('open', () => {
      this.reconnectAttempt = 0
      this.write({
        t: 'hello',
        v: STUDY_ROOM_PROTOCOL_VERSION,
        deviceId: this.deps.deviceId,
        nickname: sanitizeNickname(this.deps.getNickname()),
        catId: sanitizeCatId(this.deps.getCatId())
      })
      if (this.watchingBrowse) this.write({ t: 'rooms:browse' })
      if (this.lastRoomId) this.write({ t: 'room:enter', roomId: this.lastRoomId })
      const queued = this.pending
      this.pending = []
      for (const msg of queued) this.write(msg)
    })
    socket.on('message', (data: unknown) => this.handle(String(data)))
    socket.on('error', () => {
      /* 关闭逻辑统一走 close */
    })
    socket.on('close', () => {
      this.socket = null
      this.room = null
      if (this.manualClose || this.disposed) {
        this.status = 'idle'
        this.deps.onChanged()
        return
      }
      this.failAndRetry('与自习室服务器的连接已断开，正在重连…')
    })
  }

  disconnect(): void {
    this.manualClose = true
    this.lastRoomId = ''
    this.clearReconnect()
    this.socket?.close()
    this.socket = null
    this.status = 'idle'
    this.room = null
    this.wishes = []
    this.error = ''
    this.deps.onChanged()
  }

  dispose(): void {
    this.disposed = true
    this.disconnect()
  }

  /* ---------------------------------------------------------------- *
   * 动作
   * ---------------------------------------------------------------- */

  watchBrowse(on: boolean): void {
    this.watchingBrowse = on
    if (on) this.request({ t: 'rooms:browse' })
  }

  refreshMyRooms(): void {
    this.request({ t: 'rooms:mine' })
  }

  setIntro(intro: string): void {
    this.request({ t: 'profile', intro })
  }

  checkInAt(kind: 'wake' | 'sleep', time: string): void {
    this.request({ t: 'checkin', kind, time })
  }

  createRoom(name: string, intro: string, goalMinutes: number): void {
    this.request({ t: 'room:create', name, intro, goalMinutes })
  }

  /** 加入自习室：成为成员，账号级别的关系 */
  joinRoom(params: { roomId?: string; code?: string }): void {
    this.request({ t: 'room:join', roomId: params.roomId ?? '', code: params.code ?? '' })
  }

  /** 退出自习室：解除成员关系 */
  quitRoom(roomId: string): void {
    this.request({ t: 'room:quit', roomId })
  }

  dissolveRoom(roomId: string): void {
    this.request({ t: 'room:dissolve', roomId })
  }

  updateRoom(roomId: string, patch: { name?: string; intro?: string; goalMinutes?: number }): void {
    this.request({ t: 'room:meta', roomId, ...patch })
  }

  /** 进入房间：今天来这里学习 */
  enterRoom(roomId: string): void {
    this.lastRoomId = roomId
    this.request({ t: 'room:enter', roomId })
    this.request({ t: 'wish:list', roomId })
  }

  /** 离开房间：只是今天不学了，成员身份不变 */
  exitRoom(): void {
    this.lastRoomId = ''
    this.request({ t: 'room:exit' })
  }

  setRange(range: LeaderboardRange): void {
    this.range = range
    if (this.room) this.request({ t: 'room:members', roomId: this.room.id, range })
  }

  reportFocus(): void {
    if (!this.room) return
    this.write({ t: 'focus', focus: this.deps.getFocus() })
  }

  cheer(toDeviceId: string, cheerId: string): void {
    this.request({ t: 'cheer', toDeviceId, cheerId })
  }

  addWish(text: string): void {
    if (!this.room) return
    this.request({ t: 'wish:add', roomId: this.room.id, text })
  }

  reportWish(id: number): void {
    this.request({ t: 'wish:report', id, roomId: this.room?.id ?? '' })
  }

  deleteWish(id: number): void {
    this.request({ t: 'wish:delete', id, roomId: this.room?.id ?? '' })
  }

  /* ---------------------------------------------------------------- *
   * 内部
   * ---------------------------------------------------------------- */

  /** 未连上时先排队，连上后按顺序补发，避免用户点了没反应 */
  private request(payload: Record<string, unknown>): void {
    if (this.status === 'online') {
      this.write(payload)
      return
    }
    this.pending.push(payload)
    if (this.pending.length > 20) this.pending.shift()
    this.connect()
  }

  private write(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    try {
      this.socket.send(JSON.stringify(payload))
    } catch {
      /* 断开由 close 事件统一善后 */
    }
  }

  private handle(raw: string): void {
    let msg: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      msg = parsed as Record<string, unknown>
    } catch {
      return
    }

    switch (msg.t) {
      case 'welcome': {
        this.status = 'online'
        this.error = ''
        this.intro = String(msg.intro ?? '')
        const checkin = (msg.checkin ?? {}) as Record<string, unknown>
        this.checkin = {
          wakeAt: String(checkin.wakeAt ?? ''),
          sleepAt: String(checkin.sleepAt ?? '')
        }
        this.deps.onChanged()
        return
      }
      case 'profile': {
        this.intro = String(msg.intro ?? '')
        this.deps.onChanged()
        return
      }
      case 'checkin': {
        this.checkin = { wakeAt: String(msg.wakeAt ?? ''), sleepAt: String(msg.sleepAt ?? '') }
        this.deps.onChanged()
        return
      }
      case 'rooms:mine': {
        this.myRooms = toBriefs(msg.rooms)
        this.deps.onChanged()
        return
      }
      case 'rooms:browse': {
        this.browse = toBriefs(msg.rooms)
        this.deps.onChanged()
        return
      }
      case 'room:created':
      case 'room:joined': {
        // 建好或加入后直接进去，省一次点击
        this.enterRoom(String(msg.roomId ?? ''))
        return
      }
      case 'room:detail': {
        this.room = toDetail(msg)
        this.deps.onChanged()
        return
      }
      case 'room:entered': {
        this.lastRoomId = String(msg.roomId ?? '')
        return
      }
      case 'room:exited':
      case 'room:quit': {
        this.lastRoomId = ''
        this.room = null
        this.wishes = []
        this.deps.onChanged()
        return
      }
      case 'room:dissolved': {
        this.lastRoomId = ''
        this.room = null
        this.wishes = []
        this.deps.onNotice('closed', '这个自习室已被主人解散')
        this.deps.onChanged()
        return
      }
      case 'wish:list': {
        this.wishes = Array.isArray(msg.wishes)
          ? (msg.wishes as WishView[]).map((w) => ({
              id: Number(w.id) || 0,
              nickname: sanitizeNickname(w.nickname),
              catId: sanitizeCatId(w.catId),
              text: String(w.text ?? ''),
              createdAt: Number(w.createdAt) || 0,
              mine: Boolean(w.mine)
            }))
          : []
        this.deps.onChanged()
        return
      }
      case 'wish:changed': {
        if (this.room) this.write({ t: 'wish:list', roomId: this.room.id })
        return
      }
      case 'notice': {
        this.deps.onNotice(String(msg.kind ?? ''), String(msg.text ?? ''))
        return
      }
      case 'cheered': {
        this.deps.onCheer(
          String(msg.cheerId ?? ''),
          String(msg.fromDeviceId ?? ''),
          sanitizeNickname(msg.fromNickname),
          String(msg.toDeviceId ?? '')
        )
        return
      }
      case 'error': {
        this.error = String(msg.message ?? '操作失败')
        // 服务端的拒绝要让用户看见，否则点了按钮像是坏了
        this.deps.onNotice('error', this.error)
        this.deps.onChanged()
        return
      }
      default:
        return
    }
  }

  private failAndRetry(message: string): void {
    this.status = 'error'
    this.error = message
    this.deps.onChanged()
    if (this.disposed || this.manualClose) return
    this.clearReconnect()
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

function toBriefs(raw: unknown): RoomBrief[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: String(r.id ?? ''),
      code: r.code ? String(r.code) : undefined,
      name: String(r.name ?? ''),
      intro: String(r.intro ?? ''),
      memberCount: num(r.memberCount),
      attendeeCount: num(r.attendeeCount),
      focusingCount: num(r.focusingCount),
      isOwner: Boolean(r.isOwner)
    }
  })
}

function toDetail(msg: Record<string, unknown>): RoomDetail {
  const room = (msg.room ?? {}) as Record<string, unknown>
  const range = msg.range === 'week' || msg.range === 'month' ? msg.range : 'today'
  const members = Array.isArray(msg.members) ? msg.members : []
  return {
    id: String(room.id ?? ''),
    code: String(room.code ?? ''),
    name: String(room.name ?? ''),
    intro: String(room.intro ?? ''),
    goalMinutes: num(room.goalMinutes),
    memberCount: num(room.memberCount),
    attendeeCount: num(room.attendeeCount),
    focusingCount: num(room.focusingCount),
    isOwner: Boolean(room.isOwner),
    isMember: Boolean(room.isMember),
    range,
    members: members.map((item) => {
      const m = (item ?? {}) as Record<string, unknown>
      return {
        deviceId: String(m.deviceId ?? ''),
        nickname: sanitizeNickname(m.nickname),
        catId: sanitizeCatId(m.catId),
        intro: String(m.intro ?? ''),
        seconds: num(m.seconds),
        streakDays: num(m.streakDays),
        totalDays: num(m.totalDays),
        wakeAt: String(m.wakeAt ?? ''),
        sleepAt: String(m.sleepAt ?? ''),
        rank: num(m.rank),
        online: Boolean(m.online),
        focusing: Boolean(m.focusing)
      }
    })
  }
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
