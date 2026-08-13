/**
 * 局域网自习室服务：主进程权威状态机（TCP 房主 / 访客、名册、加油、集体目标）。
 * 房主是唯一权威：任何来自网络的字段都必须先经 protocol.ts 清洗再进入名册。
 */
import * as net from 'node:net'
import * as os from 'node:os'
import { randomUUID } from 'node:crypto'
import type { JsonStore } from '../store'
import { localDateKey } from '../time'
import { StudyRoomBeacon, StudyRoomScanner } from './discovery'
import {
  OnlineRoomClient,
  type LeaderboardRange,
  type OnlineSnapshot
} from './onlineClient'
import {
  MessageDecoder,
  STUDY_ROOM_CHEERS,
  STUDY_ROOM_CHEER_COOLDOWN_MS,
  STUDY_ROOM_DEFAULT_GOAL_MINUTES,
  STUDY_ROOM_MAX_FOCUS_STEP_SEC,
  STUDY_ROOM_MAX_MEMBERS,
  STUDY_ROOM_NICKNAME_MAX,
  STUDY_ROOM_PROTOCOL_VERSION,
  STUDY_ROOM_TCP_PORT,
  STUDY_ROOM_TCP_PORT_TRIES,
  createId,
  decodeRoomCode,
  encodeMessage,
  encodeRoomCode,
  isCheerId,
  primaryLanAddress,
  sanitizeNickname,
  sanitizeRoomName,
  validateNickname,
  validateRoomName
} from './protocol'
import type {
  StudyRoomCheerSpec,
  StudyRoomFocusReport,
  StudyRoomMemberSnapshot,
  StudyRoomMessage,
  StudyRoomSummary,
  TextCheckResult
} from './protocol'

/** 访客连接房主的超时 */
const JOIN_TIMEOUT_MS = 8000
/** 房主心跳周期 */
const HOST_PING_INTERVAL_MS = 10_000
/** 房主判定成员掉线的静默阈值 */
const HOST_DROP_TIMEOUT_MS = 25_000
/** 访客判定房主失联的静默阈值 */
const GUEST_DROP_TIMEOUT_MS = 30_000
/** 访客失联检查周期 */
const GUEST_WATCH_INTERVAL_MS = 5000
/** study-room:state 推送节流间隔 */
const STATE_PUSH_MIN_INTERVAL_MS = 500
/** focus 上报节流间隔（阶段变化时不受限） */
const FOCUS_REPORT_MIN_INTERVAL_MS = 3000
const GOAL_MIN_MINUTES = 15
const GOAL_MAX_MINUTES = 1440
/** 今日自习累计的持久化键：{ date: 'YYYY-MM-DD', seconds: number } */
const TODAY_FOCUS_STORE_KEY = 'todayRoomFocus'
/** todayRoomFocusSeconds 每攒够这么多新秒数才落盘一次，避免每秒 tick 都写盘 */
const TODAY_FOCUS_FLUSH_SEC = 15
const TODAY_FOCUS_MAX_SEC = 24 * 3600

export type StudyRoomStatus = 'idle' | 'hosting' | 'connecting' | 'joined' | 'error' | 'online'

/** 公网服务端地址；可在设置里覆盖，换域名时老客户端不至于全废 */
export const DEFAULT_STUDY_ROOM_SERVER = 'wss://study.lemon21.cn/ws'

/** 与 preload 侧 StudyRoomStateDTO 结构完全一致 */
export interface StudyRoomState {
  status: StudyRoomStatus
  selfId: string
  nickname: string
  room: StudyRoomSummary | null
  members: StudyRoomMemberSnapshot[]
  error: string
}

export interface StudyRoomDeps {
  store: Pick<JsonStore<Record<string, unknown>>, 'get' | 'set'>
  send: (channel: string, ...args: unknown[]) => void
  notify: (title: string, body: string) => void
  getCatId: () => string
  getFocus: () => StudyRoomFocusReport
  /** 默认 true；测试传 false 以关闭 UDP */
  enableDiscovery?: boolean
}

/** 房主侧一条成员链路；房主自己 socket 为 null */
interface MemberLink {
  member: StudyRoomMemberSnapshot
  socket: net.Socket | null
  /** 最近一次收到任何数据的时刻，用于掉线判定 */
  lastSeenAt: number
  /** 最近一次 focus 上报时刻，用于专注时长累计 */
  lastFocusAt: number
  /** 上次上报的今日番茄数，用增量推导房内番茄数，防止直接上报伪造 */
  lastTodayPomodoros: number
  lastCheerAt: number
}

interface PendingConn {
  socket: net.Socket
  since: number
}

function clampGoal(minutes: number): number {
  const n = Number(minutes)
  if (!Number.isFinite(n)) return STUDY_ROOM_DEFAULT_GOAL_MINUTES
  return Math.min(GOAL_MAX_MINUTES, Math.max(GOAL_MIN_MINUTES, Math.round(n)))
}

export class StudyRoomService {
  private status: StudyRoomStatus = 'idle'
  private selfId = ''
  private room: StudyRoomSummary | null = null
  /** 访客侧从 roster 镜像的名册；房主侧名册以 links 为准 */
  private guestMembers: StudyRoomMemberSnapshot[] = []
  private error = ''

