import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { playChime } from '@/lib/audio'
import { useUiStore } from '@/stores/ui'
import type {
  StudyRoomCheer,
  StudyRoomCheerEvent,
  StudyRoomDiscovered,
  StudyRoomMember,
  StudyRoomNameCheck,
  StudyRoomNotice,
  StudyRoomState,
  StudyRoomStatus,
  StudyRoomSummary
} from '@/types'

/** 加油气泡在座位卡片上的存活时长（毫秒） */
const CHEER_BUBBLE_MS = 3500
/** 内部加油事件流最多保留的条数 */
const CHEER_FEED_LIMIT = 30
/** 气泡过期检测的计时步长（毫秒） */
const CHEER_TICK_MS = 500

interface CheerFeedEntry {
  event: StudyRoomCheerEvent
  /** 过期时刻按本地接收时间推算，不依赖远端时间戳，避免跨机器时钟偏差 */
  expiresAt: number
}

/**
 * 局域网自习室的渲染层镜像。
 *
 * 主进程（`window.api.studyRoom`）是唯一权威状态源：本 store 不维护名册业务逻辑，
 * 收到 `onState` 即整体替换。持久化（昵称 / 目标）只能经主进程写入，
 * 渲染层严禁直接写 `study-room` 存储，否则会覆盖主进程持有的数据。
 */
