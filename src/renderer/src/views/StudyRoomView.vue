<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import RoomLobby from '@/components/studyroom/RoomLobby.vue'
import RoomSeatCard from '@/components/studyroom/RoomSeatCard.vue'
import RoomCheerBar from '@/components/studyroom/RoomCheerBar.vue'
import { formatFocusDuration, useStudyRoomStore } from '@/stores/studyRoom'
import { useUiStore } from '@/stores/ui'

const store = useStudyRoomStore()
const ui = useUiStore()

const onlineCount = computed(() => store.members.filter((member) => member.online).length)
const roomMinutes = computed(() => Math.floor(store.roomFocusMinutes))
const progressPct = computed(() => Math.min(100, Math.round(store.goalProgress * 100)))
const goalReached = computed(() => store.goalProgress >= 1)
const selfTodayRoomTime = computed(() =>
  formatFocusDuration(store.self?.todayRoomFocusSeconds ?? 0)
)

async function copyRoomCode(): Promise<void> {
  const code = store.room?.code
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    ui.success('房间码已复制')
  } catch {
    ui.error('复制失败了，手动抄一下房间码吧')
  }
}

async function leaveRoom(): Promise<void> {
  const ok = await ui.confirm({
    title: '离开自习室',
    message: store.isHost
      ? '你是房主，离开后这间自习室会解散，同学们也会回到大厅。'
      : '要离开这间自习室吗？之后随时可以再回来。',
    confirmText: '离开',
    danger: true
  })
  if (ok) await store.leaveRoom()
}

const showGoalModal = shallowRef(false)
const goalDraft = shallowRef(120)

function openGoalModal(): void {
  goalDraft.value = store.goalMinutes
  showGoalModal.value = true
}

async function saveGoal(): Promise<void> {
  const value = Math.min(1440, Math.max(15, Math.round(goalDraft.value || 15)))
  await store.setGoal(value)
  showGoalModal.value = false
  ui.success('集体目标已更新')
}

const cheerTargetId = shallowRef('')
const cheerCooldown = shallowRef(false)
let cooldownTimer = 0

const cheerTargetName = computed(
  () => store.members.find((member) => member.id === cheerTargetId.value)?.nickname ?? ''
)

watch(
  () => store.members,
  (members) => {
    if (cheerTargetId.value && !members.some((member) => member.id === cheerTargetId.value)) {
      cheerTargetId.value = ''
    }
  }
)

function toggleCheerTarget(memberId: string): void {
  cheerTargetId.value = cheerTargetId.value === memberId ? '' : memberId
}

async function sendCheer(cheerId: string): Promise<void> {
  if (cheerCooldown.value || !store.connected) return
  cheerCooldown.value = true
  window.clearTimeout(cooldownTimer)
  cooldownTimer = window.setTimeout(() => (cheerCooldown.value = false), 3000)
  await store.sendCheer(cheerTargetId.value, cheerId)
  cheerTargetId.value = ''
}

onMounted(() => {
  void store.init()
})

onUnmounted(() => {
  window.clearTimeout(cooldownTimer)
  if (store.discovering) void store.stopDiscovery()
  store.dispose()
})
</script>