  private server: net.Server | null = null
  private readonly links = new Map<string, MemberLink>()
  private readonly pending = new Set<PendingConn>()
  private pingTimer: NodeJS.Timeout | null = null
  private goalNotified = false
  private beacon: StudyRoomBeacon | null = null

  private client: net.Socket | null = null
  private clientWatchTimer: NodeJS.Timeout | null = null
  private clientLastDataAt = 0
  private cancelConnecting: (() => void) | null = null

  private scanner: StudyRoomScanner | null = null
  /** 公网模式的连接；非 null 表示当前走服务器而不是局域网 */
  private online: OnlineRoomClient | null = null

  private statePushTimer: NodeJS.Timeout | null = null
  private lastStatePushAt = 0
  private lastFocusReportAt = 0
  private lastReportedSignature = ''
  private lastSelfCheerAt = 0
  private disposed = false

  /** 今天在自习室里累计的专注秒数（跨房间、跨重连），由自己本地维护并持久化 */
  private todayRoomFocusSeconds = 0
  /** todayRoomFocusSeconds 所属的本地日期键，跨天时归零 */
  private todayRoomFocusDate = localDateKey()
  /** 上一次自我采样的时刻；0 表示尚未采样 */
  private lastSelfSampleAt = 0
  /** 上一次采样时是否处于「在自习室内且 running 的 work 阶段」 */
  private lastSelfCounting = false
  /** 距上次落盘后新累计的秒数，攒够 TODAY_FOCUS_FLUSH_SEC 才写盘 */
  private unsavedTodayFocusSec = 0

  constructor(private readonly deps: StudyRoomDeps) {
    this.todayRoomFocusSeconds = this.restoreTodayRoomFocus()
  }

  getState(): StudyRoomState {
    const members =
      this.status === 'hosting'
        ? [...this.links.values()].map((link) => ({ ...link.member }))
        : this.guestMembers.map((member) => ({ ...member }))
    return {
      status: this.status,
      selfId: this.selfId,
      nickname: sanitizeNickname(this.deps.store.get('nickname'), ''),
      room: this.room ? { ...this.room } : null,
      members,
      error: this.error
    }
  }

  /* ------------------------------------------------------------------ *
   * 公网模式：服务器是权威，本地只做镜像
   * ------------------------------------------------------------------ */

  /**
   * 匿名身份。排行榜要跨会话累计，就必须有个稳定标识；
   * 昵称是用户随手填的，拿它当凭证等于谁都能顶替榜首，所以只作展示。
   */
  private ensureDeviceId(): string {
    const saved = this.deps.store.get('deviceId')
    if (typeof saved === 'string' && saved.length >= 8) return saved
    const id = randomUUID()
    this.deps.store.set('deviceId', id)
    return id
  }

  private ensureOnline(): OnlineRoomClient {
    if (this.online) return this.online
    // 进公网模式前先退干净局域网连接，避免两套链路同时上报专注状态
    if (this.status !== 'idle') this.leave()
    const configured = this.deps.store.get('serverUrl')
    const deviceId = this.ensureDeviceId()
    // 公网模式下 deviceId 就是自己的座位标识，渲染层据此判断加油是不是冲我来的
    this.selfId = deviceId
    this.online = new OnlineRoomClient({
      url: typeof configured === 'string' && configured ? configured : DEFAULT_STUDY_ROOM_SERVER,
      deviceId,
      getNickname: () => sanitizeNickname(this.deps.store.get('nickname'), ''),
      getCatId: () => this.deps.getCatId(),
      getFocus: () => this.selfFocus(),
      onChanged: () => this.pushOnline(),
      onNotice: (kind, text) => this.deps.send('study-room:notice', { kind, text }),
      onCheer: (cheerId, fromId, fromNickname, toId) =>
        this.emitCheer(cheerId, fromId, fromNickname, toId, Date.now()),
      onDeviceIdChanged: (next) => {
        // 换身份必须落盘，否则重启又变回原来那台设备
        this.deps.store.set('deviceId', next)
        this.selfId = next
      }
    })
    return this.online
  }

  private pushOnline(): void {
    if (this.disposed) return
    this.deps.send('study-room:online', this.online?.snapshot() ?? null)
  }

  getOnlineSnapshot(): OnlineSnapshot | null {
    return this.online?.snapshot() ?? null
  }

  /** 连上服务器并订阅公开自习室列表 */
  onlineConnect(): void {
    this.ensureOnline().refreshMyRooms()
  }

  watchBrowse(on: boolean): void {
    if (!on && !this.online) return
    this.ensureOnline().watchBrowse(on)
  }

  setIntro(intro: string): void {
    this.ensureOnline().setIntro(intro)
  }

  checkIn(kind: 'wake' | 'sleep', time: string): void {
    this.ensureOnline().checkInAt(kind, time)
  }

  /* ---- 自习室：成员关系层 ---- */

  createRoom(name: string, intro: string, goalMinutes: number): void {
    this.deps.store.set('lastRoomName', name)
    this.ensureOnline().createRoom(name, intro, clampGoal(goalMinutes))
  }

