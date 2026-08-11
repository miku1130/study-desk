<script setup lang="ts">
import { computed } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import { formatFocusDuration, useStudyRoomStore } from '@/stores/studyRoom'
import type { StudyRoomCheerEvent, StudyRoomMember } from '@/types'

const props = defineProps<{
  member: StudyRoomMember
  rank: number
  isSelf: boolean
  cheer?: StudyRoomCheerEvent | null
}>()

const emit = defineEmits<{ cheer: [memberId: string] }>()

const store = useStudyRoomStore()

const catAnimation = computed<'idle' | 'writing'>(() =>
  props.member.running && props.member.phase === 'work' ? 'writing' : 'idle'
)

const rankTone = computed(() =>
  props.rank === 1 ? 'gold' : props.rank === 2 ? 'silver' : props.rank === 3 ? 'bronze' : ''
)

const seatState = computed(() => {
  if (!props.member.online) return { kind: 'offline', text: '离线' }
  if (props.member.running && props.member.phase === 'work') {
    return { kind: 'focus', text: `专注中 ${formatClock(props.member.remaining)}` }
  }
  if (props.member.phase === 'short' || props.member.phase === 'long') {
    return { kind: 'break', text: '休息中' }
  }
  return { kind: 'idle', text: '空闲' }
})

const cheerEmoji = computed(() =>
  props.cheer ? (store.cheerSpec(props.cheer.cheerId)?.emoji ?? '👏') : ''
)
const cheerFrom = computed(() => props.cheer?.fromNickname ?? '')

const todayRoomText = computed(() => formatFocusDuration(props.member.todayRoomFocusSeconds))
const todayTotalText = computed(() => formatFocusDuration(props.member.todayFocusMinutes * 60))
const durationTitle = computed(() =>
  [
    `今天在自习室：${todayRoomText.value}（跨房间累计）`,
    `今日总专注：${todayTotalText.value}（含自习室外的番茄钟）`,
    `本次在这间房：${formatFocusDuration(props.member.roomFocusSeconds)}`
  ].join('\n')
)

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
</script>

<template>
  <article class="seat-card" :class="{ 'is-offline': !member.online, 'is-self': isSelf }">
    <header class="seat-head">
      <span class="seat-rank" :class="rankTone">{{ rank }}</span>
      <span v-if="isSelf" class="seat-tag seat-tag-self">我</span>
      <span v-if="member.host" class="seat-tag seat-tag-host">房主</span>
      <button
        v-if="!isSelf && member.online"
        type="button"
        class="seat-cheer"
        :title="`给 ${member.nickname} 加油`"
        @click="emit('cheer', member.id)"
      >
        加油
      </button>
    </header>

    <div class="seat-stage">
      <span v-if="cheer" :key="cheer.id" class="seat-bubble">
        <span class="seat-bubble-emoji">{{ cheerEmoji }}</span>
        <span v-if="cheerFrom" class="seat-bubble-from">{{ cheerFrom }}</span>
      </span>
      <PetSpriteAnimation
        class="seat-cat"
        :animation="catAnimation"
        :cat-id="member.catId"
        :label="`${member.nickname} 的猫`"
        lite
      />
    </div>

    <p class="seat-name" :title="member.nickname">{{ member.nickname }}</p>
    <p class="seat-status" :class="`status-${seatState.kind}`">
      <span class="seat-dot" />{{ seatState.text }}
    </p>

    <footer class="seat-stats" :title="durationTitle">
      <div class="seat-duration seat-duration-primary">
        <span class="seat-duration-label">今日自习室</span>
        <span class="seat-duration-value">{{ todayRoomText }}</span>
      </div>
      <div class="seat-duration">
        <span class="seat-duration-label">今日总专注</span>
        <span class="seat-duration-value">{{ todayTotalText }}</span>
      </div>
      <div class="seat-extras">
        <span class="stat" title="今日番茄">🍅 {{ member.todayPomodoros }}</span>
        <span class="stat" title="收到的加油">👏 {{ member.cheers }}</span>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.seat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 12px 11px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  transition:
    transform var(--duration-base) var(--ease),
    box-shadow var(--duration-base) var(--ease),
    border-color var(--duration-base) var(--ease),
    opacity var(--duration-base) var(--ease);
}

