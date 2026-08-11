import { describe, it, expect, afterEach, vi } from 'vitest'
import * as net from 'node:net'
import { StudyRoomService } from '../src/main/studyRoom/service'
import type { StudyRoomDeps } from '../src/main/studyRoom/service'
import { StudyRoomBeacon, StudyRoomScanner } from '../src/main/studyRoom/discovery'
import type {
  DgramRemoteInfoLike,
  DgramSocketLike,
  StudyRoomDiscoveredRoom
} from '../src/main/studyRoom/discovery'
import {
  MessageDecoder,
  STUDY_ROOM_MAX_FOCUS_STEP_SEC,
  STUDY_ROOM_PROTOCOL_VERSION,
  STUDY_ROOM_UDP_PORT,
  decodeDiscoveryPacket,
  decodeRoomCode,
  encodeDiscoveryPacket
} from '../src/main/studyRoom/protocol'
import type {
  StudyRoomFocusReport,
  StudyRoomMemberSnapshot,
  StudyRoomMessage,
  StudyRoomSummary
} from '../src/main/studyRoom/protocol'

const NETWORK_TEST_TIMEOUT = 15_000

const idleFocus: StudyRoomFocusReport = {
  phase: 'idle',
  running: false,
  remaining: 0,
  todayFocusMinutes: 0,
  todayPomodoros: 0
}

const workFocus: StudyRoomFocusReport = {
  phase: 'work',
  running: true,
  remaining: 1200,
  todayFocusMinutes: 10,
  todayPomodoros: 1
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function until(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (!check()) {
    if (performance.now() > deadline) throw new Error('等待条件超时')
    await sleep(25)
  }
}

/** 测试结束时统一清理，避免 socket / timer 泄漏导致 vitest 挂起 */
const cleanups: Array<() => void> = []

afterEach(async () => {
  vi.restoreAllMocks()
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()
    cleanup?.()
  }
  await sleep(30)
})

interface ServiceHarness {
  service: StudyRoomService
  sent: Array<[string, ...unknown[]]>
  notices: Array<[string, string]>
  setFocus: (focus: StudyRoomFocusReport) => void
}

function makeService(nickname = '房主'): ServiceHarness {
  const data: Record<string, unknown> = { nickname, goalMinutes: 120 }
  const sent: Array<[string, ...unknown[]]> = []
  const notices: Array<[string, string]> = []
  let focus: StudyRoomFocusReport = { ...idleFocus }
  const deps: StudyRoomDeps = {
    store: {
      get: (key: string) => data[key],
      set: (key: string, value: unknown) => {
        data[key] = value
      }
    } as never,
    send: (channel, ...args) => {
      sent.push([channel, ...args])
    },
    notify: (title, body) => {
      notices.push([title, body])
    },
    getCatId: () => 'mikan',
    getFocus: () => focus,
    enableDiscovery: false
  }
  const service = new StudyRoomService(deps)
  cleanups.push(() => service.dispose())
  return {
    service,
    sent,
    notices,
    setFocus: (next) => {
      focus = next
    }
  }
}

function hostedPort(service: StudyRoomService): number {
  const code = service.getState().room?.code ?? ''
  const decoded = decodeRoomCode(code)
  if (!decoded) throw new Error('房间码无法解析')
  return decoded.port
}

function pick<T extends StudyRoomMessage['t']>(
  message: StudyRoomMessage,
  type: T
): Extract<StudyRoomMessage, { t: T }> {
  if (message.t !== type) throw new Error(`期望 ${type}，实际收到 ${message.t}`)
  return message as Extract<StudyRoomMessage, { t: T }>
}

function memberOf(service: StudyRoomService, nickname: string): StudyRoomMemberSnapshot {
  const member = service.getState().members.find((m) => m.nickname === nickname)
  if (!member) throw new Error(`名册中找不到 ${nickname}`)
  return member
}