  joinStudyRoom(params: { roomId?: string; code?: string }): void {
    this.ensureOnline().joinRoom(params)
  }

  quitStudyRoom(roomId: string): void {
    this.ensureOnline().quitRoom(roomId)
  }

  dissolveStudyRoom(roomId: string): void {
    this.ensureOnline().dissolveRoom(roomId)
  }

  updateStudyRoom(
    roomId: string,
    patch: { name?: string; intro?: string; goalMinutes?: number }
  ): void {
    this.ensureOnline().updateRoom(roomId, patch)
  }

  /* ---- 房间：今天来不来学 ---- */

  enterRoom(roomId: string): void {
    this.ensureOnline().enterRoom(roomId)
  }

  exitRoom(): void {
    this.online?.exitRoom()
  }

  setRoomRange(range: LeaderboardRange): void {
    this.online?.setRange(range)
  }

  /* ---- 许愿墙 ---- */

  addWish(text: string): void {
    this.ensureOnline().addWish(text)
  }

  reportWish(id: number): void {
    this.online?.reportWish(id)
  }

  deleteWish(id: number): void {
    this.online?.deleteWish(id)
  }

  /* ---- 跨设备 ---- */

  createLinkCode(): void {
    this.ensureOnline().createLinkCode()
  }

  claimLinkCode(code: string): void {
    this.ensureOnline().claimLinkCode(code)
  }

  listPendingWishes(): void {
    this.online?.listPendingWishes()
  }

  restoreWish(id: number): void {
    this.online?.restoreWish(id)
  }

  /** 彻底断开公网连接并回到本地空闲态 */
  goOffline(): void {
    if (!this.online) return
    this.online.dispose()
    this.online = null
    this.pushOnline()
    this.pushState()
  }

  getCheers(): StudyRoomCheerSpec[] {
    return STUDY_ROOM_CHEERS
  }

  validateName(kind: 'nickname' | 'room', text: string): TextCheckResult {
    return kind === 'nickname' ? validateNickname(text) : validateRoomName(text)
  }

  setNickname(nickname: string): TextCheckResult {
    const result = validateNickname(nickname)
    if (result.ok) {
      this.deps.store.set('nickname', result.value)
      this.pushState()
    }
    return result
  }

  async host(options: { name: string; goalMinutes: number }): Promise<{ ok: boolean; error?: string }> {
    if (this.disposed) return { ok: false, error: '服务已关闭' }
    if (this.status !== 'idle') this.leave()
    const name = sanitizeRoomName(options?.name)
    const goalMinutes = clampGoal(options?.goalMinutes)
    const listened = await this.listenFirstFreePort()
    if (!listened) {
      return { ok: false, error: '端口被占用，请关闭其它自习室后重试' }
    }
    const { server, port } = listened
    const now = Date.now()
    const nickname = sanitizeNickname(this.deps.store.get('nickname'))
    const focus = this.selfFocus()
    this.server = server
    this.selfId = createId('m')
    this.room = {
      roomId: createId('r'),
      name,
      code: encodeRoomCode(primaryLanAddress(os.networkInterfaces()), port),
      hostNickname: nickname,
      memberCount: 1,
      maxMembers: STUDY_ROOM_MAX_MEMBERS,
      goalMinutes,
      focusMinutes: 0,
      createdAt: now
    }
    this.links.set(this.selfId, {
      member: {
        ...focus,
        id: this.selfId,
        nickname,
        catId: this.deps.getCatId(),
        host: true,
        roomFocusSeconds: 0,
        roomPomodoros: 0,
        cheers: 0,
        joinedAt: now,
        online: true
      },
      socket: null,
      lastSeenAt: now,
      lastFocusAt: now,
      lastTodayPomodoros: focus.todayPomodoros,
      lastCheerAt: 0
    })
    this.status = 'hosting'
    this.error = ''
    this.goalNotified = false
    this.lastFocusReportAt = 0
    this.lastReportedSignature = ''
    // 进房后重新铆定采样起点：从现在起「在房 + 专注」的时段才计入今日累计
    this.sampleTodayRoomFocus(focus)
    server.on('connection', (socket) => this.acceptConnection(socket))
    server.on('error', () => {
      /* 监听建立后的偶发错误不致命，成员链路各自兜底 */
    })
    this.pingTimer = setInterval(() => this.checkMembersAlive(), HOST_PING_INTERVAL_MS)
    this.deps.store.set('lastRoomName', name)
    this.deps.store.set('goalMinutes', goalMinutes)
    if (this.deps.enableDiscovery !== false) {
      this.beacon = new StudyRoomBeacon({
        getRoom: () => this.room,
        getPort: () => port
      })
      this.beacon.start()
    }
    this.refreshRoster()
    return { ok: true }
  }

