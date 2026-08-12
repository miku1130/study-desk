/**
 * 公网自习室服务端入口。
 *
 * 监听本地端口，由 nginx 终止 TLS 后反代过来（wss://study.lemon21.cn/ws）。
 *
 * 两层状态务必分清：
 *   - 成员关系与自习室元数据在 SQLite（stats.ts），加入了就一直是成员；
 *   - 谁此刻在房间里学习在内存（presence.ts），关掉应用就不在座了。
 * 这一层只负责路由消息和广播，规则判断都在那两个模块里。
 */

import { createServer } from 'http'
import { randomUUID } from 'crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { Presence, type FocusReport } from './presence'
import { FocusStats, WISH_PAGE_SIZE, type RangeKey } from './stats'
import {
  STUDY_ROOM_PROTOCOL_VERSION,
  STUDY_ROOM_MAX_FRAME_BYTES,
  STUDY_ROOM_DEFAULT_CAT_ID,
  sanitizeCatId,
  sanitizeNickname
} from '../../src/main/studyRoom/protocol'

const PORT = Number(process.env.PORT ?? 3100)
const HOST = process.env.HOST ?? '127.0.0.1'
const DB_PATH = process.env.DB_PATH ?? '/opt/study-room/data/stats.db'
/** 同一瞬间的多次变化合并成一次广播，避免大房间产生 N² 条消息 */
const BROADCAST_WINDOW_MS = 150
const HEARTBEAT_MS = 30_000
const LEADERBOARD_PUSH_MS = 20_000
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000
/** 房内名册一次推多少人；999 人自习室不可能整份推下去 */
const MEMBER_PAGE = 50
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface Client {
  id: string
  socket: WebSocket
  ip: string
  deviceId: string
  nickname: string
  catId: string
  alive: boolean
  watchingBrowse: boolean
  watchingRange: RangeKey | null
  /** 当前正在查看的自习室（未必在座，可能只是浏览） */
  viewing: string
}

const db = new FocusStats({ filePath: DB_PATH })
const presence = new Presence({
  onFocusAccrued: (deviceId, seconds) => db.addFocus(deviceId, seconds)
})
const clients = new Map<string, Client>()

/* ------------------------------------------------------------------ *
 * 发送
 * ------------------------------------------------------------------ */

function send(client: Client, payload: Record<string, unknown>): void {
  if (client.socket.readyState !== WebSocket.OPEN) return
  try {
    client.socket.send(JSON.stringify(payload))
  } catch {
    /* 断开由 close 事件统一善后 */
  }
}

function fail(client: Client, message: string): void {
  send(client, { t: 'error', message })
}

/** 只发给此刻在座的人 */
function broadcastRoom(roomId: string, payload: Record<string, unknown>): void {
  const line = JSON.stringify(payload)
  for (const connectionId of presence.connectionsIn(roomId)) {
    const client = clients.get(connectionId)
    if (client?.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(line)
      } catch {
        /* 同上 */
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 视图组装
 * ------------------------------------------------------------------ */

function roomDetail(roomId: string, client: Client, range: RangeKey, offset = 0): Record<string, unknown> | null {
  const room = db.getRoom(roomId)
  if (!room) return null
  const attendees = presence.attendees(roomId)
  const online = new Set(attendees.map((a) => a.deviceId))
  const members = db.roomMembers(roomId, range, MEMBER_PAGE, offset).map((m) => ({
    ...m,
    online: online.has(m.deviceId),
    // 在座的人用实时状态，不在座的只显示累计
    focusing: attendees.some(
      (a) => a.deviceId === m.deviceId && a.focus.running && a.focus.phase === 'work'
    )
  }))
  return {
    t: 'room:detail',
    range,
    offset,
    room: {
      ...room,
      isOwner: room.ownerDevice === client.deviceId,
      isMember: db.isMember(roomId, client.deviceId),
      attendeeCount: presence.attendeeCount(roomId),
      focusingCount: presence.focusingCount(roomId)
    },
    members
  }
}

/** 大厅：只列此刻有人在座的自习室，僵尸房不占位置 */
function browseList(): Record<string, unknown> {
  const rooms = presence
    .activeRoomIds()
    .map((id) => db.getRoom(id))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      intro: r.intro,
      memberCount: r.memberCount,
      attendeeCount: presence.attendeeCount(r.id),
      focusingCount: presence.focusingCount(r.id)
    }))
    .sort((a, b) => b.attendeeCount - a.attendeeCount || b.focusingCount - a.focusingCount)
  return { t: 'rooms:browse', rooms }
}

