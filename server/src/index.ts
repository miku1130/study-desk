/**
 * 公网自习室服务端入口。
 *
 * 监听本地端口，由 nginx 终止 TLS 后反代过来（wss://study.lemon21.cn/ws）。
 * 这一层只负责连接、路由和广播合并，所有规则判断都在 rooms.ts 里。
 */

import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { Rooms, type FocusReport, type RoomsEvent } from './rooms'
import {
  STUDY_ROOM_PROTOCOL_VERSION,
  STUDY_ROOM_MAX_FRAME_BYTES,
  STUDY_ROOM_DEFAULT_CAT_ID,
  sanitizeCatId,
  sanitizeNickname
} from '../../src/main/studyRoom/protocol'

const PORT = Number(process.env.PORT ?? 3100)
const HOST = process.env.HOST ?? '127.0.0.1'
/** 多个成员在同一瞬间上报时合并成一次广播，避免 N 人房间产生 N² 条消息 */
const BROADCAST_WINDOW_MS = 120
const HEARTBEAT_MS = 30_000

interface Client {
  id: string
  socket: WebSocket
  ip: string
  nickname: string
  catId: string
  alive: boolean
  /** 是否订阅了大厅推送 */
  watchingLobby: boolean
}

const rooms = new Rooms()
const clients = new Map<string, Client>()
let clientSeq = 0

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

function sendError(client: Client, code: string, message: string): void {
  send(client, { t: 'error', code, message })
}

function broadcastRoom(roomId: string, payload: Record<string, unknown>): void {
  const room = rooms.getRoom(roomId)
  if (!room) return
  const line = JSON.stringify(payload)
  for (const memberId of room.members.keys()) {
    const client = clients.get(memberId)
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(line)
      } catch {
        /* 同上 */
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 广播合并
 * ------------------------------------------------------------------ */

const pendingRosters = new Set<string>()
let pendingLobby = false
let flushTimer: NodeJS.Timeout | null = null

function rosterPayload(roomId: string): Record<string, unknown> | null {
  const room = rooms.getRoom(roomId)
  if (!room) return null
  return {
    t: 'roster',
    room: rooms.snapshot(room),
    members: rooms.roster(room).map((m) => ({
      id: m.id,
      nickname: m.nickname,
      catId: m.catId,
      seq: m.seq,
      phase: m.focus.phase,
      running: m.focus.running,
      remaining: m.focus.remaining,
      todayPomodoros: m.focus.todayPomodoros,
      todayFocusMinutes: m.focus.todayFocusMinutes,
      roomFocusSeconds: m.roomFocusSeconds,
      cheers: m.cheers
    }))
  }
}

function lobbyPayload(): Record<string, unknown> {
  return { t: 'lobby', rooms: rooms.lobby() }
}

function flush(): void {
  flushTimer = null
  for (const roomId of pendingRosters) {
    const payload = rosterPayload(roomId)
    if (payload) broadcastRoom(roomId, payload)
  }
  pendingRosters.clear()

  if (pendingLobby) {
    pendingLobby = false
    const payload = lobbyPayload()
    const line = JSON.stringify(payload)
    for (const client of clients.values()) {
      if (!client.watchingLobby) continue
      if (client.socket.readyState === WebSocket.OPEN) client.socket.send(line)
    }
  }
}

function apply(events: RoomsEvent[]): void {
  for (const event of events) {
    if (event.type === 'roster') pendingRosters.add(event.roomId)
    else if (event.type === 'lobby') pendingLobby = true
    else if (event.type === 'notice') {
      broadcastRoom(event.roomId, { t: 'notice', kind: event.kind, text: event.text })
    } else if (event.type === 'goal') {
      broadcastRoom(event.roomId, { t: 'goal', goalMinutes: event.goalMinutes })
    }
  }
  if ((pendingRosters.size > 0 || pendingLobby) && !flushTimer) {
    flushTimer = setTimeout(flush, BROADCAST_WINDOW_MS)
  }
}

/* ------------------------------------------------------------------ *
 * 消息处理
 * ------------------------------------------------------------------ */

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
      const version = Number(msg.v)
      if (version !== STUDY_ROOM_PROTOCOL_VERSION) {
        sendError(
          client,
          'VERSION_MISMATCH',
          `客户端版本过旧，请更新后再加入（服务端协议 v${STUDY_ROOM_PROTOCOL_VERSION}）`
        )
        client.socket.close()
        return
      }
      // 立刻清洗：挂着不入房的连接不应该能把超长昵称留在内存里
      client.nickname = sanitizeNickname(msg.nickname)
      client.catId = sanitizeCatId(msg.catId)
      send(client, { t: 'welcome', memberId: client.id, v: STUDY_ROOM_PROTOCOL_VERSION })
      return
    }

    case 'lobby': {
      client.watchingLobby = true
      send(client, lobbyPayload())
      return
    }

    case 'create': {
      const result = rooms.create({
        memberId: client.id,
        nickname: client.nickname,
        catId: client.catId,
        ip: client.ip,
        name: String(msg.name ?? ''),
        goalMinutes: Number(msg.goalMinutes ?? 0)
      })
      if (!result.ok) return sendError(client, result.code, result.message)
      send(client, { t: 'joined', roomId: result.room.id })
      apply(result.events)
      return
    }

    case 'join': {
      const result = rooms.join({
        memberId: client.id,
        nickname: client.nickname,
        catId: client.catId,
        roomId: String(msg.roomId ?? '')
      })
      if (!result.ok) return sendError(client, result.code, result.message)
      send(client, { t: 'joined', roomId: result.room.id })
      apply(result.events)
      return
    }

    case 'quickJoin': {
      const result = rooms.quickJoin({
        memberId: client.id,
        nickname: client.nickname,
        catId: client.catId,
        ip: client.ip
      })
      if (!result.ok) return sendError(client, result.code, result.message)
      send(client, { t: 'joined', roomId: result.room.id, created: result.created })
      apply(result.events)
      return
    }

    case 'leave': {
      const result = rooms.leave(client.id)
      send(client, { t: 'left' })
      apply(result.events)
      return
    }

    case 'focus': {
      apply(rooms.reportFocus(client.id, msg.focus as FocusReport))
      return
    }

    case 'goal': {
      const result = rooms.setGoal(client.id, Number(msg.goalMinutes ?? 0))
      if (!result.ok) return sendError(client, result.code, result.message)
      apply(result.events)
      return
    }

    case 'cheer': {
      const result = rooms.cheer(client.id, String(msg.cheerId ?? ''), String(msg.toId ?? ''))
      if (!result.ok) return sendError(client, result.code, result.message)
      broadcastRoom(result.room.id, {
        t: 'cheered',
        cheerId: String(msg.cheerId),
        fromId: result.from.id,
        fromNickname: result.from.nickname,
        toId: result.toId
      })
      apply([{ type: 'roster', roomId: result.room.id }])
      return
    }

    default:
      return
  }
}