.seat-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
}

.seat-card.is-self {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-subtle));
  box-shadow:
    0 0 0 2px var(--accent-soft),
    var(--shadow-card);
}

.seat-card.is-offline {
  opacity: 0.55;
}

.seat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
}

.seat-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.seat-rank.gold {
  background: rgba(226, 181, 79, 0.2);
  border-color: rgba(226, 181, 79, 0.45);
  color: #a8802a;
}

.seat-rank.silver {
  background: rgba(151, 163, 174, 0.2);
  border-color: rgba(151, 163, 174, 0.5);
  color: #6d7b86;
}

.seat-rank.bronze {
  background: rgba(196, 141, 94, 0.2);
  border-color: rgba(196, 141, 94, 0.48);
  color: #9c6b42;
}

.seat-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 750;
  white-space: nowrap;
}

.seat-tag-self {
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
}

.seat-tag-host {
  background: color-mix(in srgb, var(--brand-sun) 22%, transparent);
  color: var(--status-warning);
  border: 1px solid color-mix(in srgb, var(--brand-sun) 40%, transparent);
}

.seat-cheer {
  margin-left: auto;
  padding: 3px 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 36%, transparent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity var(--duration-fast) var(--ease),
    transform var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}

.seat-card:hover .seat-cheer,
.seat-cheer:focus-visible {
  opacity: 1;
  transform: none;
}

.seat-cheer:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.seat-stage {
  position: relative;
  height: 110px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  padding: 6px;
}

.seat-cat {
  width: 100%;
  height: 100%;
}

.seat-bubble {
  position: absolute;
  top: -8px;
  left: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: calc(100% - 8px);
  padding: 4px 10px;
  border-radius: 999px 999px 999px 4px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
  white-space: nowrap;
  pointer-events: none;
  animation: seat-bubble-float 3.4s var(--ease) forwards;
}

.seat-bubble-emoji {
  font-size: 15px;
  line-height: 1;
}

.seat-bubble-from {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10.5px;
  font-weight: 680;
  color: var(--text-secondary);
}

@keyframes seat-bubble-float {
  0% {
    opacity: 0;
    transform: translate(-50%, 12px) scale(0.72);
  }
  9% {
    opacity: 1;
    transform: translate(-50%, -2px) scale(1.06);
  }
  14% {
    transform: translate(-50%, -4px) scale(1);
  }
  80% {
    opacity: 1;
    transform: translate(-50%, -9px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -17px) scale(0.98);
  }
}

.seat-name {
  font-size: 13.5px;
  font-weight: 720;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seat-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.seat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}

.seat-status.status-focus {
  background: color-mix(in srgb, var(--status-success) 12%, transparent);
  border-color: color-mix(in srgb, var(--status-success) 28%, transparent);
  color: var(--status-success);
}

.seat-status.status-focus .seat-dot {
  background: var(--status-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-success) 16%, transparent);
  animation: seat-dot-pulse 1.8s ease-in-out infinite;
}

.seat-status.status-break {
  background: color-mix(in srgb, var(--status-warning) 10%, transparent);
  border-color: color-mix(in srgb, var(--status-warning) 26%, transparent);
  color: var(--status-warning);
}

.seat-status.status-break .seat-dot {
  background: var(--status-warning);
}

@keyframes seat-dot-pulse {
  50% {
    opacity: 0.5;
  }
}

.seat-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.seat-duration {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.seat-duration-label {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 10.5px;
  font-weight: 650;
  white-space: nowrap;
}

.seat-duration-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.seat-duration-primary .seat-duration-label {
  color: var(--text-secondary);
  font-weight: 700;
}

.seat-duration-primary .seat-duration-value {
  color: var(--accent-strong);
  font-size: 13.5px;
  font-weight: 780;
}

.seat-extras {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
</style>
