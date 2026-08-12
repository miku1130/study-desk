/**
 * 公网自习室客户端：通过 wss 连到自建服务器。
 *
 * 与局域网模式最大的区别是权威归属——这里服务器才是权威，本地只做镜像，
 * 因此不需要名册重算、目标判定和掉线检测，那些都由服务端负责。
 */

import { WebSocket } from 'ws'
import {
  STUDY_ROOM_MAX_MEMBERS,
  STUDY_ROOM_PROTOCOL_VERSION,
  sanitizeCatId,
  sanitizeNickname,
  type StudyRoomFocusReport,
  type StudyRoomMemberSnapshot,
  type StudyRoomSummary
} from './protocol'

export interface OnlineLobbyEntry {
  id: string
  name: string
  memberCount: number
  maxMembers: number
  focusingCount: number
  focusMinutes: number
}

export type OnlineStatus = 'idle' | 'connecting' | 'online' | 'error'

export interface OnlineRoomDeps {
  url: string
  getNickname: () => string
  getCatId: () => string
  getFocus: () => StudyRoomFocusReport
  onChanged: () => void
  onNotice: (kind: string, text: string) => void
  onCheer: (cheerId: string, fromId: string, fromNickname: string, toId: string) => void
  onGoal: (goalMinutes: number) => void
  /** 注入以便测试；默认用 ws */
  socketFactory?: (url: string) => WebSocket
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30_000

export class OnlineRoomClient {
  private socket: WebSocket | null = null
  private status: OnlineStatus = 'idle'
  private selfId = ''
  private error = ''
  private lobbyList: OnlineLobbyEntry[] = []
  private room: StudyRoomSummary | null = null
  private members: StudyRoomMemberSnapshot[] = []
  private watchingLobby = false
  /** 断线前所在房间，重连后自动回去 */
  private lastRoomId = ''
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private disposed = false
  private manualClose = false

  constructor(private readonly deps: OnlineRoomDeps) {}

  getStatus(): OnlineStatus {
    return this.status
  }

  getError(): string {
    return this.error
  }

  getSelfId(): string {
    return this.selfId
  }

  getRoom(): StudyRoomSummary | null {
    return this.room
  }

  getMembers(): StudyRoomMemberSnapshot[] {
    return this.members.map((m) => ({ ...m }))
  }

