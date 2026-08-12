<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useStudyRoomOnlineStore } from '@/stores/studyRoomOnline'
import { useStudyRoomStore } from '@/stores/studyRoom'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useUiStore } from '@/stores/ui'
import type { StudyRoomNameCheck } from '@/types'

const online = useStudyRoomOnlineStore()
const local = useStudyRoomStore()
const pet = usePetCompanionStore()
const ui = useUiStore()

/* ---- 我的名片 ---- */

const nicknameDraft = shallowRef('')
const nicknameDirty = shallowRef(false)
const nicknameCheck = shallowRef<StudyRoomNameCheck | null>(null)
const introDraft = shallowRef('')
let nicknameTimer = 0

watch(
  () => local.nickname,
  (value) => {
    if (!nicknameDirty.value) nicknameDraft.value = value
  },
  { immediate: true }
)

watch(
  () => online.intro,
  (value) => {
    if (!introDraft.value) introDraft.value = value
  },
  { immediate: true }
)

watch(nicknameDraft, () => {
  if (!nicknameDirty.value) return
  window.clearTimeout(nicknameTimer)
  nicknameTimer = window.setTimeout(async () => {
    nicknameCheck.value = nicknameDraft.value.trim()
      ? await local.validateName('nickname', nicknameDraft.value)
      : null
  }, 200)
})

async function saveCard(): Promise<void> {
  if (nicknameDraft.value.trim() && nicknameCheck.value?.ok !== false) {
    const result = await local.setNickname(nicknameDraft.value)
    nicknameCheck.value = result
    if (result.ok) nicknameDirty.value = false
  }
  if (introDraft.value.trim() !== online.intro) await online.setIntro(introDraft.value)
  ui.success('名片已更新')
}

/* ---- 创建自习室 ---- */

const showCreate = shallowRef(false)
const roomName = ref('')
const roomIntro = ref('')
const goalMinutes = ref(120)
const creating = shallowRef(false)

async function create(): Promise<void> {
  if (!roomName.value.trim() || creating.value) return
  creating.value = true
  await online.createRoom({
    name: roomName.value,
    intro: roomIntro.value,
    goalMinutes: goalMinutes.value
  })
  creating.value = false
  showCreate.value = false
  roomName.value = ''
  roomIntro.value = ''
}

/* ---- 加入码 ---- */

const codeDraft = ref('')

function onCodeInput(event: Event): void {
  codeDraft.value = (event.target as HTMLInputElement).value.toUpperCase()
}

async function joinByCode(): Promise<void> {
  const code = codeDraft.value.trim()
  if (!code) return
  await online.joinStudyRoom({ code })
  codeDraft.value = ''
}

const connecting = computed(() => online.status === 'connecting')

onMounted(() => {
  void online.watchBrowse(true)
})

onUnmounted(() => {
  window.clearTimeout(nicknameTimer)
  void online.watchBrowse(false)
})
</script>