/* ------------------------------------------------------------------ *
 * 连接
 * ------------------------------------------------------------------ */

function clientIp(forwarded: string | string[] | undefined, fallback: string): string {
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (!header) return fallback
  // X-Forwarded-For 可能是 "客户端, 代理1, 代理2"，取最左侧
  return header.split(',')[0]?.trim() || fallback
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: STUDY_ROOM_MAX_FRAME_BYTES })

wss.on('connection', (socket, req) => {
  clientSeq += 1
  const client: Client = {
    id: `c${Date.now().toString(36)}${clientSeq.toString(36)}`,
    socket,
    ip: clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress ?? 'unknown'),
    nickname: '',
    catId: STUDY_ROOM_DEFAULT_CAT_ID,
    alive: true,
    watchingLobby: false
  }
  clients.set(client.id, client)

  socket.on('message', (data) => handle(client, data.toString()))
  socket.on('pong', () => {
    client.alive = true
  })
  socket.on('error', () => socket.close())
  socket.on('close', () => {
    clients.delete(client.id)
    apply(rooms.leave(client.id).events)
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

function shutdown(): void {
  clearInterval(heartbeat)
  if (flushTimer) clearTimeout(flushTimer)
  for (const client of clients.values()) client.socket.close(1001, 'server shutting down')
  wss.close(() => httpServer.close(() => process.exit(0)))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

httpServer.listen(PORT, HOST, () => {
  console.log(`[study-room] listening on ${HOST}:${PORT} (protocol v${STUDY_ROOM_PROTOCOL_VERSION})`)
})