export const useStudyRoomStore = defineStore('studyRoom', () => {
  const status = shallowRef<StudyRoomStatus>('idle')
  const selfId = shallowRef('')
  const nickname = shallowRef('')
  const room = ref<StudyRoomSummary | null>(null)
  const members = ref<StudyRoomMember[]>([])
  const error = shallowRef('')
  const rooms = ref<StudyRoomDiscovered[]>([])
  const cheers = ref<StudyRoomCheer[]>([])
  const discovering = shallowRef(false)
  const loaded = shallowRef(false)
  /** 仅当前会话有效的音效开关，不持久化 */
  const soundEnabled = shallowRef(true)

  const cheerFeed = ref<CheerFeedEntry[]>([])
  /** 气泡过期判断的计时基准，只在存在活跃气泡时由定时器推进 */
  const now = shallowRef(Date.now())

  let subs: Array<() => void> = []
  let initPromise: Promise<void> | null = null
  let bubbleTimer: number | null = null

  const connected = computed(() => status.value === 'hosting' || status.value === 'joined')
  const isHost = computed(() => status.value === 'hosting')
  const self = computed(() => members.value.find((member) => member.id === selfId.value))
  const ranked = computed(() =>
    [...members.value].sort(
      (a, b) => b.roomFocusSeconds - a.roomFocusSeconds || a.joinedAt - b.joinedAt
    )
  )
  const focusingCount = computed(
    () => members.value.filter((member) => member.running && member.phase === 'work').length
  )
  const roomFocusMinutes = computed(() => room.value?.focusMinutes ?? 0)
  const goalMinutes = computed(() => room.value?.goalMinutes ?? 0)
  const goalProgress = computed(() => {
    if (goalMinutes.value <= 0) return 0
    return Math.min(1, Math.max(0, roomFocusMinutes.value / goalMinutes.value))
  })

  function applyState(state: StudyRoomState): void {
    status.value = state.status
    selfId.value = state.selfId
    nickname.value = state.nickname
    room.value = state.room
    members.value = state.members
    error.value = state.error
  }

  function hasActiveBubble(at: number): boolean {
    return cheerFeed.value.some((entry) => entry.expiresAt > at)
  }

  function stopBubbleTimer(): void {
    if (bubbleTimer === null) return
    window.clearInterval(bubbleTimer)
    bubbleTimer = null
  }

  function startBubbleTimer(): void {
    if (bubbleTimer !== null) return
    bubbleTimer = window.setInterval(() => {
      now.value = Date.now()
      if (!hasActiveBubble(now.value)) stopBubbleTimer()
    }, CHEER_TICK_MS)
  }

  function cheerTargetsSelf(event: StudyRoomCheerEvent): boolean {
    if (!selfId.value) return false
    if (event.toId === selfId.value) return true
    return event.toId === '' && event.fromId !== selfId.value
  }

  function handleCheer(event: StudyRoomCheerEvent): void {
    const receivedAt = Date.now()
    cheerFeed.value = [
      ...cheerFeed.value,
      { event, expiresAt: receivedAt + CHEER_BUBBLE_MS }
    ].slice(-CHEER_FEED_LIMIT)
    now.value = receivedAt
    startBubbleTimer()
    if (soundEnabled.value && cheerTargetsSelf(event)) playChime('marimba', 0.35)
  }

  function handleNotice(notice: StudyRoomNotice): void {
    const ui = useUiStore()
    switch (notice.kind) {
      case 'goal':
        ui.success(notice.text)
        if (soundEnabled.value) playChime('chord', 0.45)
        break
      case 'error':
        ui.error(notice.text)
        break
      default:
        ui.info(notice.text)
    }
  }

  /** 幂等初始化：拉取全量状态与加油目录，并注册主进程事件订阅（重复调用不重复订阅） */
  async function init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const [state, catalog] = await Promise.all([
        window.api.studyRoom.getState(),
        window.api.studyRoom.getCheers()
      ])
      applyState(state)
      cheers.value = catalog
      subs = [
        window.api.studyRoom.onState((next) => applyState(next)),
        window.api.studyRoom.onRooms((list) => {
          rooms.value = list
        }),
        window.api.studyRoom.onCheer((event) => handleCheer(event)),
        window.api.studyRoom.onNotice((notice) => handleNotice(notice))
      ]
      loaded.value = true
    })()
    try {
      await initPromise
    } catch (err) {
      initPromise = null
      throw err
    }
  }

  /** 注销所有主进程订阅并停掉气泡计时器，之后可再次 init */
  function dispose(): void {
    for (const unsubscribe of subs) unsubscribe()
    subs = []
    initPromise = null
    stopBubbleTimer()
    cheerFeed.value = []
    loaded.value = false
  }

  function validateName(kind: 'nickname' | 'room', text: string): Promise<StudyRoomNameCheck> {
    return window.api.studyRoom.validateName(kind, text)
  }

  async function setNickname(text: string): Promise<StudyRoomNameCheck> {
    const result = await window.api.studyRoom.setNickname(text)
    if (result.ok) nickname.value = result.value
    return result
  }

  function hostRoom(options: {
    name: string
    goalMinutes: number
  }): Promise<{ ok: boolean; error?: string }> {
    return window.api.studyRoom.host(options)
  }

  function joinRoom(target: {
    address?: string
    port?: number
    code?: string
  }): Promise<{ ok: boolean; error?: string }> {
    return window.api.studyRoom.join(target)
  }

  function joinDiscovered(entry: StudyRoomDiscovered): Promise<{ ok: boolean; error?: string }> {
    return joinRoom({ address: entry.address, port: entry.port })
  }

  async function leaveRoom(): Promise<void> {
    await window.api.studyRoom.leave()
  }

  async function setGoal(minutes: number): Promise<void> {
    await window.api.studyRoom.setGoal(minutes)
  }

  /** toId 传空字符串表示给全体加油 */
  async function sendCheer(toId: string, cheerId: string): Promise<void> {
    await window.api.studyRoom.cheer(toId, cheerId)
  }

  async function startDiscovery(): Promise<void> {
    await window.api.studyRoom.startDiscovery()
    discovering.value = true
  }

  async function stopDiscovery(): Promise<void> {
    await window.api.studyRoom.stopDiscovery()
    discovering.value = false
  }

  function cheerSpec(cheerId: string): StudyRoomCheer | undefined {
    return cheers.value.find((cheer) => cheer.id === cheerId)
  }

  /**
   * 该成员最近 3.5 秒内收到的加油事件（多条时取最新）。
   * 全体加油（toId 为空）对除发送者外的所有成员都算命中；
   * 依赖 now 计时基准，气泡到期后自动变为 undefined。
   */
  function recentCheerFor(memberId: string): StudyRoomCheerEvent | undefined {
    const at = now.value
    for (let i = cheerFeed.value.length - 1; i >= 0; i--) {
      const entry = cheerFeed.value[i]
      if (entry.expiresAt <= at) continue
      const { event } = entry
      if (event.toId === memberId) return event
      if (event.toId === '' && event.fromId !== memberId) return event
    }
    return undefined
  }

  return {
    status,
    selfId,
    nickname,
    room,
    members,
    error,
    rooms,
    cheers,
    discovering,
    loaded,
    soundEnabled,
    connected,
    isHost,
    self,
    ranked,
    focusingCount,
    roomFocusMinutes,
    goalMinutes,
    goalProgress,
    init,
    dispose,
    validateName,
    setNickname,
    hostRoom,
    joinRoom,
    joinDiscovered,
    leaveRoom,
    setGoal,
    sendCheer,
    startDiscovery,
    stopDiscovery,
    cheerSpec,
    recentCheerFor
  }
})
