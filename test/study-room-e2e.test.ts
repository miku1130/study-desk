import { describe, it, expect, afterEach } from 'vitest'
import { StudyRoomService } from '../src/main/studyRoom/service'
import type { StudyRoomDeps } from '../src/main/studyRoom/service'
import { decodeRoomCode } from '../src/main/studyRoom/protocol'
import type { StudyRoomFocusReport } from '../src/main/studyRoom/protocol'
import { localDateKey } from '../src/main/time'

const NETWORK_TEST_TIMEOUT = 20_000

const idleFocus: StudyRoomFocusReport = {
  phase: 'idle',
  running: false,
  remaining: 0,
  todayFocusMinutes: 0,
  todayPomodoros: 0,
  todayRoomFocusSeconds: 0
}

const workFocus: StudyRoomFocusReport = {
  phase: 'work',
  running: true,
  remaining: 900,
  todayFocusMinutes: 42,
  todayPomodoros: 3,
  todayRoomFocusSeconds: 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function until(check: () => boolean, timeoutMs = 6000): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (!check()) {
    if (performance.now() > deadline) throw new Error('等待条件超时')
    await sleep(25)
  }
}

const cleanups: Array<() => void> = []

afterEach(async () => {
  while (cleanups.length > 0) cleanups.pop()?.()
  await sleep(40)
})

interface Peer {
  service: StudyRoomService
  channels: Array<[string, ...unknown[]]>
  /** 假 store 的底层数据，可预置也可断言持久化结果 */
  data: Record<string, unknown>
  setFocus: (focus: StudyRoomFocusReport) => void
}

/** 一个完整的自习室端：真实 StudyRoomService，只把 store / 广播 / 通知替换成内存桩 */
function makePeer(
  nickname: string,
  catId = 'mikan',
  storeSeed: Record<string, unknown> = {}
): Peer {
  const data: Record<string, unknown> = { nickname, goalMinutes: 60, ...storeSeed }
  const channels: Array<[string, ...unknown[]]> = []
  let focus: StudyRoomFocusReport = { ...idleFocus }
  const deps: StudyRoomDeps = {
    store: {
      get: (key: string) => data[key],
      set: (key: string, value: unknown) => {
        data[key] = value
      }
    } as never,
    send: (channel, ...args) => {
      channels.push([channel, ...args])
    },
    notify: () => undefined,
    getCatId: () => catId,
    getFocus: () => focus,
    enableDiscovery: false
  }
  const service = new StudyRoomService(deps)
  cleanups.push(() => service.dispose())
  return {
    service,
    channels,
    data,
    setFocus: (next) => {
      focus = next
    }
  }
}

function hostedPort(service: StudyRoomService): number {
  const decoded = decodeRoomCode(service.getState().room?.code ?? '')
  if (!decoded) throw new Error('房间码无法解析')
  return decoded.port
}

/** 开一间房并让一位访客用真实客户端连上，返回两端 */
async function openRoomWithGuest(
  guestNickname = '同桌'
): Promise<{ host: Peer; guest: Peer; port: number }> {
  const host = makePeer('班长')
  const opened = await host.service.host({ name: '三楼自习室', goalMinutes: 60 })
  expect(opened.ok).toBe(true)
  const port = hostedPort(host.service)

  const guest = makePeer(guestNickname, 'sesame')
  const joined = await guest.service.join({ address: '127.0.0.1', port })
  expect(joined).toEqual({ ok: true })
  await until(() => host.service.getState().members.length === 2)
  await until(() => guest.service.getState().members.length === 2)
  return { host, guest, port }
}