<template>
  <div class="online-lobby">
    <p v-if="online.status === 'error' && online.error" class="lobby-error">{{ online.error }}</p>

    <section class="card profile-card">
      <div class="profile-cat">
        <PetSpriteAnimation animation="idle" :cat-id="pet.catId" label="我的猫" />
      </div>
      <div class="profile-form">
        <h3>我的名片</h3>
        <p class="card-hint">同学会在自习室里看到这个昵称和简介，还有你的猫。</p>
        <div class="row">
          <input
            v-model="nicknameDraft"
            class="input"
            maxlength="12"
            placeholder="起一个安静好记的昵称"
            @input="nicknameDirty = true"
          />
        </div>
        <p v-if="nicknameCheck && !nicknameCheck.ok" class="field-error">
          {{ nicknameCheck.reason }}
        </p>
        <div class="row">
          <input
            v-model="introDraft"
            class="input"
            maxlength="30"
            placeholder="一句话简介，比如「一战成硕」"
          />
          <button class="btn btn-sm" @click="saveCard">保存</button>
        </div>

        <div class="checkin-row">
          <button class="chip" :class="{ done: online.checkin.wakeAt }" @click="online.checkInNow('wake')">
            <AppIcon name="sun" :size="13" />
            {{ online.checkin.wakeAt ? `起床 ${online.checkin.wakeAt}` : '起床打卡' }}
          </button>
          <button
            class="chip"
            :class="{ done: online.checkin.sleepAt }"
            @click="online.checkInNow('sleep')"
          >
            <AppIcon name="lantern" :size="13" />
            {{ online.checkin.sleepAt ? `睡觉 ${online.checkin.sleepAt}` : '睡觉打卡' }}
          </button>
          <span class="checkin-hint">每天各记一次，以第一次为准</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h3>我的自习室</h3>
          <p class="card-hint">加入后就一直是成员，进出房间不影响身份。</p>
        </div>
        <button class="btn btn-sm" @click="showCreate = !showCreate">
          <AppIcon name="plus" :size="13" />开一间
        </button>
      </div>

      <div v-if="showCreate" class="create-form">
        <input v-model="roomName" class="input" maxlength="16" placeholder="自习室名字" />
        <input v-model="roomIntro" class="input" maxlength="40" placeholder="一句话简介（可留空）" />
        <div class="row goal-row">
          <span class="field-label">集体目标</span>
          <input v-model.number="goalMinutes" type="range" min="30" max="1440" step="30" />
          <span class="goal-value">{{ goalMinutes }} 分钟</span>
        </div>
        <button class="btn" :disabled="!roomName.trim() || creating" @click="create">
          {{ creating ? '创建中…' : '创建自习室' }}
        </button>
      </div>

      <ul v-if="online.myRooms.length" class="room-list">
        <li v-for="item in online.myRooms" :key="item.id" class="room-item">
          <div class="room-info">
            <div class="room-name">
              <strong :title="item.name">{{ item.name }}</strong>
              <span v-if="item.isOwner" class="badge">主人</span>
            </div>
            <span class="room-meta">
              {{ item.memberCount }} 名成员 · {{ item.attendeeCount }} 人在座
              <template v-if="item.code"> · 加入码 {{ item.code }}</template>
            </span>
            <p v-if="item.intro" class="room-intro">{{ item.intro }}</p>
          </div>
          <div class="room-ops">
            <button class="btn btn-sm" @click="online.enterRoom(item.id)">进入</button>
            <button
              v-if="item.isOwner"
              class="btn btn-secondary btn-sm"
              @click="online.dissolveStudyRoom(item.id)"
            >
              解散
            </button>
            <button v-else class="btn btn-secondary btn-sm" @click="online.quitStudyRoom(item.id)">
              退出
            </button>
          </div>
        </li>
      </ul>
      <EmptyState
        v-else-if="!showCreate"
        icon="inbox"
        title="还没有加入任何自习室"
        desc="可以开一间自己的，或者用同学给的加入码进来。"
      />

      <div class="code-join">
        <span class="field-label">用加入码加入</span>
        <div class="row">
          <input
            :value="codeDraft"
            class="input code-input"
            maxlength="8"
            placeholder="ABCD1234"
            spellcheck="false"
            autocomplete="off"
            @input="onCodeInput"
            @keyup.enter="joinByCode"
          />
          <button class="btn btn-secondary" :disabled="!codeDraft.trim()" @click="joinByCode">
            加入
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h3>正在自习的房间</h3>
          <!-- 进房间只是去学一会儿，不会悄悄改成员身份 -->
          <p class="card-hint">可以先进去学一会儿看看，想留下再点加入。</p>
        </div>
        <span v-if="connecting" class="hint">连接中…</span>
      </div>

      <ul v-if="online.browse.length" class="room-list">
        <li v-for="item in online.browse" :key="item.id" class="room-item">
          <div class="room-info">
            <strong :title="item.name">{{ item.name }}</strong>
            <span class="room-meta">
              {{ item.attendeeCount }} 人在座 · {{ item.focusingCount ?? 0 }} 人专注中 ·
              {{ item.memberCount }} 名成员
            </span>
            <p v-if="item.intro" class="room-intro">{{ item.intro }}</p>
          </div>
          <button class="btn btn-sm" @click="online.enterRoom(item.id)">进去看看</button>
        </li>
      </ul>
      <EmptyState
        v-else
        icon="locate"
        title="此刻没有人在自习"
        desc="开一间自己的自习室，等同学进来。"
      />
    </section>
  </div>
</template>

<style scoped>
.online-lobby {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lobby-error {
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--status-danger) 32%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--status-danger) 10%, transparent);
  color: var(--status-danger);
  font-size: 12.5px;
}

.profile-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.profile-cat {
  flex-shrink: 0;
  width: 68px;
  height: 68px;
}

.profile-form {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-form h3 {
  font-size: 15px;
  font-weight: 800;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.row .input {
  flex: 1;
  min-width: 0;
}

.checkin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--separator);
  background: transparent;
  font-size: 12px;
  font-weight: 650;
  color: var(--text-secondary);
}

.chip:hover {
  background: var(--hover);
}

.chip.done {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.checkin-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-head h3 {
  font-size: 15px;
  font-weight: 800;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: var(--radius-md);
  background: var(--hover);
}

.goal-row {
  gap: 10px;
}

.goal-row input[type='range'] {
  flex: 1;
}

.goal-value {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
}

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--separator);
}

.room-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.room-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.room-info strong {
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
}

.room-meta {
  font-size: 11.5px;
  color: var(--text-secondary);
}

.room-intro {
  font-size: 11.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-ops {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
}

.code-join {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--separator);
}

.code-input {
  letter-spacing: 2px;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text-secondary);
}

.field-error {
  font-size: 11.5px;
  color: var(--status-danger);
}

.hint {
  font-size: 11.5px;
  color: var(--text-secondary);
}
</style>