  async join(target: {
    address?: string
    port?: number
    code?: string
  }): Promise<{ ok: boolean; error?: string }> {
    if (this.disposed) return { ok: false, error: '服务已关闭' }
    if (this.status !== 'idle') this.leave()
    let address = typeof target?.address === 'string' ? target.address.trim() : ''
    let port = Number(target?.port ?? 0)
    if (target?.code) {
      const decoded = decodeRoomCode(target.code)
      if (!decoded) return { ok: false, error: '房间码无效' }
      address = decoded.address
      port = decoded.port
    }
    if (!address || !Number.isInteger(port) || port <= 0 || port > 65535) {
      return { ok: false, error: '缺少自习室地址' }
    }
    this.status = 'connecting'
    this.error = ''
    this.pushState()
    return await new Promise((resolve) => {
      const socket = net.createConnection({ host: address, port })
      const decoder = new MessageDecoder()
      let settled = false
      const fail = (message: string, kind: 'error' | 'leave' = 'error'): void => {
        if (settled) return
        settled = true
        this.cancelConnecting = null
        clearTimeout(timer)
        socket.removeAllListeners('close')
        socket.removeAllListeners('data')
        socket.destroy()
        this.resetToIdle()
        if (kind === 'error') this.error = message
        this.notice(kind, message)
        this.pushState()
        resolve({ ok: false, error: message })
      }
      const timer = setTimeout(() => fail('连接超时，对方可能不在线'), JOIN_TIMEOUT_MS)
      this.cancelConnecting = () => fail('已取消加入', 'leave')
      socket.setNoDelay(true)
      socket.on('error', () => fail('无法连接到自习室'))
      socket.on('connect', () => {
        this.writeTo(socket, {
          t: 'hello',
          v: STUDY_ROOM_PROTOCOL_VERSION,
          nickname: sanitizeNickname(this.deps.store.get('nickname')),
          catId: this.deps.getCatId(),
          focus: this.selfFocus()
        })
      })
      socket.on('data', (chunk: Buffer) => {
        this.clientLastDataAt = Date.now()
        for (const message of decoder.push(chunk)) {
          if (settled) {
            this.handleServerMessage(message)
            continue
          }
          if (message.t === 'welcome') {
            settled = true
            this.cancelConnecting = null
            clearTimeout(timer)
            this.becomeJoined(socket, message.selfId, message.room, message.members)
            resolve({ ok: true })
          } else if (message.t === 'reject') {
            fail(message.reason)
            return
          }
        }
      })
      socket.on('close', () => {
        if (!settled) fail('连接已断开')
        else this.handleServerClosed()
      })
    })
  }

  leave(): void {
    if (this.online) {
      // 公网模式下这只是离开今天的房间，成员身份不动
      if (this.online.isInRoom()) {
        this.online.exitRoom()
        this.notice('leave', '已离开房间，仍然是这个自习室的成员')
      }
      return
    }
    if (this.status === 'hosting') {
      this.broadcast({ t: 'bye' })
      this.teardownHost()
      this.resetToIdle()
      this.notice('leave', '已关闭自习室')
      this.pushState()
      return
    }
    if (this.status === 'connecting') {
      this.cancelConnecting?.()
      return
    }
    if (this.status === 'joined') {
      if (this.client) this.writeTo(this.client, { t: 'bye' })
      this.teardownClient()
      this.resetToIdle()
      this.notice('leave', '已离开自习室')
      this.pushState()
    }
  }

  setGoal(goalMinutes: number): boolean {
    if (this.online) {
      const room = this.online.snapshot().room
      if (!room) return false
      this.online.updateRoom(room.id, { goalMinutes: clampGoal(goalMinutes) })
      return true
    }
    if (this.status !== 'hosting' || !this.room) return false
    const value = clampGoal(goalMinutes)
    this.room.goalMinutes = value
    this.deps.store.set('goalMinutes', value)
    this.refreshRoster()
    return true
  }

  cheer(toId: string, cheerId: string): boolean {
    if (!isCheerId(cheerId)) return false
    if (this.online) {
      if (!this.online.isInRoom()) return false
      const now = Date.now()
      if (now - this.lastSelfCheerAt < STUDY_ROOM_CHEER_COOLDOWN_MS) return false
      this.lastSelfCheerAt = now
      this.online.cheer(toId, cheerId)
      return true
    }
    if (this.status === 'hosting') {
      const link = this.links.get(this.selfId)
      return link ? this.applyCheer(link, cheerId, toId) : false
    }
    if (this.status === 'joined' && this.client) {
      const now = Date.now()
      if (now - this.lastSelfCheerAt < STUDY_ROOM_CHEER_COOLDOWN_MS) return false
      this.lastSelfCheerAt = now
      this.writeTo(this.client, { t: 'cheer', cheerId, toId })
      return true
    }
    return false
  }

  startDiscovery(): void {
    if (this.disposed || this.deps.enableDiscovery === false) return
    if (this.scanner) return
    this.scanner = new StudyRoomScanner({
      onRooms: (rooms) => this.deps.send('study-room:rooms', rooms)
    })
    this.scanner.start()
  }

  stopDiscovery(): void {
    if (!this.scanner) return
    this.scanner.stop()
    this.scanner = null
  }

