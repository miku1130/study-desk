import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { playChime } from '@/lib/audio'
import type {
  StudyRoomBrief,
  StudyRoomDetail,
  StudyRoomOnline,
  StudyRoomRange,
  StudyRoomWish
} from '@/types'

/**
 * 公网自习室的渲染层镜像。
 *
 * 服务器是唯一权威，这里收到快照就整体替换，不在本地维护任何业务规则。
 *
 * 两个概念在整个 UI 里都要分清楚：
 *   - 加入 / 退出「自习室」是成员身份，账号级别，关掉应用也还在；
 *   - 进入 / 离开「房间」只是今天来不来学，走了仍然是成员。
 */
export const useStudyRoomOnlineStore = defineStore('studyRoomOnline', () => {
  const status = shallowRef<StudyRoomOnline['status']>('idle')
  const error = shallowRef('')
  const deviceId = shallowRef('')
  const intro = shallowRef('')
  const checkin = ref({ wakeAt: '', sleepAt: '' })
  const myRooms = ref<StudyRoomBrief[]>([])
  const browse = ref<StudyRoomBrief[]>([])
  const room = ref<StudyRoomDetail | null>(null)
  const wishes = ref<StudyRoomWish[]>([])
  const loaded = shallowRef(false)

  let unsubscribe: (() => void) | null = null
  let initPromise: Promise<void> | null = null

  const connected = computed(() => status.value === 'online')
  const inRoom = computed(() => room.value !== null)
  const isOwner = computed(() => room.value?.isOwner ?? false)
  const isMember = computed(() => room.value?.isMember ?? false)
  const range = computed<StudyRoomRange>(() => room.value?.range ?? 'today')
  /** 我在当前房内的那一行，用于顶部显示自己的名次 */
  const selfRow = computed(
    () => room.value?.members.find((m) => m.deviceId === deviceId.value) ?? null
  )

  function apply(snapshot: StudyRoomOnline | null): void {
    if (!snapshot) {
      status.value = 'idle'
      room.value = null
      wishes.value = []
      return
    }
    status.value = snapshot.status
    error.value = snapshot.error
    deviceId.value = snapshot.deviceId
    intro.value = snapshot.intro
    checkin.value = snapshot.checkin
    myRooms.value = snapshot.myRooms
    browse.value = snapshot.browse
    room.value = snapshot.room
    wishes.value = snapshot.wishes
  }

  async function init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      unsubscribe = window.api.studyRoom.onOnline((snapshot) => apply(snapshot))
      apply(await window.api.studyRoom.onlineSnapshot())
      await window.api.studyRoom.onlineConnect()
      loaded.value = true
    })()
    try {
      await initPromise
    } catch (err) {
      initPromise = null
      throw err
    }
  }

  function dispose(): void {
    unsubscribe?.()
    unsubscribe = null
    initPromise = null
    loaded.value = false
  }

  /* ---- 自习室：成员关系 ---- */

  const createRoom = (options: { name: string; intro: string; goalMinutes: number }): Promise<void> =>
    window.api.studyRoom.createRoom(options)

  const joinStudyRoom = (params: { roomId?: string; code?: string }): Promise<void> =>
    window.api.studyRoom.joinStudyRoom(params)

  async function quitStudyRoom(roomId: string): Promise<void> {
    const ui = useUiStore()
    const ok = await ui.confirm({
      title: '退出这个自习室？',
      message: '退出后不再是成员，房内榜也看不到你了。想继续的话可以用加入码再进来。',
      confirmText: '退出'
    })
    if (!ok) return
    await window.api.studyRoom.quitStudyRoom(roomId)
  }

  async function dissolveStudyRoom(roomId: string): Promise<void> {
    const ui = useUiStore()
    const ok = await ui.confirm({
      title: '解散这个自习室？',
      message: '所有成员会被移出，许愿墙也会一并清空。这个操作没法撤销。',
      confirmText: '解散',
      danger: true
    })
    if (!ok) return
    await window.api.studyRoom.dissolveStudyRoom(roomId)
  }

  const updateStudyRoom = (
    roomId: string,
    patch: { name?: string; intro?: string; goalMinutes?: number }
  ): Promise<void> => window.api.studyRoom.updateStudyRoom(roomId, patch)

  /* ---- 房间：今天来不来学 ---- */

  const enterRoom = (roomId: string): Promise<void> => window.api.studyRoom.enterRoom(roomId)
  const exitRoom = (): Promise<void> => window.api.studyRoom.exitRoom()
  const setRange = (next: StudyRoomRange): Promise<void> => window.api.studyRoom.setRange(next)
  const watchBrowse = (on: boolean): Promise<void> => window.api.studyRoom.watchBrowse(on)
  const goOffline = (): Promise<void> => window.api.studyRoom.goOffline()

  /* ---- 个人 ---- */

  const setIntro = (text: string): Promise<void> => window.api.studyRoom.setIntro(text)

  async function checkInNow(kind: 'wake' | 'sleep'): Promise<void> {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    await window.api.studyRoom.checkIn(kind, hhmm)
    playChime('marimba', 0.3)
  }

  /* ---- 许愿墙 ---- */

  const addWish = (text: string): Promise<void> => window.api.studyRoom.addWish(text)
  const reportWish = (id: number): Promise<void> => window.api.studyRoom.reportWish(id)

  async function deleteWish(id: number): Promise<void> {
    const ui = useUiStore()
    const ok = await ui.confirm({ title: '删掉这条愿望？', message: '删了就找不回来了。', confirmText: '删除' })
    if (!ok) return
    await window.api.studyRoom.deleteWish(id)
  }

  return {
    status,
    error,
    deviceId,
    intro,
    checkin,
    myRooms,
    browse,
    room,
    wishes,
    loaded,
    connected,
    inRoom,
    isOwner,
    isMember,
    range,
    selfRow,
    init,
    dispose,
    createRoom,
    joinStudyRoom,
    quitStudyRoom,
    dissolveStudyRoom,
    updateStudyRoom,
    enterRoom,
    exitRoom,
    setRange,
    watchBrowse,
    goOffline,
    setIntro,
    checkInNow,
    addWish,
    reportWish,
    deleteWish
  }
})