function myRooms(client: Client): Record<string, unknown> {
  return {
    t: 'rooms:mine',
    rooms: db.myRooms(client.deviceId).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      intro: r.intro,
      memberCount: r.memberCount,
      isOwner: r.ownerDevice === client.deviceId,
      attendeeCount: presence.attendeeCount(r.id)
    }))
  }
}

/* ------------------------------------------------------------------ *
 * 广播合并
 * ------------------------------------------------------------------ */

const pendingRooms = new Set<string>()
let pendingBrowse = false
let flushTimer: NodeJS.Timeout | null = null

function markDirty(roomId = '', browse = false): void {
  if (roomId) pendingRooms.add(roomId)
  if (browse) pendingBrowse = true
  if (!flushTimer) flushTimer = setTimeout(flush, BROADCAST_WINDOW_MS)
}

function flush(): void {
  flushTimer = null
  for (const roomId of pendingRooms) {
    // 每个人看到的名次页与身份不同，只能逐连接组装
    for (const connectionId of presence.connectionsIn(roomId)) {
      const client = clients.get(connectionId)
      if (!client) continue
      const detail = roomDetail(roomId, client, client.watchingRange ?? 'today')
      if (detail) send(client, detail)
    }
  }
  pendingRooms.clear()

  if (pendingBrowse) {
    pendingBrowse = false
    const payload = browseList()
    const line = JSON.stringify(payload)
    for (const client of clients.values()) {
      if (client.watchingBrowse && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(line)
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 消息处理
 * ------------------------------------------------------------------ */

function newRoomCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    if (!db.getRoomByCode(code)) return code
  }
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
}

function rangeOf(value: unknown): RangeKey {
  return value === 'week' || value === 'month' ? value : 'today'
}

function handle(client: Client, raw: string): void {
  let msg: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    msg = parsed as Record<string, unknown>
  } catch {
    return
  }

  switch (msg.t) {
    case 'hello': {
      if (Number(msg.v) !== STUDY_ROOM_PROTOCOL_VERSION) {
        fail(client, `客户端版本过旧，请更新后再加入（服务端协议 v${STUDY_ROOM_PROTOCOL_VERSION}）`)
        client.socket.close()
        return
      }
      client.nickname = sanitizeNickname(msg.nickname)
      client.catId = sanitizeCatId(msg.catId)
      client.deviceId = String(msg.deviceId ?? '').slice(0, 64)
      if (!client.deviceId) {
        fail(client, '缺少设备标识，请重启应用')
        client.socket.close()
        return
      }
      db.touchProfile(client.deviceId, client.nickname, client.catId)
      send(client, {
        t: 'welcome',
        v: STUDY_ROOM_PROTOCOL_VERSION,
        deviceId: client.deviceId,
        intro: db.getIntro(client.deviceId),
        checkin: db.todayCheckin(client.deviceId)
      })
      send(client, myRooms(client))
      return
    }

    case 'profile': {
      const result = db.setIntro(client.deviceId, String(msg.intro ?? ''))
      if (!result.ok) return fail(client, result.reason)
      send(client, { t: 'profile', intro: result.value })
      markDirty(presence.roomOf(client.id))
      return
    }

    case 'checkin': {
      const kind = msg.kind === 'sleep' ? 'sleep' : 'wake'
      const result = db.checkIn(client.deviceId, kind, String(msg.time ?? ''))
      if (!result.ok) return fail(client, result.reason)
      send(client, { t: 'checkin', ...db.todayCheckin(client.deviceId) })
      markDirty(presence.roomOf(client.id))
      return
    }

    /* ---- 自习室（成员关系层）---- */

    case 'rooms:mine': {
      send(client, myRooms(client))
      return
    }

    case 'rooms:browse': {
      client.watchingBrowse = true
      send(client, browseList())
      return
    }

    case 'room:create': {
      const result = db.createRoom({
        id: randomUUID(),
        code: newRoomCode(),
        ownerDevice: client.deviceId,
        name: String(msg.name ?? ''),
        intro: String(msg.intro ?? ''),
        goalMinutes: Number(msg.goalMinutes ?? 0)
      })
      if (!result.ok) return fail(client, result.reason)
      send(client, { t: 'room:created', roomId: result.room.id, code: result.room.code })
      send(client, myRooms(client))
      return
    }

    /** 加入自习室：账号级别的关系，不等于进入房间 */
    case 'room:join': {
      const code = String(msg.code ?? '').trim()
      const room = code ? db.getRoomByCode(code) : db.getRoom(String(msg.roomId ?? ''))
      if (!room) return fail(client, '没找到这个自习室，检查一下加入码')
      const result = db.joinRoom(room.id, client.deviceId)
      if (!result.ok) return fail(client, result.reason)
      send(client, { t: 'room:joined', roomId: room.id })
      send(client, myRooms(client))
      markDirty(room.id, true)
      return
    }

    /** 退出自习室：真正解除成员关系 */
    case 'room:quit': {
      const roomId = String(msg.roomId ?? '')
      if (!db.isMember(roomId, client.deviceId)) return fail(client, '你不是这个自习室的成员')
      const result = db.leaveRoom(roomId, client.deviceId)
      if (presence.roomOf(client.id) === roomId) presence.leave(client.id)
      send(client, { t: 'room:quit', roomId, dissolved: result.dissolved })
      send(client, myRooms(client))
      if (result.newOwner) {
        broadcastRoom(roomId, { t: 'notice', kind: 'host', text: '自习室换了新主人' })
      }
      markDirty(result.dissolved ? '' : roomId, true)
      return
    }

    case 'room:dissolve': {
      const roomId = String(msg.roomId ?? '')
      const result = db.dissolveRoom(roomId, client.deviceId)
      if (!result.ok) return fail(client, result.reason)
      broadcastRoom(roomId, { t: 'room:dissolved', roomId })
      for (const connectionId of presence.connectionsIn(roomId)) presence.leave(connectionId)
      send(client, myRooms(client))
      markDirty('', true)
      return
    }

    case 'room:meta': {
      const roomId = String(msg.roomId ?? '')
      const patch: { name?: string; intro?: string; goalMinutes?: number } = {}
      if (typeof msg.name === 'string') patch.name = msg.name
      if (typeof msg.intro === 'string') patch.intro = msg.intro
      if (msg.goalMinutes !== undefined) patch.goalMinutes = Number(msg.goalMinutes)
      const result = db.setRoomMeta(roomId, client.deviceId, patch)
      if (!result.ok) return fail(client, result.reason)
      markDirty(roomId, true)
      return
    }

    /* ---- 房间（在座层）---- */

    /** 进入房间只是今天来学习，非成员也能先进来看看 */
    case 'room:enter': {
      const roomId = String(msg.roomId ?? '')
      const room = db.getRoom(roomId)
      if (!room) return fail(client, '这个自习室不存在或已解散')
      const previous = presence.roomOf(client.id)
      presence.enter({
        connectionId: client.id,
        deviceId: client.deviceId,
        nickname: client.nickname,
        catId: client.catId,
        roomId
      })
      client.viewing = roomId
      db.touchRoom(roomId)
      send(client, { t: 'room:entered', roomId })
      const detail = roomDetail(roomId, client, client.watchingRange ?? 'today')
      if (detail) send(client, detail)
      if (previous && previous !== roomId) markDirty(previous)
      markDirty(roomId, true)
      return
    }

    /** 离开房间：只是今天不学了，成员身份原样保留 */
    case 'room:exit': {
      const { roomId } = presence.leave(client.id)
      client.viewing = ''
      send(client, { t: 'room:exited', roomId })
      if (roomId) markDirty(roomId, true)
      return
    }

    case 'room:members': {
      const roomId = String(msg.roomId ?? client.viewing)
      const range = rangeOf(msg.range)
      client.watchingRange = range
      const detail = roomDetail(roomId, client, range, Math.max(0, Number(msg.offset ?? 0)))
      if (!detail) return fail(client, '这个自习室不存在或已解散')
      send(client, detail)
      return
    }

    case 'focus': {
      const roomId = presence.reportFocus(client.id, msg.focus as FocusReport)
      if (roomId) markDirty(roomId)
      return
    }

    case 'cheer': {
      const result = presence.cheer(
        client.id,
        String(msg.cheerId ?? ''),
        String(msg.toDeviceId ?? '')
      )
      if (!result.ok) return fail(client, result.reason)
      broadcastRoom(result.roomId, {
        t: 'cheered',
        cheerId: String(msg.cheerId),
        fromDeviceId: result.from.deviceId,
        fromNickname: result.from.nickname,
        toDeviceId: result.toDeviceId
      })
      markDirty(result.roomId)
      return
    }

    /* ---- 许愿墙 ---- */

    case 'wish:list': {
      const roomId = String(msg.roomId ?? client.viewing)
      send(client, {
        t: 'wish:list',
        roomId,
        wishes: db.wishes(client.deviceId ? roomId : '', client.deviceId, WISH_PAGE_SIZE, Number(msg.before ?? 0))
      })
      return
    }

    case 'wish:add': {
      const roomId = String(msg.roomId ?? client.viewing)
      const result = db.addWish(roomId, client.deviceId, String(msg.text ?? ''))
      if (!result.ok) return fail(client, result.reason)
      broadcastRoom(roomId, { t: 'wish:changed', roomId })
      send(client, { t: 'wish:list', roomId, wishes: db.wishes(roomId, client.deviceId) })
      return
    }

    case 'wish:report': {
      const result = db.reportWish(Number(msg.id ?? 0), client.deviceId)
      const roomId = String(msg.roomId ?? client.viewing)
      send(client, {
        t: 'notice',
        kind: 'report',
        text: result.hidden ? '已收到举报，这条愿望已隐藏' : '已收到举报，谢谢'
      })
      if (result.hidden) broadcastRoom(roomId, { t: 'wish:changed', roomId })
      return
    }

    case 'wish:delete': {
      const roomId = String(msg.roomId ?? client.viewing)
      if (!db.deleteWish(Number(msg.id ?? 0), client.deviceId)) {
        return fail(client, '只能删自己的愿望，或者由主人来删')
      }
      broadcastRoom(roomId, { t: 'wish:changed', roomId })
      send(client, { t: 'wish:list', roomId, wishes: db.wishes(roomId, client.deviceId) })
      return
    }

    /* ---- 全站榜 ---- */

    case 'leaderboard': {
      const range = rangeOf(msg.range)
      client.watchingRange = range
      send(client, { t: 'leaderboard', ...db.leaderboard(range, client.deviceId) })
      return
    }

    default:
      return
  }
}

/* ------------------------------------------------------------------ *
 * 连接
 * ------------------------------------------------------------------ */

/**
 * 取真实客户端 IP。
 *
 * 必须优先用 X-Real-IP：nginx 里它是 `$remote_addr`，由 nginx 覆盖写入，客户端伪造不了。
 * X-Forwarded-For 用的是 `$proxy_add_x_forwarded_for`，最左侧那段完全由请求方控制。
 */
function clientIp(headers: Record<string, string | string[] | undefined>, fallback: string): string {
  const real = headers['x-real-ip']
  const realValue = Array.isArray(real) ? real[0] : real
  if (realValue?.trim()) return realValue.trim()

  const forwarded = headers['x-forwarded-for']
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (header) {
    const parts = header.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return fallback
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, clients: clients.size, rooms: presence.activeRoomIds().length }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws',
  maxPayload: STUDY_ROOM_MAX_FRAME_BYTES
})