  /** 番茄钟 tick / 状态变化时调用；同阶段 3 秒内只上报一次，阶段变化立即上报 */
  reportFocus(): void {
    if (this.online) {
      if (!this.online.isInRoom()) return
      const focus = this.selfFocus()
      const signature = `${focus.phase}|${focus.running}`
      const now = Date.now()
      if (
        signature === this.lastReportedSignature &&
        now - this.lastFocusReportAt < FOCUS_REPORT_MIN_INTERVAL_MS
      ) {
        return
      }
      this.lastFocusReportAt = now
      this.lastReportedSignature = signature
      this.online.reportFocus()
      return
    }
    if (this.status !== 'hosting' && this.status !== 'joined') return
    // selfFocus 内部会先结算今日自习累计——必须发生在下面的节流之前，
    // 否则被节流吃掉的每秒 tick 将永远计不上时长
    const focus = this.selfFocus()
    const signature = `${focus.phase}|${focus.running}`
    const now = Date.now()
    if (
      signature === this.lastReportedSignature &&
      now - this.lastFocusReportAt < FOCUS_REPORT_MIN_INTERVAL_MS
    ) {
      return
    }
    this.lastFocusReportAt = now
    this.lastReportedSignature = signature
    if (this.status === 'hosting') {
      const link = this.links.get(this.selfId)
      if (link) {
        this.applyFocusReport(link, focus)
        this.refreshRoster()
      }
      return
    }
    if (this.client) this.writeTo(this.client, { t: 'focus', focus })
  }

