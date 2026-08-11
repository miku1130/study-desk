/**
 * 局域网自习室 UDP 发现：房主侧应答探测（Beacon），访客侧周期广播搜索（Scanner）。
 * socket 通过工厂注入，测试可以用假实现替代真实 dgram，不触碰网络。
 */
import * as dgram from 'node:dgram'
import * as os from 'node:os'
import {
  STUDY_ROOM_UDP_PORT,
  broadcastAddressesFrom,
  decodeDiscoveryPacket,
  encodeDiscoveryPacket
} from './protocol'
import type { StudyRoomSummary } from './protocol'

/** 访客探测周期 */
const SCAN_INTERVAL_MS = 2500
/** 超过该时长没再收到 beacon 的房间视为消失 */
const ROOM_EXPIRE_MS = 8000

export interface DgramRemoteInfoLike {
  address: string
  port: number
}

/** dgram.Socket 的最小结构面：真实 socket 与测试假 socket 都满足它 */
export interface DgramSocketLike {
  bind(port?: number, callback?: () => void): void
  on(event: 'message', listener: (message: Buffer, rinfo: DgramRemoteInfoLike) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  send(
    message: Buffer,
    port: number,
    address: string,
    callback?: (error: Error | null) => void
  ): void
  setBroadcast(flag: boolean): void
  close(): void
  address(): { port: number }
}

function defaultCreateSocket(): DgramSocketLike {
  return dgram.createSocket({ type: 'udp4', reuseAddr: true })
}

export interface StudyRoomBeaconOptions {
  getRoom: () => StudyRoomSummary | null
  getPort: () => number
  createSocket?: () => DgramSocketLike
}

/**
 * 房主侧发现应答器：监听固定 UDP 端口，收到 probe 后把房间信息单播回探测方。
 * 端口被占用等错误只会让「自动发现」降级，不影响通过房间码加入。
 */
export class StudyRoomBeacon {
  private socket: DgramSocketLike | null = null

  constructor(private readonly options: StudyRoomBeaconOptions) {}

  start(): void {
    if (this.socket) return
    let socket: DgramSocketLike
    try {
      socket = (this.options.createSocket ?? defaultCreateSocket)()
    } catch {
      return
    }
    this.socket = socket
    socket.on('error', (error) => {
      console.warn('[studyRoom] 发现应答不可用（不影响房间码加入）：', error.message)
      if (this.socket === socket) this.socket = null
      try {
        socket.close()
      } catch {
        /* 可能已关闭 */
      }
    })
    socket.on('message', (message, rinfo) => {
      const packet = decodeDiscoveryPacket(message)
      if (!packet || packet.t !== 'probe') return
      const room = this.options.getRoom()
      if (!room) return
      const reply = encodeDiscoveryPacket({ t: 'beacon', port: this.options.getPort(), room })
      try {
        socket.send(reply, rinfo.port, rinfo.address, () => {
          /* 单播失败无需处理，访客会再次探测 */
        })
      } catch {
        /* 同上 */
      }
    })
    try {
      socket.bind(STUDY_ROOM_UDP_PORT)
    } catch (error) {
      console.warn('[studyRoom] 绑定发现端口失败（不影响房间码加入）：', (error as Error).message)
      this.socket = null
      try {
        socket.close()
      } catch {
        /* 可能已关闭 */
      }
    }
  }

  stop(): void {
    const socket = this.socket
    this.socket = null
    if (!socket) return
    try {
      socket.close()
    } catch {
      /* 可能已关闭 */
    }
  }
}

export interface StudyRoomDiscoveredRoom {
  room: StudyRoomSummary
  address: string
  port: number
}

export interface StudyRoomScannerOptions {
  onRooms: (rooms: StudyRoomDiscoveredRoom[]) => void
  createSocket?: () => DgramSocketLike
}

/**
 * 访客侧搜索器：绑定临时端口，向各网段广播地址周期发 probe，
 * 聚合 beacon 应答并按 roomId 去重（同一房间保留最新一次应答）。
 */
export class StudyRoomScanner {
  private socket: DgramSocketLike | null = null
  private timer: NodeJS.Timeout | null = null
  private readonly found = new Map<string, { entry: StudyRoomDiscoveredRoom; seenAt: number }>()

  constructor(private readonly options: StudyRoomScannerOptions) {}

  start(): void {
    if (this.socket) return
    let socket: DgramSocketLike
    try {
      socket = (this.options.createSocket ?? defaultCreateSocket)()
    } catch {
      return
    }
    this.socket = socket
    socket.on('error', (error) => {
      console.warn('[studyRoom] 搜索自习室失败：', error.message)
      if (this.socket === socket) this.stop()
    })
    socket.on('message', (message, rinfo) => {
      const packet = decodeDiscoveryPacket(message)
      if (!packet || packet.t !== 'beacon' || !packet.room.roomId) return
      this.found.set(packet.room.roomId, {
        entry: { room: packet.room, address: rinfo.address, port: packet.port },
        seenAt: Date.now()
      })
      this.emitRooms()
    })
    try {
      // setBroadcast 必须在绑定完成后调用
      socket.bind(0, () => {
        try {
          socket.setBroadcast(true)
        } catch {
          /* 个别环境不支持广播，仍可收到定向应答 */
        }
        this.probe(socket)
      })
    } catch {
      this.stop()
      return
    }
    this.timer = setInterval(() => this.probe(socket), SCAN_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    const socket = this.socket
    this.socket = null
    this.found.clear()
    if (!socket) return
    try {
      socket.close()
    } catch {
      /* 可能已关闭 */
    }
  }

  private probe(socket: DgramSocketLike): void {
    if (this.socket !== socket) return
    const payload = encodeDiscoveryPacket({ t: 'probe' })
    for (const address of broadcastAddressesFrom(os.networkInterfaces())) {
      try {
        socket.send(payload, STUDY_ROOM_UDP_PORT, address, () => {
          /* 个别网段不可达属正常现象 */
        })
      } catch {
        /* 同上 */
      }
    }
    this.emitRooms()
  }

  /** 剔除过期房间并回调最新列表 */
  private emitRooms(): void {
    const now = Date.now()
    for (const [roomId, item] of this.found) {
      if (now - item.seenAt > ROOM_EXPIRE_MS) this.found.delete(roomId)
    }
    this.options.onRooms([...this.found.values()].map((item) => item.entry))
  }
}