describe('自习室端到端（两个真实 StudyRoomService 互联）', () => {
  it(
    '访客加入后两端名册一致，房主标记与身份都同步',
    async () => {
      const { host, guest } = await openRoomWithGuest()

      const hostState = host.service.getState()
      const guestState = guest.service.getState()
      expect(hostState.status).toBe('hosting')
      expect(guestState.status).toBe('joined')
      expect(guestState.room?.name).toBe('三楼自习室')
      expect(guestState.room?.goalMinutes).toBe(60)

      const seenByGuest = [...guestState.members].sort((a, b) => a.nickname.localeCompare(b.nickname))
      const seenByHost = [...hostState.members].sort((a, b) => a.nickname.localeCompare(b.nickname))
      expect(seenByGuest.map((m) => m.nickname)).toEqual(seenByHost.map((m) => m.nickname))
      expect(seenByHost.filter((m) => m.host)).toHaveLength(1)

      // 访客在房主名册里保留了自己的猫，座位视图才画得对
      expect(seenByHost.find((m) => m.nickname === '同桌')?.catId).toBe('sesame')
      // 访客拿到的 selfId 必须能在名册里定位到自己
      expect(guestState.members.some((m) => m.id === guestState.selfId)).toBe(true)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客上报的专注状态会同步到房主，并按真实间隔累计房内专注时长',
    async () => {
      const { host, guest } = await openRoomWithGuest()

      guest.setFocus(workFocus)
      guest.service.reportFocus()
      await until(() => {
        const mine = host.service.getState().members.find((m) => m.nickname === '同桌')
        return mine?.running === true && mine.phase === 'work'
      })
      expect(host.service.getState().members.find((m) => m.nickname === '同桌')?.todayFocusMinutes).toBe(42)

      await sleep(1200)
      // 阶段变化会立刻上报，房主据此结算上一段专注
      guest.setFocus(idleFocus)
      guest.service.reportFocus()
      await until(() => {
        const mine = host.service.getState().members.find((m) => m.nickname === '同桌')
        return (mine?.roomFocusSeconds ?? 0) >= 1
      })

      const mine = host.service.getState().members.find((m) => m.nickname === '同桌')
      expect(mine?.roomFocusSeconds).toBeGreaterThanOrEqual(1)
      expect(mine?.roomFocusSeconds).toBeLessThanOrEqual(15)
      expect(mine?.running).toBe(false)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客加油能送达房主，两端都收到同一条加油事件',
    async () => {
      const { host, guest } = await openRoomWithGuest()
      const hostId = host.service.getState().members.find((m) => m.host)?.id ?? ''
      expect(hostId).not.toBe('')

      expect(guest.service.cheer(hostId, 'clap')).toBe(true)
      await until(() => (host.service.getState().members.find((m) => m.host)?.cheers ?? 0) === 1)
      await until(() => guest.channels.some(([c]) => c === 'study-room:cheer-event'))

      const received = guest.channels.find(([c]) => c === 'study-room:cheer-event')?.[1] as {
        cheerId: string
        fromNickname: string
        toId: string
      }
      expect(received.cheerId).toBe('clap')
      expect(received.fromNickname).toBe('同桌')
      expect(received.toId).toBe(hostId)
      // 加油只加在接收方身上，不会给自己刷数
      expect(host.service.getState().members.find((m) => m.nickname === '同桌')?.cheers).toBe(0)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '非白名单加油动作在发送端就被拒绝，不会产生任何广播',
    async () => {
      const { host, guest } = await openRoomWithGuest()
      const hostId = host.service.getState().members.find((m) => m.host)?.id ?? ''

      expect(guest.service.cheer(hostId, '加我微信 wx123456')).toBe(false)
      expect(guest.service.cheer(hostId, 'http://buy.example.com')).toBe(false)
      await sleep(300)

      expect(host.service.getState().members.find((m) => m.host)?.cheers).toBe(0)
      expect(guest.channels.some(([c]) => c === 'study-room:cheer-event')).toBe(false)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '带广告的昵称在房主名册里被清洗成安全占位名',
    async () => {
      const host = makePeer('班长')
      expect((await host.service.host({ name: '晚自习', goalMinutes: 60 })).ok).toBe(true)
      const port = hostedPort(host.service)

      const spammer = makePeer('加V:wx88888888')
      expect(await spammer.service.join({ address: '127.0.0.1', port })).toEqual({ ok: true })
      await until(() => host.service.getState().members.length === 2)

      const nicknames = host.service.getState().members.map((m) => m.nickname)
      expect(nicknames).toContain('同学')
      expect(nicknames.some((n) => n.includes('wx') || n.includes('V:'))).toBe(false)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '房主设置的新目标会同步给访客',
    async () => {
      const { host, guest } = await openRoomWithGuest()
      expect(host.service.setGoal(180)).toBe(true)
      await until(() => guest.service.getState().room?.goalMinutes === 180)
      expect(guest.service.getState().room?.goalMinutes).toBe(180)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客主动离开后房主名册收缩，房主解散后访客回到大厅',
    async () => {
      const { host, guest } = await openRoomWithGuest()

      guest.service.leave()
      expect(guest.service.getState().status).toBe('idle')
      await until(() => host.service.getState().members.length === 1)

      const rejoin = makePeer('后来的同学')
      expect(await rejoin.service.join({ address: '127.0.0.1', port: hostedPort(host.service) })).toEqual({
        ok: true
      })
      await until(() => rejoin.service.getState().status === 'joined')

      host.service.leave()
      await until(() => rejoin.service.getState().status === 'idle')
      expect(rejoin.service.getState().room).toBeNull()
      expect(rejoin.channels.some(([c, payload]) => {
        return c === 'study-room:notice' && (payload as { kind: string }).kind === 'closed'
      })).toBe(true)
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '连接不存在的自习室会失败并停在大厅，不会卡在连接中',
    async () => {
      const guest = makePeer('找错门的同学')
      const result = await guest.service.join({ address: '127.0.0.1', port: 45999 })
      expect(result.ok).toBe(false)
      expect(guest.service.getState().status).not.toBe('connecting')
      expect(guest.service.getState().room).toBeNull()
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    '访客的 todayRoomFocusSeconds 会透传到房主名册，但不影响房内计时与集体目标',
    async () => {
      const host = makePeer('班长')
      expect((await host.service.host({ name: '三楼自习室', goalMinutes: 60 })).ok).toBe(true)

      // 访客本机已累计 1234 秒（今天），加入时随 hello 上报
      const guest = makePeer('同桌', 'sesame', {
        todayRoomFocus: { date: localDateKey(), seconds: 1234 }
      })
      expect(
        await guest.service.join({ address: '127.0.0.1', port: hostedPort(host.service) })
      ).toEqual({ ok: true })
      await until(() => host.service.getState().members.length === 2)

      const seenByHost = host.service.getState().members.find((m) => m.nickname === '同桌')
      expect(seenByHost?.todayRoomFocusSeconds).toBe(1234)
      // 今日累计只做展示：不改本次房内计时，也不推动集体目标
      expect(seenByHost?.roomFocusSeconds).toBe(0)
      expect(host.service.getState().room?.focusMinutes).toBe(0)

      // 访客也能从房主广播的名册里看到自己的这项数据
      await until(() =>
        guest.service
          .getState()
          .members.some((m) => m.id === guest.service.getState().selfId && m.todayRoomFocusSeconds === 1234)
      )
    },
    NETWORK_TEST_TIMEOUT
  )

  it(
    'leave 后再 host：todayRoomFocusSeconds 不归零，而 roomFocusSeconds 从零开始',
    async () => {
      const peer = makePeer('班长')
      peer.setFocus(workFocus)
      expect((await peer.service.host({ name: '第一间', goalMinutes: 60 })).ok).toBe(true)

      // 在房内保持「running 的 work」超过 1 秒，离开时结算并强制落盘
      await sleep(1200)
      peer.service.leave()
      const saved = peer.data.todayRoomFocus as { date: string; seconds: number }
      expect(saved.date).toBe(localDateKey())
      expect(saved.seconds).toBeGreaterThanOrEqual(1)

      // 换一间房：今日累计继承，本房计时归零——这正是两个指标的区别
      expect((await peer.service.host({ name: '第二间', goalMinutes: 60 })).ok).toBe(true)
      const self = peer.service.getState().members[0]
      expect(self.todayRoomFocusSeconds).toBeGreaterThanOrEqual(saved.seconds)
      expect(self.roomFocusSeconds).toBe(0)
    },
    NETWORK_TEST_TIMEOUT
  )
})