  notePomodoroComplete(): void {
    if (this.status === 'hosting') {
      const link = this.links.get(this.selfId)
      if (!link) return
      link.member.roomPomodoros += 1
      // 同步增量基线，避免随后的 focus 上报按 todayPomodoros 差值重复计数
      link.lastTodayPomodoros = Math.max(
        link.lastTodayPomodoros + 1,
        this.selfFocus().todayPomodoros
      )
      this.refreshRoster()
      return
    }
    if (this.status === 'joined') {
      this.lastFocusReportAt = 0
      this.lastReportedSignature = ''
      this.reportFocus()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.online?.dispose()
    this.online = null
    this.leave()
    // leave 内已按需结算；这里兜底强制落盘一次（含空闲时退出的场景）
    this.persistTodayRoomFocus()
    this.stopDiscovery()
    this.disposed = true
    if (this.statePushTimer) {
      clearTimeout(this.statePushTimer)
      this.statePushTimer = null
    }
  }

  /* ------------------------------------------------------------------ *
   * 房主侧
   * ------------------------------------------------------------------ */

  private listenFirstFreePort(): Promise<{ server: net.Server; port: number } | null> {
    return new Promise((resolve) => {
      const tryPort = (index: number): void => {
        if (index >= STUDY_ROOM_TCP_PORT_TRIES) {
          resolve(null)
          return
        }
        const port = STUDY_ROOM_TCP_PORT + index
        const server = net.createServer()
        const onError = (): void => {
          server.close()
          tryPort(index + 1)
        }
        server.once('error', onError)
        server.listen(port, () => {
          server.removeListener('error', onError)
          resolve({ server, port })
        })
      }
      tryPort(0)
    })
  }

  private acceptConnection(socket: net.Socket): void {
    if (this.status !== 'hosting') {
      socket.destroy()
      return
    }
    socket.setNoDelay(true)
    const conn: PendingConn = { socket, since: Date.now() }
    this.pending.add(conn)
    const decoder = new MessageDecoder()
    let memberId = ''
    socket.on('error', () => {
      /* 收尾统一由 close 事件处理 */
    })
    socket.on('data', (chunk: Buffer) => {
      const link = memberId ? this.links.get(memberId) : undefined
      if (link) link.lastSeenAt = Date.now()
      for (const message of decoder.push(chunk)) {
        if (memberId) {
          this.handleMemberMessage(memberId, message)
          continue
        }
        memberId = this.handleHello(socket, message)
        if (!memberId) return
        this.pending.delete(conn)
      }
    })
    socket.on('close', () => {
      this.pending.delete(conn)
      const link = memberId ? this.links.get(memberId) : undefined
      if (link && link.socket === socket) this.removeMember(memberId)
    })
  }

  /** 处理首帧 hello；返回分配的成员 id，被拒绝返回空串 */
  private handleHello(socket: net.Socket, message: StudyRoomMessage): string {
    const room = this.room
    if (message.t !== 'hello') {
      socket.destroy()
      return ''
    }
    if (message.v !== STUDY_ROOM_PROTOCOL_VERSION) {
      this.writeTo(socket, { t: 'reject', reason: '版本不一致，请双方更新到同一版本' })
      socket.end()
      return ''
    }
    if (!room || this.links.size >= STUDY_ROOM_MAX_MEMBERS) {
      this.writeTo(socket, { t: 'reject', reason: '自习室已满' })
      socket.end()
      return ''
    }
    const id = createId('m')
    const now = Date.now()
    const nickname = this.uniqueNickname(message.nickname)
    this.links.set(id, {
      member: {
        ...message.focus,
        id,
        nickname,
        catId: message.catId,
        host: false,
        roomFocusSeconds: 0,
        roomPomodoros: 0,
        cheers: 0,
        joinedAt: now,
        online: true
      },
      socket,
      lastSeenAt: now,
      lastFocusAt: now,
      lastTodayPomodoros: message.focus.todayPomodoros,
      lastCheerAt: 0
    })
    this.recomputeRoom()
    this.writeTo(socket, {
      t: 'welcome',
      v: STUDY_ROOM_PROTOCOL_VERSION,
      selfId: id,
      room,
      members: this.memberList()
    })
    this.notice('join', `${nickname} 加入了自习室`)
    this.refreshRoster()
    return id
  }

  private handleMemberMessage(memberId: string, message: StudyRoomMessage): void {
    const link = this.links.get(memberId)
    if (!link) return
    switch (message.t) {
      case 'focus':
        this.applyFocusReport(link, message.focus)
        this.refreshRoster()
        break
      case 'cheer':
        this.applyCheer(link, message.cheerId, message.toId)
        break
      case 'ping':
        if (link.socket) this.writeTo(link.socket, { t: 'pong' })
        break
      case 'bye':
        this.removeMember(memberId)
        break
      default:
        break
    }
  }

  /**
   * 专注时长累计（防伪造的关键）：只有「上一次上报时正处于 running 的 work 阶段」
   * 的时段才计入，且单步不超过 STUDY_ROOM_MAX_FOCUS_STEP_SEC。
   */
  private applyFocusReport(link: MemberLink, focus: StudyRoomFocusReport): void {
    const now = Date.now()
    if (link.member.running && link.member.phase === 'work' && link.lastFocusAt > 0) {
      const gapSec = Math.floor((now - link.lastFocusAt) / 1000)
      if (gapSec > 0) {
        link.member.roomFocusSeconds += Math.min(gapSec, STUDY_ROOM_MAX_FOCUS_STEP_SEC)
      }
    }
    if (focus.todayPomodoros > link.lastTodayPomodoros) {
      link.member.roomPomodoros += focus.todayPomodoros - link.lastTodayPomodoros
    }
    link.lastTodayPomodoros = focus.todayPomodoros
    link.lastFocusAt = now
    link.member.phase = focus.phase
    link.member.running = focus.running
    link.member.remaining = focus.remaining
    link.member.todayFocusMinutes = focus.todayFocusMinutes
    link.member.todayPomodoros = focus.todayPomodoros
    // 成员自己按日累计的自习时长：原样透传展示，不参与集体目标与房内计时
    link.member.todayRoomFocusSeconds = focus.todayRoomFocusSeconds
  }

  /** 房主侧统一执行加油：白名单、冷却、计数、广播，对房主自己同样生效 */
  private applyCheer(fromLink: MemberLink, cheerId: string, toId: string): boolean {
    if (!isCheerId(cheerId)) return false
    const now = Date.now()
    if (now - fromLink.lastCheerAt < STUDY_ROOM_CHEER_COOLDOWN_MS) return false
    const target = toId ? this.links.get(toId) : null
    if (toId && !target) return false
    fromLink.lastCheerAt = now
    if (target) {
      target.member.cheers += 1
    } else {
      // 对全体加油：全员 +1 但不含发送者
      for (const link of this.links.values()) {
        if (link !== fromLink) link.member.cheers += 1
      }
    }
    this.broadcast({
      t: 'cheered',
      cheerId,
      fromId: fromLink.member.id,
      fromNickname: fromLink.member.nickname,
      toId,
      at: now
    })
    this.emitCheer(cheerId, fromLink.member.id, fromLink.member.nickname, toId, now)
    this.refreshRoster()
    return true
  }

  private checkMembersAlive(): void {
    const now = Date.now()
    this.broadcast({ t: 'ping' })
    for (const [id, link] of [...this.links]) {
      if (!link.socket) continue
      if (now - link.lastSeenAt > HOST_DROP_TIMEOUT_MS) this.removeMember(id)
    }
    for (const conn of [...this.pending]) {
      if (now - conn.since > HOST_DROP_TIMEOUT_MS) {
        this.pending.delete(conn)
        conn.socket.destroy()
      }
    }
  }

  private removeMember(memberId: string): void {
    const link = this.links.get(memberId)
    if (!link) return
    this.links.delete(memberId)
    if (link.socket) {
      link.socket.removeAllListeners('close')
      link.socket.removeAllListeners('data')
      link.socket.destroy()
    }
    this.notice('leave', `${link.member.nickname} 离开了自习室`)
    this.refreshRoster()
  }

  /** 名册里已存在同名时自动追加 ·2 / ·3，并保证总长不超过昵称上限 */
  private uniqueNickname(base: string): string {
    const taken = new Set([...this.links.values()].map((link) => link.member.nickname))
    if (!taken.has(base)) return base
    for (let n = 2; ; n++) {
      const suffix = `·${n}`
      const head = Array.from(base)
        .slice(0, Math.max(1, STUDY_ROOM_NICKNAME_MAX - suffix.length))
        .join('')
      const candidate = `${head}${suffix}`
      if (!taken.has(candidate)) return candidate
    }
  }

  private memberList(): StudyRoomMemberSnapshot[] {
    return [...this.links.values()].map((link) => link.member)
  }

  /** 重算房间聚合字段并检查集体目标（同一房间只触发一次） */
  private recomputeRoom(): void {
    const room = this.room
    if (!room) return
    room.memberCount = this.links.size
    let totalSeconds = 0
    for (const link of this.links.values()) totalSeconds += link.member.roomFocusSeconds
    room.focusMinutes = Math.floor(totalSeconds / 60)
    if (!this.goalNotified && room.goalMinutes > 0 && room.focusMinutes >= room.goalMinutes) {
      this.goalNotified = true
      this.broadcast({ t: 'goal', goalMinutes: room.goalMinutes, at: Date.now() })
      this.deps.notify('自习室目标达成', `大家共同专注满 ${room.goalMinutes} 分钟，太棒了！`)
      this.notice('goal', `集体目标 ${room.goalMinutes} 分钟达成`)
    }
  }

  private refreshRoster(): void {
    const room = this.room
    if (this.status !== 'hosting' || !room) return
    this.recomputeRoom()
    this.broadcast({ t: 'roster', room, members: this.memberList() })
    this.pushState()
  }

  private broadcast(message: StudyRoomMessage): void {
    const line = encodeMessage(message)
    for (const link of this.links.values()) {
      if (!link.socket) continue
      try {
        link.socket.write(line)
      } catch {
        /* 断开由 close 事件统一善后 */
      }
    }
  }

  private teardownHost(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.beacon) {
      this.beacon.stop()
      this.beacon = null
    }
    for (const link of this.links.values()) {
      const socket = link.socket
      if (!socket) continue
      socket.removeAllListeners('close')
      socket.removeAllListeners('data')
      // end 而非 destroy：让离场前广播的 bye 有机会送达
      try {
        socket.end()
        socket.unref()
      } catch {
        /* 已断开 */
      }
    }
    this.links.clear()
    for (const conn of this.pending) conn.socket.destroy()
    this.pending.clear()
    if (this.server) {
      try {
        this.server.close()
      } catch {
        /* 已关闭 */
      }
      this.server = null
    }
    this.goalNotified = false
  }