<template>
  <div class="page study-room-page">
    <RoomLobby v-if="!store.connected" />

    <section v-else class="study-room-live">
      <header class="card room-head">
        <div class="room-head-info">
          <div class="room-title-row">
            <h2 class="room-name" :title="store.room?.name">{{ store.room?.name }}</h2>
            <span class="badge">{{ onlineCount }}/{{ store.room?.maxMembers }} 人在线</span>
          </div>
          <div class="room-meta">
            <span>房主 {{ store.room?.hostNickname }}</span>
            <span class="room-meta-sep">·</span>
            <span>房间码</span>
            <button type="button" class="room-code" title="点击复制房间码" @click="copyRoomCode">
              {{ store.room?.code }}
            </button>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="leaveRoom">离开自习室</button>
      </header>
      <p class="room-note">仅同一 WiFi 可见 · 只能用预设动作互动，没有聊天框，杜绝广告打扰</p>

      <section class="card goal-card">
        <div class="goal-head">
          <h3>集体目标</h3>
          <div class="goal-head-side">
            <span class="goal-text">
              已专注 <strong>{{ roomMinutes }}</strong> 分钟 / 目标 {{ store.goalMinutes }} 分钟
            </span>
            <button v-if="store.isHost" type="button" class="btn-link" @click="openGoalModal">
              调整目标
            </button>
          </div>
        </div>
        <div class="goal-bar" :class="{ reached: goalReached }">
          <span class="goal-fill" :style="{ width: progressPct + '%' }" />
        </div>
        <p v-if="goalReached" class="goal-cheerline">目标达成，今天的大家都很了不起</p>
      </section>

      <div class="card-grid overview-grid">
        <div class="card mini">
          <p class="mini-label">正在专注</p>
          <p class="mini-value">{{ store.focusingCount }} <small>人</small></p>
        </div>
        <div class="card mini">
          <p class="mini-label">房间累计专注</p>
          <p class="mini-value">{{ roomMinutes }} <small>分钟</small></p>
        </div>
        <div class="card mini" title="今天在自习室里的累计专注，换房间、断线重连都会接着记">
          <p class="mini-label">我今天在自习室</p>
          <p class="mini-value mini-duration">{{ selfTodayRoomTime }}</p>
        </div>
      </div>

      <h3 class="section-title seat-title">自习座位</h3>
      <div class="seat-grid">
        <RoomSeatCard
          v-for="(member, index) in store.ranked"
          :key="member.id"
          :member="member"
          :rank="index + 1"
          :is-self="member.id === store.selfId"
          :cheer="store.recentCheerFor(member.id)"
          @cheer="toggleCheerTarget"
        />
      </div>

      <div class="cheer-dock">
        <RoomCheerBar
          :cheers="store.cheers"
          :target-name="cheerTargetName"
          :cooldown="cheerCooldown"
          :sound-enabled="store.soundEnabled"
          @send="sendCheer"
          @update:sound-enabled="store.soundEnabled = $event"
        />
      </div>
    </section>

    <AppModal v-if="showGoalModal" title="调整集体目标" @close="showGoalModal = false">
      <p class="goal-modal-hint">
        大家在房间里的专注分钟会一起累计，进度条走满就算达成，定一个跳一跳够得着的数字吧。
      </p>
      <div class="goal-modal-controls">
        <input v-model.number="goalDraft" type="range" min="15" max="1440" step="15" />
        <div class="row goal-modal-row">
          <input
            v-model.number="goalDraft"
            class="input input-sm goal-modal-num"
            type="number"
            min="15"
            max="1440"
            step="15"
          />
          <span class="goal-modal-unit">分钟（15–1440）</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="showGoalModal = false">取消</button>
        <button class="btn btn-sm" @click="saveGoal">保存目标</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.study-room-live {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.room-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.room-head-info {
  flex: 1;
  min-width: 0;
}

.room-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.room-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 21px;
  letter-spacing: -0.02em;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 9px;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.room-meta-sep {
  color: var(--text-tertiary);
}

.room-code {
  padding: 3px 10px;
  border: 1px dashed color-mix(in srgb, var(--accent) 42%, transparent);
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  transition:
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease),
    transform var(--duration-fast) var(--ease);
}

.room-code:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-style: solid;
}

.room-code:active {
  transform: scale(0.97);
}

.room-note {
  margin: -6px 4px 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.goal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.goal-head h3 {
  font-size: 15px;
}

.goal-head-side {
  display: flex;
  align-items: center;
  gap: 14px;
}

.goal-text {
  color: var(--text-secondary);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.goal-text strong {
  color: var(--accent-strong);
  font-size: 14px;
}

.goal-bar {
  height: 10px;
  margin-top: 13px;
  border-radius: 999px;
  background: var(--surface-pressed);
  overflow: hidden;
  transition: box-shadow 0.5s var(--ease);
}

.goal-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 55%, #fff),
    var(--accent),
    var(--accent-strong)
  );
  transition: width 0.45s var(--ease);
}

.goal-bar.reached {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.goal-bar.reached .goal-fill {
  animation: goal-glow 2.6s ease-in-out infinite;
}

@keyframes goal-glow {
  50% {
    filter: brightness(1.14) saturate(1.12);
  }
}

.goal-cheerline {
  margin-top: 10px;
  color: var(--accent-strong);
  font-size: 12.5px;
  font-weight: 680;
}

.overview-grid {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.mini-label {
  color: var(--text-tertiary);
  font-size: 12.5px;
  font-weight: 600;
}

.mini-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mini-value small {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.mini-duration {
  font-size: 19px;
  line-height: 1.5;
}

.seat-title {
  margin: 2px 4px 0;
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.cheer-dock {
  position: sticky;
  bottom: 10px;
  z-index: 5;
  margin-top: 2px;
}

.goal-modal-hint {
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.goal-modal-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}

.goal-modal-controls input[type='range'] {
  width: 100%;
}

.goal-modal-num {
  width: 92px;
  text-align: center;
}

.goal-modal-unit {
  color: var(--text-secondary);
  font-size: 12.5px;
}

@media (max-width: 700px) {
  .room-head {
    flex-direction: column;
  }

  .goal-head-side {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