let connectionSeq = 0

wss.on('connection', (socket, req) => {
  connectionSeq += 1
  const client: Client = {
    id: `c${Date.now().toString(36)}${connectionSeq.toString(36)}`,
    socket,
    ip: clientIp(req.headers, req.socket.remoteAddress ?? 'unknown'),
    deviceId: '',
    nickname: '',
    catId: STUDY_ROOM_DEFAULT_CAT_ID,
    alive: true,
    watchingBrowse: false,
    watchingRange: null,
    viewing: ''
  }
  clients.set(client.id, client)

  socket.on('message', (data) => handle(client, data.toString()))
  socket.on('pong', () => {
    client.alive = true
  })
  socket.on('error', () => socket.close())
  socket.on('close', () => {
    clients.delete(client.id)
    // 断线只是不在座了，成员关系不动
    const { roomId } = presence.leave(client.id)
    if (roomId) markDirty(roomId, true)
  })
})

const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (!client.alive) {
      client.socket.terminate()
      continue
    }
    client.alive = false
    client.socket.ping()
  }
}, HEARTBEAT_MS)

const leaderboardTimer = setInterval(() => {
  for (const client of clients.values()) {
    if (!client.watchingRange || client.viewing) continue
    if (client.socket.readyState !== WebSocket.OPEN) continue
    send(client, { t: 'leaderboard', ...db.leaderboard(client.watchingRange, client.deviceId) })
  }
}, LEADERBOARD_PUSH_MS)

const pruneTimer = setInterval(() => db.prune(), PRUNE_INTERVAL_MS)

function shutdown(): void {
  clearInterval(heartbeat)
  clearInterval(leaderboardTimer)
  clearInterval(pruneTimer)
  if (flushTimer) clearTimeout(flushTimer)
  db.close()
  for (const client of clients.values()) client.socket.close(1001, 'server shutting down')
  wss.close(() => httpServer.close(() => process.exit(0)))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

httpServer.listen(PORT, HOST, () => {
  console.log(`[study-room] listening on ${HOST}:${PORT} (protocol v${STUDY_ROOM_PROTOCOL_VERSION})`)
})