  /* ------------------------------------------------------------------ *
   * 访客侧
   * ------------------------------------------------------------------ */

  private becomeJoined(
    socket: net.Socket,
    selfId: string,
    room: StudyRoomSummary,
    members: StudyRoomMemberSnapshot[]
  ): void {
    this.client = socket
    this.status = 'joined'
    this.selfId = selfId
    this.room = room
    this.guestMembers = members
    this.error = ''
    this.clientLastDataAt = Date.now()
    this.lastFocusReportAt = 0
    this.lastReportedSignature = ''
    // 进房后重新铆定采样起点：从现在起「在房 + 专注」的时段才计入今日累计
    this.sampleTodayRoomFocus(this.deps.getFocus())
    this.clientWatchTimer = setInterval(() => {
      if (Date.now() - this.clientLastDataAt > GUEST_DROP_TIMEOUT_MS) this.handleServerClosed()
    }, GUEST_WATCH_INTERVAL_MS)
    this.notice('join', `已加入「${room.name}」`)
    this.pushState()
  }

  private handleServerMessage(message: StudyRoomMessage): void {
    switch (message.t) {
      case 'roster':
        this.room = message.room
        this.guestMembers = message.members
        this.pushState()
        break
      case 'cheered':
        this.emitCheer(message.cheerId, message.fromId, message.fromNickname, message.toId, message.at)
        break
      case 'goal':
        this.deps.notify('自习室目标达成', `大家共同专注满 ${message.goalMinutes} 分钟，太棒了！`)
        this.notice('goal', `集体目标 ${message.goalMinutes} 分钟达成`)
        break
      case 'ping':
        if (this.client) this.writeTo(this.client, { t: 'pong' })
        break
      case 'bye':
        this.handleServerClosed()
        break
      default:
        break
    }
  }

  private handleServerClosed(): void {
    if (this.status !== 'joined') return
    this.teardownClient()
    this.resetToIdle()
    this.notice('closed', '自习室已解散或房主失联')
    this.pushState()
  }

  private teardownClient(): void {
    if (this.clientWatchTimer) {
      clearInterval(this.clientWatchTimer)
      this.clientWatchTimer = null
    }
    const socket = this.client
    this.client = null
    if (!socket) return
    socket.removeAllListeners('close')
    socket.removeAllListeners('data')
    socket.removeAllListeners('error')
    socket.on('error', () => {
      /* 销毁期间的错误可忽略 */
    })
    // end 而非 destroy：让 bye 有机会送达
    try {
      socket.end()
      socket.unref()
    } catch {
      /* 已断开 */
    }
  }

  /* ------------------------------------------------------------------ *
   * 今日自习专注累计（todayRoomFocusSeconds）
   * 本地按日累计、跨房间持久化；只做展示透传，不参与集体目标与排行。
   * ------------------------------------------------------------------ */

