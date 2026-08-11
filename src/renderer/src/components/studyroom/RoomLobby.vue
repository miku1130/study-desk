<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useStudyRoomStore } from '@/stores/studyRoom'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useUiStore } from '@/stores/ui'
import type { StudyRoomDiscovered, StudyRoomNameCheck } from '@/types'

const store = useStudyRoomStore()
const pet = usePetCompanionStore()
const ui = useUiStore()

const GOAL_PRESETS = [60, 120, 180, 240]

const nicknameDraft = shallowRef('')
const nicknameDirty = shallowRef(false)
const nicknameCheck = shallowRef<StudyRoomNameCheck | null>(null)
const savingNickname = shallowRef(false)
let nicknameTimer = 0

watch(
  () => store.nickname,
  (value) => {
    if (!nicknameDirty.value) nicknameDraft.value = value
  },
  { immediate: true }
)

watch(nicknameDraft, () => {
  if (!nicknameDirty.value) return
  window.clearTimeout(nicknameTimer)
  nicknameTimer = window.setTimeout(async () => {
    nicknameCheck.value = nicknameDraft.value.trim()
      ? await store.validateName('nickname', nicknameDraft.value)
      : null
  }, 200)
})

const nicknameSaveDisabled = computed(
  () =>
    savingNickname.value || !nicknameDraft.value.trim() || nicknameCheck.value?.ok === false
)

async function saveNickname(): Promise<void> {
  if (nicknameSaveDisabled.value) return
  savingNickname.value = true
  const result = await store.setNickname(nicknameDraft.value)
  savingNickname.value = false
  nicknameCheck.value = result
  if (result.ok) {
    nicknameDraft.value = result.value
    nicknameDirty.value = false
    ui.success('昵称已保存')
  }
}

const roomNameDraft = shallowRef('')
const roomCheck = shallowRef<StudyRoomNameCheck | null>(null)
let roomTimer = 0

watch(roomNameDraft, () => {
  window.clearTimeout(roomTimer)
  roomTimer = window.setTimeout(async () => {
    roomCheck.value = roomNameDraft.value.trim()
      ? await store.validateName('room', roomNameDraft.value)
      : null
  }, 200)
})

const goalChoice = shallowRef<number | 'custom'>(120)
const customGoal = shallowRef(90)
const goalMinutes = computed(() =>
  goalChoice.value === 'custom' ? customGoal.value : goalChoice.value
)

const creating = shallowRef(false)
const createDisabled = computed(
  () => creating.value || !roomNameDraft.value.trim() || roomCheck.value?.ok === false
)

async function createRoom(): Promise<void> {
  if (createDisabled.value) return
  creating.value = true
  const result = await store.hostRoom({
    name: roomNameDraft.value,
    goalMinutes: goalMinutes.value
  })
  creating.value = false
  if (!result.ok) ui.error(result.error || store.error || '创建失败了，稍后再试试吧')
}

const connecting = computed(() => store.status === 'connecting')
const joiningId = shallowRef('')
const codeDraft = shallowRef('')
const codeJoining = shallowRef(false)

async function toggleDiscovery(): Promise<void> {
  if (store.discovering) await store.stopDiscovery()
  else await store.startDiscovery()
}

async function joinFound(entry: StudyRoomDiscovered): Promise<void> {
  if (connecting.value) return
  joiningId.value = entry.room.roomId
  const result = await store.joinDiscovered(entry)
  joiningId.value = ''
  if (!result.ok) ui.error(result.error || store.error || '没能加入这间自习室，稍后再试试吧')
}

function onCodeInput(event: Event): void {
  codeDraft.value = (event.target as HTMLInputElement).value.toUpperCase()
}

async function joinByCode(): Promise<void> {
  const code = codeDraft.value.trim()
  if (!code || connecting.value) return
  codeJoining.value = true
  const result = await store.joinRoom({ code })
  codeJoining.value = false
  if (!result.ok) ui.error(result.error || store.error || '房间码没有连上，检查一下拼写或网络吧')
}

onUnmounted(() => {
  window.clearTimeout(nicknameTimer)
  window.clearTimeout(roomTimer)
  if (store.discovering) void store.stopDiscovery()
})
</script>

