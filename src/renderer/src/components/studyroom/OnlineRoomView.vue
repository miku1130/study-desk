<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import RoomCheerBar from '@/components/studyroom/RoomCheerBar.vue'
import { useStudyRoomOnlineStore } from '@/stores/studyRoomOnline'
import { useStudyRoomStore } from '@/stores/studyRoom'
import { useUiStore } from '@/stores/ui'
import type { StudyRoomRange } from '@/types'

const store = useStudyRoomOnlineStore()
const local = useStudyRoomStore()
const ui = useUiStore()

const tab = shallowRef<'room' | 'wish'>('room')
const wishDraft = ref('')
const sending = shallowRef(false)

const RANGES: Array<{ key: StudyRoomRange; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' }
]

const room = computed(() => store.room)

function duration(seconds: number): string {
  if (seconds <= 0) return '还没开始'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

function medal(rank: number): string {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
}

async function copyCode(): Promise<void> {
  if (!room.value?.code) return
  try {
    await navigator.clipboard.writeText(room.value.code)
    ui.success('加入码已复制')
  } catch {
    ui.error('复制失败，手动记一下吧')
  }
}

async function sendWish(): Promise<void> {
  const text = wishDraft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  await store.addWish(text)
  sending.value = false
  wishDraft.value = ''
}

function wishTime(at: number): string {
  const d = new Date(at)
  return `${String(d.getMonth() + 1)}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ---- 加油 ---- */

const cheerTargetId = shallowRef('')
const cheerCooldown = shallowRef(false)
let cooldownTimer = 0

const cheerTargetName = computed(
  () => room.value?.members.find((m) => m.deviceId === cheerTargetId.value)?.nickname ?? ''
)

// 目标退出房间后要撤销选中，否则加油会发给一个不在场的人
watch(
  () => room.value?.members,
  (members) => {
    if (cheerTargetId.value && !members?.some((m) => m.deviceId === cheerTargetId.value)) {
      cheerTargetId.value = ''
    }
  }
)

/** 该成员此刻头顶该冒的表情；没有就返回空串 */
function cheerEmoji(deviceId: string): string {
  const event = local.recentCheerFor(deviceId)
  return event ? (local.cheerSpec(event.cheerId)?.emoji ?? '') : ''
}

function toggleCheerTarget(deviceId: string): void {
  cheerTargetId.value = cheerTargetId.value === deviceId ? '' : deviceId
}

async function sendCheer(cheerId: string): Promise<void> {
  if (cheerCooldown.value) return
  cheerCooldown.value = true
  window.clearTimeout(cooldownTimer)
  cooldownTimer = window.setTimeout(() => (cheerCooldown.value = false), 3000)
  await local.sendCheer(cheerTargetId.value, cheerId)
  cheerTargetId.value = ''
}

/* ---- 房主编辑 ---- */

const showEdit = shallowRef(false)
const nameDraft = ref('')
const introDraft = ref('')
const goalDraft = ref(120)

function openEdit(): void {
  if (!room.value) return
  nameDraft.value = room.value.name
  introDraft.value = room.value.intro
  goalDraft.value = room.value.goalMinutes || 120
  showEdit.value = true
}

async function saveEdit(): Promise<void> {
  if (!room.value || !nameDraft.value.trim()) return
  await store.updateStudyRoom(room.value.id, {
    name: nameDraft.value,
    intro: introDraft.value,
    goalMinutes: goalDraft.value
  })
  showEdit.value = false
}

async function joinThisRoom(): Promise<void> {
  if (!room.value) return
  await store.joinStudyRoom({ roomId: room.value.id })
  ui.success('已加入这间自习室，以后在「我的自习室」里能直接找到')
}

onUnmounted(() => window.clearTimeout(cooldownTimer))
</script>

<template>
  <div v-if="room" class="online-room">
    <header class="room-head card">
      <div class="head-top">
        <button class="btn btn-secondary btn-sm" @click="store.exitRoom()">
          <AppIcon name="back" :size="13" />离开房间
        </button>
        <div class="head-tabs">
          <button
            class="head-tab"
            :class="{ active: tab === 'room' }"
            @click="tab = 'room'"
          >
            自习室
          </button>
          <button class="head-tab" :class="{ active: tab === 'wish' }" @click="tab = 'wish'">
            许愿墙
          </button>
        </div>
        <div class="head-live">
          <strong>{{ room.focusingCount }}</strong>
          <span>人正在专注</span>
        </div>
      </div>

      <div class="head-meta">
        <div class="meta-main">
          <h2 :title="room.name">{{ room.name }}</h2>
          <p v-if="room.intro" class="room-intro">{{ room.intro }}</p>
          <div class="meta-tags">
            <span class="tag">{{ room.memberCount }} 名成员</span>
            <span class="tag">{{ room.attendeeCount }} 人在座</span>
            <span v-if="room.goalMinutes > 0" class="tag">目标 {{ room.goalMinutes }} 分钟</span>
          </div>
        </div>
        <div class="head-side">
          <button v-if="room.code" class="code-chip" title="点击复制" @click="copyCode">
            <span class="code-label">加入码</span>
            <span class="code-value">{{ room.code }}</span>
          </button>
          <button v-if="room.isOwner" class="btn btn-secondary btn-sm" @click="openEdit">
            编辑资料
          </button>
          <button v-else-if="!room.isMember" class="btn btn-sm" @click="joinThisRoom">
            加入这间自习室
          </button>
        </div>
      </div>

      <!-- 离开房间只是今天不学了，成员身份留着，这点要让用户看得见 -->
      <p class="head-hint">
        离开房间不会退出自习室，明天还能回来。
        <template v-if="room.isOwner">你是这里的主人。</template>
        <template v-else-if="!room.isMember">你还只是路过，加入后才会一直留在成员榜里。</template>
      </p>
    </header>

    <template v-if="tab === 'room'">
      <div class="range-bar">
        <div class="seg">
          <button
            v-for="item in RANGES"
            :key="item.key"
            type="button"
            class="seg-btn"
            :class="{ active: store.range === item.key }"
            @click="store.setRange(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
        <div v-if="store.selfRow" class="my-rank">
          我的名次 <strong>{{ store.selfRow.rank }}</strong>
        </div>
      </div>

      <ol class="member-list">
        <li
          v-for="member in room.members"
          :key="member.deviceId"
          class="member-item card"
          :class="{
            'is-self': member.deviceId === store.deviceId,
            'is-target': member.deviceId === cheerTargetId
          }"
          @click="toggleCheerTarget(member.deviceId)"
        >
          <span class="rank" :class="medal(member.rank)">{{ member.rank }}</span>
          <span class="avatar" :class="{ offline: !member.online }">
            <PetSpriteAnimation
              :animation="member.focusing ? 'writing' : 'idle'"
              :cat-id="member.catId"
              :label="`${member.nickname} 的猫`"
              lite
            />
            <span v-if="cheerEmoji(member.deviceId)" class="cheer-pop">
              {{ cheerEmoji(member.deviceId) }}
            </span>
          </span>
          <div class="member-info">
            <div class="name-row">
              <strong :title="member.nickname">{{ member.nickname }}</strong>
              <span v-if="member.focusing" class="badge focusing">专注中</span>
              <span v-else-if="member.online" class="badge">在座</span>
            </div>
            <p v-if="member.intro" class="member-intro">{{ member.intro }}</p>
            <div class="member-tags">
              <span v-if="member.streakDays > 0" class="mini-tag">
                连续专注 {{ member.streakDays }} 天
              </span>
              <span class="mini-tag">共专注 {{ member.totalDays }} 天</span>
              <span v-if="member.wakeAt" class="mini-tag wake">起床 {{ member.wakeAt }}</span>
            </div>
          </div>
          <span class="member-time">{{ duration(member.seconds) }}</span>
        </li>
      </ol>

      <p class="list-foot">点一位同学再选动作，就是单独给 TA 加油；不选就是给全体。</p>

      <div class="cheer-dock">
        <RoomCheerBar
          :cheers="local.cheers"
          :target-name="cheerTargetName"
          :cooldown="cheerCooldown"
          :sound-enabled="local.soundEnabled"
          @send="sendCheer"
          @update:sound-enabled="local.soundEnabled = $event"
        />
      </div>
    </template>

    <template v-else>
      <section class="card wish-compose">
        <textarea
          v-model="wishDraft"
          class="input wish-input"
          rows="2"
          maxlength="60"
          placeholder="写下一个愿望，给自己也给同学看"
        />
        <div class="wish-actions">
          <span class="wish-count">{{ wishDraft.length }}/60</span>
          <button class="btn btn-sm" :disabled="!wishDraft.trim() || sending" @click="sendWish">
            {{ sending ? '发布中…' : '许个愿' }}
          </button>
        </div>
        <p class="card-hint">
          不能写链接、联系方式和长串数字。看到不合适的内容可以举报，攒够就会自动隐藏。
        </p>
      </section>

      <ul v-if="store.wishes.length" class="wish-list">
        <li v-for="wish in store.wishes" :key="wish.id" class="wish-item card">
          <span class="avatar small">
            <PetSpriteAnimation animation="idle" :cat-id="wish.catId" lite />
          </span>
          <div class="wish-body">
            <div class="wish-head">
              <strong>{{ wish.nickname }}</strong>
              <span class="wish-time">{{ wishTime(wish.createdAt) }}</span>
            </div>
            <p class="wish-text">{{ wish.text }}</p>
          </div>
          <div class="wish-ops">
            <button
              v-if="wish.mine || room.isOwner"
              class="icon-btn"
              title="删除"
              @click="store.deleteWish(wish.id)"
            >
              <AppIcon name="trash" :size="13" />
            </button>
            <button
              v-else
              class="icon-btn"
              title="举报"
              @click="store.reportWish(wish.id)"
            >
              <AppIcon name="flag" :size="13" />
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="list-foot">还没有人许愿，来写第一个吧。</p>
    </template>

    <AppModal v-if="showEdit" title="编辑自习室" @close="showEdit = false">
      <div class="edit-form">
        <label class="field">
          <span class="field-label">名字</span>
          <input v-model="nameDraft" class="input" maxlength="16" />
        </label>
        <label class="field">
          <span class="field-label">简介</span>
          <input v-model="introDraft" class="input" maxlength="40" placeholder="一句话说明这里在学什么" />
        </label>
        <label class="field">
          <span class="field-label">集体目标 {{ goalDraft }} 分钟</span>
          <input v-model.number="goalDraft" type="range" min="30" max="1440" step="30" />
        </label>
      </div>
      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button>
        <button class="btn btn-sm" :disabled="!nameDraft.trim()" @click="saveEdit">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.online-room {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-tabs {
  display: flex;
  gap: 18px;
}

.head-tab {
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-secondary);
  padding: 2px 0;
  border-bottom: 2px solid transparent;
}

.head-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

.head-live {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}

.head-live strong {
  font-size: 18px;
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.head-live span {
  font-size: 11px;
  color: var(--text-secondary);
}

.head-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.meta-main h2 {
  font-size: 18px;
  font-weight: 800;
}

.room-intro {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--hover);
  font-size: 11px;
  font-weight: 650;
  color: var(--text-secondary);
}

.code-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px dashed var(--separator);
  background: transparent;
}

.code-label {
  font-size: 10px;
  color: var(--text-secondary);
}

.code-value {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.head-hint {
  font-size: 11.5px;
  color: var(--text-secondary);
}

.range-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.my-rank {
  font-size: 12px;
  color: var(--text-secondary);
}

.my-rank strong {
  font-size: 15px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.member-list,
.wish-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
}

.member-item,
.wish-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
}

.member-item {
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}

.member-item.is-self {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.member-item.is-target {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

/* 名次宽度固定，两位数不会把整行挤动 */
.rank {
  flex-shrink: 0;
  width: 26px;
  text-align: center;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.rank.gold {
  color: #d4a017;
}
.rank.silver {
  color: #8e9aa6;
}
.rank.bronze {
  color: #b87333;
}

.avatar {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
}

.cheer-pop {
  position: absolute;
  top: -10px;
  right: -8px;
  font-size: 17px;
  line-height: 1;
  animation: cheer-pop 0.4s var(--ease);
  pointer-events: none;
}

@keyframes cheer-pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.6);
  }
}

.avatar.small {
  width: 30px;
  height: 30px;
}

/* 不在座的人淡出，一眼能看出谁今天来了 */
.avatar.offline {
  opacity: 0.4;
  filter: grayscale(0.6);
}

.member-info,
.wish-body {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-row strong {
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--hover);
  font-size: 10px;
  font-weight: 650;
  color: var(--text-secondary);
}

.badge.focusing {
  background: var(--accent-soft);
  color: var(--accent);
}

.member-intro {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.mini-tag {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--hover);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.mini-tag.wake {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.member-time {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.list-foot {
  padding: 14px 0 4px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-secondary);
}

.head-side {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  flex-shrink: 0;
}

.cheer-dock {
  position: sticky;
  bottom: 10px;
  z-index: 5;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.wish-compose {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wish-input {
  resize: none;
  line-height: 1.5;
}

.wish-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wish-count {
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.wish-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.wish-head strong {
  font-size: 12.5px;
  font-weight: 700;
}

.wish-time {
  font-size: 10.5px;
  color: var(--text-secondary);
}

.wish-text {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.wish-ops {
  flex-shrink: 0;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  width: 26px;
  height: 26px;
  border-radius: 7px;
}

.icon-btn:hover {
  background: var(--hover);
  color: var(--text-primary);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