  /** 从本地存储恢复今天的自习累计；日期不是今天视为 0（跨天自动归零） */
  private restoreTodayRoomFocus(): number {
    const saved = this.deps.store.get(TODAY_FOCUS_STORE_KEY) as
      | { date?: unknown; seconds?: unknown }
      | undefined
    if (!saved || typeof saved !== 'object' || saved.date !== this.todayRoomFocusDate) return 0
    const seconds = Number(saved.seconds)
    if (!Number.isFinite(seconds)) return 0
    return Math.min(TODAY_FOCUS_MAX_SEC, Math.max(0, Math.floor(seconds)))
  }

  /**
   * 自己的专注画像：deps.getFocus() 里的 todayRoomFocusSeconds 只是占位值，
   * 必须先结算采样、再用本地维护的按日累计覆盖，才能用于上报 / 写名册。
   */
  private selfFocus(): StudyRoomFocusReport {
    const focus = this.deps.getFocus()
    this.sampleTodayRoomFocus(focus)
    return { ...focus, todayRoomFocusSeconds: this.todayRoomFocusSeconds }
  }

  /**
   * 结算一段自习专注：与房主侧 applyFocusReport 同一套防漂移做法——
   * 只有「上一次采样时处于在房内 + running 的 work 阶段」的时段才计入，
   * 且单步不超过 STUDY_ROOM_MAX_FOCUS_STEP_SEC。
   */
  private sampleTodayRoomFocus(focus: StudyRoomFocusReport): void {
    const now = Date.now()
    const today = localDateKey()
    if (today !== this.todayRoomFocusDate) {
      // 跨天：昨天的累计只属于昨天，从 0 开始记新的一天
      this.todayRoomFocusDate = today
      this.todayRoomFocusSeconds = 0
      this.persistTodayRoomFocus()
    }
    if (this.lastSelfCounting && this.lastSelfSampleAt > 0) {
      const gapSec = Math.floor((now - this.lastSelfSampleAt) / 1000)
      if (gapSec > 0) {
        const step = Math.min(gapSec, STUDY_ROOM_MAX_FOCUS_STEP_SEC)
        this.todayRoomFocusSeconds = Math.min(this.todayRoomFocusSeconds + step, TODAY_FOCUS_MAX_SEC)
        this.unsavedTodayFocusSec += step
        if (this.unsavedTodayFocusSec >= TODAY_FOCUS_FLUSH_SEC) this.persistTodayRoomFocus()
      }
    }
    const counting =
      (this.status === 'hosting' || this.status === 'joined') &&
      focus.running &&
      focus.phase === 'work'
    // 专注状态翻转（开始 / 暂停 / 换阶段 / 离房）时，把零头也落盘
    if (counting !== this.lastSelfCounting && this.unsavedTodayFocusSec > 0) {
      this.persistTodayRoomFocus()
    }
    this.lastSelfSampleAt = now
    this.lastSelfCounting = counting
  }

  private persistTodayRoomFocus(): void {
    this.unsavedTodayFocusSec = 0
    this.deps.store.set(TODAY_FOCUS_STORE_KEY, {
      date: this.todayRoomFocusDate,
      seconds: this.todayRoomFocusSeconds
    })
  }

  /** 离开自习室前结算最后一段并强制落盘；离房后不在房内，停止累计 */
  private settleTodayRoomFocusOnExit(): void {
    if (this.status !== 'hosting' && this.status !== 'joined') return
    this.sampleTodayRoomFocus(this.deps.getFocus())
    this.lastSelfCounting = false
    this.persistTodayRoomFocus()
  }

  /* ------------------------------------------------------------------ *
   * 公共内部
   * ------------------------------------------------------------------ */

  private resetToIdle(): void {
    // 所有离房路径（主动离开 / 解散 / 房主失联）都汇聚到这里，先结算再清状态
    this.settleTodayRoomFocusOnExit()
    this.status = 'idle'
    this.selfId = ''
    this.room = null
    this.guestMembers = []
    this.error = ''
  }

  private writeTo(socket: net.Socket, message: StudyRoomMessage): void {
    try {
      socket.write(encodeMessage(message))
    } catch {
      /* 连接问题由 close 事件统一善后 */
    }
  }

  private notice(kind: 'join' | 'leave' | 'goal' | 'closed' | 'error', text: string): void {
    this.deps.send('study-room:notice', { kind, text })
  }

  private emitCheer(
    cheerId: string,
    fromId: string,
    fromNickname: string,
    toId: string,
    at: number
  ): void {
    this.deps.send('study-room:cheer-event', { id: createId('c'), cheerId, fromId, fromNickname, toId, at })
  }

  /** state 推送节流：至多每 500ms 一次，末次变更通过尾随定时器补发 */
  private pushState(): void {
    if (this.disposed) return
    const now = Date.now()
    const elapsed = now - this.lastStatePushAt
    if (elapsed >= STATE_PUSH_MIN_INTERVAL_MS) {
      this.lastStatePushAt = now
      this.deps.send('study-room:state', this.getState())
      return
    }
    if (this.statePushTimer) return
    this.statePushTimer = setTimeout(
      () => {
        this.statePushTimer = null
        this.lastStatePushAt = Date.now()
        this.deps.send('study-room:state', this.getState())
      },
      Math.max(1, STATE_PUSH_MIN_INTERVAL_MS - elapsed)
    )
  }
}