interface GuestHarness {
  socket: net.Socket
  messages: StudyRoomMessage[]
  /** 先查历史再等新消息 */
  waitFor: (
    predicate: (message: StudyRoomMessage) => boolean,
    timeoutMs?: number
  ) => Promise<StudyRoomMessage>
  /** 只等注册之后到达的新消息 */
  waitForNext: (
    predicate: (message: StudyRoomMessage) => boolean,
    timeoutMs?: number
  ) => Promise<StudyRoomMessage>
  send: (payload: unknown) => void
  close: () => void
}

/** 用裸 socket 扮演访客，手工收发 NDJSON */
function connectGuest(port: number): Promise<GuestHarness> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const decoder = new MessageDecoder()
    const messages: StudyRoomMessage[] = []
    const waiters: Array<{
      predicate: (message: StudyRoomMessage) => boolean
      resolve: (message: StudyRoomMessage) => void
    }> = []
    socket.setNoDelay(true)
    socket.once('error', reject)
    socket.on('error', () => {
      /* 测试中的断开是预期行为 */
    })
    socket.on('data', (chunk) => {
      for (const message of decoder.push(chunk)) {
        messages.push(message)
        for (const waiter of [...waiters]) {
          if (waiter.predicate(message)) {
            waiters.splice(waiters.indexOf(waiter), 1)
            waiter.resolve(message)
          }
        }
      }
    })
    const waitForNext: GuestHarness['waitForNext'] = (predicate, timeoutMs = 4000) =>
      new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('等待消息超时')), timeoutMs)
        waiters.push({
          predicate,
          resolve: (message) => {
            clearTimeout(timer)
            res(message)
          }
        })
      })
    const harness: GuestHarness = {
      socket,
      messages,
      waitForNext,
      waitFor: (predicate, timeoutMs = 4000) => {
        const existing = messages.find(predicate)
        if (existing) return Promise.resolve(existing)
        return waitForNext(predicate, timeoutMs)
      },
      send: (payload) => {
        socket.write(`${JSON.stringify(payload)}\n`)
      },
      close: () => {
        socket.removeAllListeners('data')
        socket.destroy()
      }
    }
    socket.once('connect', () => resolve(harness))
  })
}

function helloPayload(
  nickname = '小明',
  focus: StudyRoomFocusReport = idleFocus,
  v: number = STUDY_ROOM_PROTOCOL_VERSION
): Record<string, unknown> {
  return { t: 'hello', v, nickname, catId: 'mikan', focus }
}

async function joinAsGuest(
  service: StudyRoomService,
  nickname = '小明',
  focus: StudyRoomFocusReport = idleFocus
): Promise<GuestHarness> {
  const guest = await connectGuest(hostedPort(service))
  cleanups.push(() => guest.close())
  guest.send(helloPayload(nickname, focus))
  await guest.waitFor((m) => m.t === 'welcome')
  return guest
}