<template>
  <div class="study-room-lobby">
    <p v-if="store.status === 'error' && store.error" class="lobby-error">{{ store.error }}</p>

    <section class="card profile-card">
      <div class="profile-cat">
        <PetSpriteAnimation
          class="profile-cat-sprite"
          animation="idle"
          :cat-id="pet.catId"
          label="我的猫"
        />
      </div>
      <div class="profile-form">
        <h3>我的名片</h3>
        <p class="card-hint">同学们会在自习室里看到这个昵称，还有你的猫。</p>
        <div class="row profile-row">
          <input
            v-model="nicknameDraft"
            class="input profile-input"
            maxlength="12"
            placeholder="起一个安静好记的昵称"
            @input="nicknameDirty = true"
          />
          <button class="btn btn-sm" :disabled="nicknameSaveDisabled" @click="saveNickname">
            {{ savingNickname ? '保存中…' : '保存' }}
          </button>
        </div>
        <p v-if="nicknameCheck && !nicknameCheck.ok" class="field-error">
          {{ nicknameCheck.reason }}
        </p>
      </div>
    </section>

    <div class="lobby-grid">
      <section class="card host-card">
        <h3>创建自习室</h3>
        <p class="card-hint">当一回房主，和同一 WiFi 下的同学一起把目标走满。</p>

        <label class="field-label" for="study-room-name">自习室名字</label>
        <input
          id="study-room-name"
          v-model="roomNameDraft"
          class="input"
          maxlength="16"
          placeholder="例如：期末冲刺小队"
        />
        <p v-if="roomCheck && !roomCheck.ok" class="field-error">{{ roomCheck.reason }}</p>

        <span class="field-label">集体目标</span>
        <div class="seg goal-seg">
          <button
            v-for="preset in GOAL_PRESETS"
            :key="preset"
            type="button"
            class="seg-btn"
            :class="{ active: goalChoice === preset }"
            @click="goalChoice = preset"
          >
            {{ preset / 60 }} 小时
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: goalChoice === 'custom' }"
            @click="goalChoice = 'custom'"
          >
            自定义
          </button>
        </div>
        <div v-if="goalChoice === 'custom'" class="row goal-custom">
          <input v-model.number="customGoal" type="range" min="15" max="1440" step="15" />
          <span class="goal-value">{{ customGoal }} 分钟</span>
        </div>

        <button class="btn host-submit" :disabled="createDisabled" @click="createRoom">
          {{ creating ? '创建中…' : '创建自习室' }}
        </button>
      </section>

      <section class="card join-card">
        <div class="join-head">
          <div>
            <h3>加入自习室</h3>
            <p class="card-hint">同学已经开好房间的话，搜一下就能找到。</p>
          </div>
          <button
            class="btn btn-secondary btn-sm"
            :class="{ 'is-discovering': store.discovering }"
            @click="toggleDiscovery"
          >
            {{ store.discovering ? '停止搜索' : '搜索附近' }}
          </button>
        </div>

        <template v-if="store.rooms.length">
          <p v-if="store.discovering" class="discover-tip">
            <span class="pulse-dot" />正在搜索同一 WiFi 下的自习室…
          </p>
          <ul class="found-list">
            <li v-for="entry in store.rooms" :key="entry.room.roomId" class="found-item">
              <div class="found-info">
                <strong :title="entry.room.name">{{ entry.room.name }}</strong>
                <span>
                  房主 {{ entry.room.hostNickname }} · {{ entry.room.memberCount }}/{{
                    entry.room.maxMembers
                  }}
                  人 · 目标 {{ entry.room.goalMinutes }} 分钟
                </span>
              </div>
              <button class="btn btn-sm" :disabled="connecting" @click="joinFound(entry)">
                {{ connecting && joiningId === entry.room.roomId ? '连接中…' : '加入' }}
              </button>
            </li>
          </ul>
        </template>
        <div v-else-if="store.discovering" class="discover-empty">
          <span class="pulse-dot" />正在搜索同一 WiFi 下的自习室…
        </div>
        <EmptyState
          v-else
          icon="locate"
          title="没有搜到自习室"
          desc="可以让同学创建一个，或用房间码加入。"
        />

        <div class="code-join">
          <span class="field-label">用房间码加入</span>
          <div class="row">
            <input
              :value="codeDraft"
              class="input code-input"
              maxlength="11"
              placeholder="ABCDE-FGHJK"
              spellcheck="false"
              autocomplete="off"
              @input="onCodeInput"
              @keyup.enter="joinByCode"
            />
            <button
              class="btn btn-secondary"
              :disabled="!codeDraft.trim() || connecting"
              @click="joinByCode"
            >
              {{ codeJoining && connecting ? '连接中…' : '加入' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.study-room-lobby {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lobby-error {
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--status-danger) 32%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--status-danger) 10%, transparent);
  color: var(--status-danger);
  font-size: 12.5px;
  font-weight: 650;
}

h3 {
  font-size: 16px;
}

.card-hint {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.55;
}

.field-label {
  display: block;
  margin: 15px 2px 7px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.field-error {
  margin-top: 7px;
  color: var(--status-danger);
  font-size: 12px;
  font-weight: 650;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 18px;
}

.profile-cat {
  width: 110px;
  height: 98px;
  flex-shrink: 0;
  padding: 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.profile-cat-sprite {
  width: 100%;
  height: 100%;
}

.profile-form {
  flex: 1;
  min-width: 0;
}

.profile-row {
  margin-top: 12px;
}

.profile-input {
  flex: 1;
  max-width: 300px;
}

.lobby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 16px;
  align-items: start;
}

.host-card .input {
  width: 100%;
}

.goal-seg {
  flex-wrap: wrap;
}

.goal-custom {
  margin-top: 12px;
}

.goal-custom input[type='range'] {
  flex: 1;
}

.goal-value {
  min-width: 68px;
  text-align: right;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.host-submit {
  width: 100%;
  margin-top: 18px;
}

.join-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.join-head .btn-secondary {
  flex-shrink: 0;
}

.join-head .is-discovering {
  color: var(--accent-strong);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border-strong));
}

.discover-tip {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 13px;
  color: var(--accent-strong);
  font-size: 12.5px;
  font-weight: 650;
}

.discover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 650;
}

.pulse-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.pulse-dot::after {
  content: '';
  position: absolute;
  inset: -5px;
  border: 2px solid color-mix(in srgb, var(--accent) 46%, transparent);
  border-radius: 50%;
  animation: lobby-pulse 1.6s var(--ease) infinite;
}

@keyframes lobby-pulse {
  0% {
    transform: scale(0.45);
    opacity: 1;
  }
  100% {
    transform: scale(1.45);
    opacity: 0;
  }
}

.found-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  max-height: 264px;
  overflow-y: auto;
  list-style: none;
}

.found-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.found-info {
  flex: 1;
  min-width: 0;
}

.found-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
}

.found-info span {
  display: block;
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 11.5px;
}

.code-join {
  margin-top: 14px;
  border-top: 1px dashed var(--border-subtle);
}

.code-input {
  flex: 1;
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.code-input::placeholder {
  letter-spacing: 0.08em;
  font-weight: 600;
}

@media (max-width: 640px) {
  .profile-card {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-cat {
    align-self: center;
  }

  .profile-input {
    max-width: none;
  }
}
</style>