  getLobby(): OnlineLobbyEntry[] {
    return this.lobbyList.map((r) => ({ ...r }))
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
      this.send({
        t: 'hello',
        v: STUDY_ROOM_PROTOCOL_VERSION,
        nickname: sanitizeNickname(this.deps.getNickname()),
        catId: sanitizeCatId(this.deps.getCatId())
      })
      if (this.watchingLobby) this.send({ t: 'lobby' })
      // 断线重连后自动回到原房间，用户不需要重新找一遍
      if (this.lastRoomId) this.send({ t: 'join', roomId: this.lastRoomId })
    })
    socket.on('message', (data: unknown) => this.handle(String(data)))
    socket.on('error', () => {
      /* 关闭逻辑统一走 close */
    })
    socket.on('close', () => {
      this.socket = null
      this.room = null
      this.members = []
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
    this.members = []
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

  watchLobby(on: boolean): void {
    this.watchingLobby = on
    if (on) {
      if (this.status === 'online') this.send({ t: 'lobby' })
      else this.connect()
    }
  }

  createRoom(name: string, goalMinutes: number): void {
    this.ensureConnected(() => this.send({ t: 'create', name, goalMinutes }))
  }

  joinRoom(roomId: string): void {
    this.ensureConnected(() => this.send({ t: 'join', roomId }))
  }

  quickJoin(): void {
    this.ensureConnected(() => this.send({ t: 'quickJoin' }))
  }

  leaveRoom(): void {
    this.lastRoomId = ''
    this.send({ t: 'leave' })
    this.room = null
    this.members = []
    this.deps.onChanged()
  }

  setGoal(goalMinutes: number): void {
    this.send({ t: 'goal', goalMinutes })
  }

  cheer(toId: string, cheerId: string): void {
    this.send({ t: 'cheer', toId, cheerId })
  }

  reportFocus(): void {
    if (!this.room) return
    this.send({ t: 'focus', focus: this.deps.getFocus() })
  }

  /* ---------------------------------------------------------------- *
   * 内部
   * ---------------------------------------------------------------- */

  private ensureConnected(action: () => void): void {
    if (this.status === 'online') {
      action()
      return
    }
    this.pendingAction = action
    this.connect()
  }

  private pendingAction: (() => void) | null = null

  private send(payload: Record<string, unknown>): void {
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
        this.selfId = String(msg.memberId ?? '')
        this.status = 'online'
        this.error = ''
        const pending = this.pendingAction
        this.pendingAction = null
        pending?.()
        this.deps.onChanged()
        return
      }
      case 'lobby': {
        this.lobbyList = Array.isArray(msg.rooms) ? (msg.rooms as OnlineLobbyEntry[]) : []
        this.deps.onChanged()
        return
      }
      case 'joined': {
        this.lastRoomId = String(msg.roomId ?? '')
        this.deps.onChanged()
        return
      }
      case 'left': {
        this.lastRoomId = ''
        this.room = null
        this.members = []
        this.deps.onChanged()
        return
      }
      case 'roster': {
        this.applyRoster(msg)
        return
      }
      case 'notice': {
        this.deps.onNotice(String(msg.kind ?? ''), String(msg.text ?? ''))
        return
      }
      case 'goal': {
        this.deps.onGoal(Number(msg.goalMinutes ?? 0))
        return
      }
      case 'cheered': {
        this.deps.onCheer(
          String(msg.cheerId ?? ''),
          String(msg.fromId ?? ''),
          sanitizeNickname(msg.fromNickname),
          String(msg.toId ?? '')
        )
        return
      }
      case 'error': {
        this.error = String(msg.message ?? '操作失败')
        // 房间没了就别再自动重回，否则重连时会一直撞同一个错误
        if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'ROOM_FULL') this.lastRoomId = ''
        this.deps.onChanged()
        return
      }
      default:
        return
    }
  }

  private applyRoster(msg: Record<string, unknown>): void {
    const room = (msg.room ?? {}) as Record<string, unknown>
    const hostId = String(room.hostId ?? '')
    const rawMembers = Array.isArray(msg.members) ? msg.members : []

    this.members = rawMembers.map((item) => {
      const m = (item ?? {}) as Record<string, unknown>
      const seconds = numberOr(m.roomFocusSeconds, 0)
      return {
        id: String(m.id ?? ''),
        nickname: sanitizeNickname(m.nickname),
        catId: sanitizeCatId(m.catId),
        host: String(m.id ?? '') === hostId,
        phase: phaseOf(m.phase),
        running: Boolean(m.running),
        remaining: numberOr(m.remaining, 0),
        todayPomodoros: numberOr(m.todayPomodoros, 0),
        todayFocusMinutes: numberOr(m.todayFocusMinutes, 0),
        todayRoomFocusSeconds: seconds,
        roomFocusSeconds: seconds,
        roomPomodoros: 0,
        cheers: numberOr(m.cheers, 0),
        joinedAt: numberOr(m.seq, 0),
        online: true
      }
    })

    const roomId = String(room.id ?? '')
    this.room = {
      roomId,
      name: String(room.name ?? ''),
      // 公网房间靠大厅点击进入，不需要房间码
      code: '',
      hostNickname: this.members.find((m) => m.host)?.nickname ?? '',
      memberCount: numberOr(room.memberCount, this.members.length),
      maxMembers: numberOr(room.maxMembers, STUDY_ROOM_MAX_MEMBERS),
      goalMinutes: numberOr(room.goalMinutes, 0),
      focusMinutes: numberOr(room.focusMinutes, 0),
      createdAt: numberOr(room.createdAt, 0)
    }
    this.lastRoomId = roomId
    this.deps.onChanged()
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

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function phaseOf(value: unknown): StudyRoomFocusReport['phase'] {
  return value === 'work' || value === 'short' || value === 'long' ? value : 'idle'
}