describe('StudyRoomService（真实回环 TCP）', () => {
  it(
    '开房后进入 hosting，名册中有房主自己',
    async () => {
      const { service } = makeService()
      const result = await service.host({ name: '晚自习', goalMinutes: 90 })
      expect(result.ok).toBe(true)

      const state = service.getState()
      expect(state.status).toBe('hosting')
      expect(state.members).toHaveLength(1)
      expect(state.members[0].host).toBe(true)
      expect(state.members[0].id).toBe(state.selfId)
      expect(state.members[0].nickname).toBe('房主')
      expect(state.room?.name).toBe('晚自习')
      expect(state.room?.goalMinutes).toBe(90)
      // 房间码可解析且端口在预设范围内
      const decoded = decodeRoomCode(state.room?.code ?? '')
      expect(decoded).not.toBeNull()
      expect(decoded?.port ?? 0).toBeGreaterThanOrEqual(45871)
      expect(decoded?.port ?? 0).toBeLessThan(45871 + 8)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客 hello 后收到 welcome，名册变 2 人并广播 roster',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      const guest = await connectGuest(hostedPort(service))
      cleanups.push(() => guest.close())

      guest.send(helloPayload('小明'))
      const welcome = pick(await guest.waitFor((m) => m.t === 'welcome'), 'welcome')
      expect(welcome.selfId).not.toBe('')
      expect(welcome.room.name).toBe('晚自习')

      const roster = pick(await guest.waitFor((m) => m.t === 'roster'), 'roster')
      expect(roster.members).toHaveLength(2)
      expect(roster.room.memberCount).toBe(2)

      const state = service.getState()
      expect(state.members).toHaveLength(2)
      expect(state.members.some((m) => m.nickname === '小明' && !m.host)).toBe(true)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '同名昵称自动追加序号',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      await joinAsGuest(service, '小明')
      await joinAsGuest(service, '小明')

      const nicknames = service.getState().members.map((m) => m.nickname)
      expect(nicknames).toContain('小明')
      expect(nicknames).toContain('小明·2')
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '协议版本不一致时收到 reject',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      const guest = await connectGuest(hostedPort(service))
      cleanups.push(() => guest.close())

      guest.send(helloPayload('小明', idleFocus, 999))
      const reject = pick(await guest.waitFor((m) => m.t === 'reject'), 'reject')
      expect(reject.reason).toContain('版本')
      expect(service.getState().members).toHaveLength(1)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '非白名单 cheerId 不会产生任何 cheered 广播',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      const guest = await joinAsGuest(service, '小明')

      guest.send({ t: 'cheer', cheerId: 'buy-now-http://x.com', toId: '' })
      await sleep(300)

      expect(guest.messages.filter((m) => m.t === 'cheered')).toHaveLength(0)
      expect(service.getState().members.every((m) => m.cheers === 0)).toBe(true)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '冷却时间内连发两次 cheer 只生效一次',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      const guest = await joinAsGuest(service, '小明')

      guest.send({ t: 'cheer', cheerId: 'fighting', toId: '' })
      guest.send({ t: 'cheer', cheerId: 'fighting', toId: '' })
      await guest.waitFor((m) => m.t === 'cheered')
      await sleep(300)

      expect(guest.messages.filter((m) => m.t === 'cheered')).toHaveLength(1)
      // 对全体加油：房主 +1，发送者自己不加
      expect(memberOf(service, '房主').cheers).toBe(1)
      expect(memberOf(service, '小明').cheers).toBe(0)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    'roomFocusSeconds 按上报间隔累加且单次不超过上限',
    async () => {
      const { service } = makeService()
      await service.host({ name: '专注房', goalMinutes: 120 })
      const port = hostedPort(service)

      // 冻结时钟：让 hello 与两次 focus 上报的间隔完全可控
      const base = Date.now()
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base)

      const guest = await connectGuest(port)
      cleanups.push(() => guest.close())
      guest.send(helloPayload('小明', workFocus))
      await guest.waitFor((m) => m.t === 'welcome')

      nowSpy.mockReturnValue(base + 5000)
      const roster1 = guest.waitForNext((m) => m.t === 'roster')
      guest.send({ t: 'focus', focus: workFocus })
      await roster1
      expect(memberOf(service, '小明').roomFocusSeconds).toBe(5)

      // 伪造超长间隔（999 秒），单次只应计入上限秒数
      nowSpy.mockReturnValue(base + 5000 + 999_000)
      const roster2 = guest.waitForNext((m) => m.t === 'roster')
      guest.send({ t: 'focus', focus: workFocus })
      await roster2
      expect(memberOf(service, '小明').roomFocusSeconds).toBe(5 + STUDY_ROOM_MAX_FOCUS_STEP_SEC)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '非 work 阶段的间隔不累计专注时长',
    async () => {
      const { service } = makeService()
      await service.host({ name: '专注房', goalMinutes: 120 })

      const base = Date.now()
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base)

      const guest = await connectGuest(hostedPort(service))
      cleanups.push(() => guest.close())
      guest.send(helloPayload('小明', idleFocus))
      await guest.waitFor((m) => m.t === 'welcome')

      nowSpy.mockReturnValue(base + 5000)
      const roster1 = guest.waitForNext((m) => m.t === 'roster')
      guest.send({ t: 'focus', focus: workFocus })
      await roster1
      // 上一次上报（hello）时是 idle，本段间隔不计
      expect(memberOf(service, '小明').roomFocusSeconds).toBe(0)

      nowSpy.mockReturnValue(base + 8000)
      const roster2 = guest.waitForNext((m) => m.t === 'roster')
      guest.send({ t: 'focus', focus: workFocus })
      await roster2
      expect(memberOf(service, '小明').roomFocusSeconds).toBe(3)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客断开后房主名册回到 1 人',
    async () => {
      const { service } = makeService()
      await service.host({ name: '晚自习', goalMinutes: 60 })
      const guest = await joinAsGuest(service, '小明')
      expect(service.getState().members).toHaveLength(2)

      guest.socket.end()
      await until(() => service.getState().members.length === 1)
      expect(service.getState().members[0].host).toBe(true)
      expect(service.getState().room?.memberCount).toBe(1)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    'dispose 之后端口被释放，能再次 host 成功',
    async () => {
      const first = makeService()
      const hosted = await first.service.host({ name: '第一局', goalMinutes: 60 })
      expect(hosted.ok).toBe(true)
      const port = hostedPort(first.service)

      first.service.dispose()

      // 直接验证原端口可再次绑定（含释放的短暂等待）
      const deadline = performance.now() + 3000
      for (;;) {
        const free = await new Promise<boolean>((resolve) => {
          const probe = net.createServer()
          probe.once('error', () => resolve(false))
          probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
        })
        if (free) break
        if (performance.now() > deadline) throw new Error('dispose 后端口未释放')
        await sleep(50)
      }

      const second = makeService()
      const rehosted = await second.service.host({ name: '第二局', goalMinutes: 60 })
      expect(rehosted.ok).toBe(true)
      expect(second.service.getState().status).toBe('hosting')
    },
    NETWORK_TEST_TIMEOUT
  )
})

/* ------------------------------------------------------------------ *
 * UDP 发现：注入假 socket，不触碰真实网络
 * ------------------------------------------------------------------ */

type MessageListener = (message: Buffer, rinfo: DgramRemoteInfoLike) => void

class FakeUdpSocket implements DgramSocketLike {
  readonly sent: Array<{ payload: Buffer; port: number; address: string }> = []
  boundPort: number | null = null
  broadcastEnabled = false
  closed = false
  private readonly messageListeners: MessageListener[] = []

  bind(port?: number, callback?: () => void): void {
    this.boundPort = port ?? 0
    callback?.()
  }

  on(event: 'message', listener: MessageListener): void
  on(event: 'error', listener: (error: Error) => void): void
  on(event: string, listener: unknown): void {
    if (event === 'message') this.messageListeners.push(listener as MessageListener)
  }

  send(
    payload: Buffer,
    port: number,
    address: string,
    callback?: (error: Error | null) => void
  ): void {
    this.sent.push({ payload, port, address })
    callback?.(null)
  }

  setBroadcast(flag: boolean): void {
    this.broadcastEnabled = flag
  }

  close(): void {
    this.closed = true
  }

  address(): { port: number } {
    return { port: this.boundPort ?? 0 }
  }

  emitMessage(payload: Buffer, rinfo: DgramRemoteInfoLike): void {
    for (const listener of this.messageListeners) listener(payload, rinfo)
  }
}

function roomSummary(roomId: string): StudyRoomSummary {
  return {
    roomId,
    name: '自习室',
    code: 'ABCDE-FGHJK',
    hostNickname: '房主',
    memberCount: 1,
    maxMembers: 24,
    goalMinutes: 120,
    focusMinutes: 0,
    createdAt: Date.now()
  }
}

describe('UDP 发现（注入假 socket）', () => {
  it('Beacon 绑定发现端口，收到 probe 后向来源单播 beacon', () => {
    const fake = new FakeUdpSocket()
    let room: StudyRoomSummary | null = roomSummary('r1')
    const beacon = new StudyRoomBeacon({
      getRoom: () => room,
      getPort: () => 45872,
      createSocket: () => fake
    })
    cleanups.push(() => beacon.stop())
    beacon.start()
    expect(fake.boundPort).toBe(STUDY_ROOM_UDP_PORT)

    fake.emitMessage(encodeDiscoveryPacket({ t: 'probe' }), { address: '192.168.1.9', port: 51000 })
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0].address).toBe('192.168.1.9')
    expect(fake.sent[0].port).toBe(51000)
    const packet = decodeDiscoveryPacket(fake.sent[0].payload)
    expect(packet?.t).toBe('beacon')
    if (packet?.t === 'beacon') {
      expect(packet.port).toBe(45872)
      expect(packet.room.roomId).toBe('r1')
    }

    // 非 probe 报文与无房间时都不应答
    fake.emitMessage(Buffer.from('垃圾数据'), { address: '192.168.1.9', port: 51000 })
    room = null
    fake.emitMessage(encodeDiscoveryPacket({ t: 'probe' }), { address: '192.168.1.9', port: 51000 })
    expect(fake.sent).toHaveLength(1)
  })

  it('Scanner 广播 probe，并按 roomId 去重保留最新应答', () => {
    const fake = new FakeUdpSocket()
    const lists: StudyRoomDiscoveredRoom[][] = []
    const scanner = new StudyRoomScanner({
      onRooms: (rooms) => lists.push(rooms),
      createSocket: () => fake
    })
    cleanups.push(() => scanner.stop())
    scanner.start()

    expect(fake.broadcastEnabled).toBe(true)
    expect(
      fake.sent.some((s) => s.address === '255.255.255.255' && s.port === STUDY_ROOM_UDP_PORT)
    ).toBe(true)
    expect(decodeDiscoveryPacket(fake.sent[0].payload)?.t).toBe('probe')

    const room = roomSummary('r1')
    fake.emitMessage(encodeDiscoveryPacket({ t: 'beacon', port: 45871, room }), {
      address: '192.168.1.7',
      port: STUDY_ROOM_UDP_PORT
    })
    fake.emitMessage(encodeDiscoveryPacket({ t: 'beacon', port: 45872, room }), {
      address: '192.168.1.7',
      port: STUDY_ROOM_UDP_PORT
    })

    const latest = lists[lists.length - 1]
    expect(latest).toHaveLength(1)
    expect(latest[0].room.roomId).toBe('r1')
    expect(latest[0].port).toBe(45872)
    expect(latest[0].address).toBe('192.168.1.7')
  })

  it('超过 8 秒没再出现的房间会被剔除', () => {
    const base = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base)
    const fake = new FakeUdpSocket()
    const lists: StudyRoomDiscoveredRoom[][] = []
    const scanner = new StudyRoomScanner({
      onRooms: (rooms) => lists.push(rooms),
      createSocket: () => fake
    })
    cleanups.push(() => scanner.stop())
    scanner.start()

    fake.emitMessage(encodeDiscoveryPacket({ t: 'beacon', port: 45871, room: roomSummary('r1') }), {
      address: '192.168.1.7',
      port: STUDY_ROOM_UDP_PORT
    })
    expect(lists[lists.length - 1].map((r) => r.room.roomId)).toEqual(['r1'])

    nowSpy.mockReturnValue(base + 9000)
    fake.emitMessage(encodeDiscoveryPacket({ t: 'beacon', port: 45871, room: roomSummary('r2') }), {
      address: '192.168.1.8',
      port: STUDY_ROOM_UDP_PORT
    })
    expect(lists[lists.length - 1].map((r) => r.room.roomId)).toEqual(['r2'])
  })
})
