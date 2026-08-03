<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import PetRoom from '@/components/pet/PetRoom.vue'
import PetWardrobe from '@/components/pet/PetWardrobe.vue'
import PetCollection from '@/components/pet/PetCollection.vue'
import { usePetCompanionStore, PET_GIFTS, PET_TRASH } from '@/stores/petCompanion'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useUiStore } from '@/stores/ui'
import { useTimetableStatus } from '@/composables/useTimetableStatus'
import type { PetVisualState } from '@/lib/petAssets'

const pet = usePetCompanionStore()
const pomodoro = usePomodoroStore()
const ui = useUiStore()
const timetable = useTimetableStatus()
const router = useRouter()
const revealGift = shallowRef(false)
let revealTimer = 0

const visualState = computed<PetVisualState>(() => {
  if (revealGift.value) return 'gift'
  if ((pomodoro.phase === 'work' && pomodoro.running) || timetable.current.value) return 'focus'
  if (pomodoro.phase === 'work') return 'paused'
  if (pomodoro.phase === 'short' || pomodoro.phase === 'long') return 'break'
  return 'idle'
})

const status = computed(() => {
  if (timetable.current.value) return `正在陪你上「${timetable.current.value.name}」`
  if (pomodoro.phase === 'work' && pomodoro.running) {
    const mm = String(pomodoro.minutes).padStart(2, '0')
    const ss = String(pomodoro.seconds).padStart(2, '0')
    return `一起写完这一页 · ${mm}:${ss}`
  }
  if (pomodoro.phase === 'work') return '计时暂停，猫还在原地等你'
  if (pomodoro.phase === 'short' || pomodoro.phase === 'long') return '休息一下，猫也趴下了'
  return '还没开始专注，猫把纸笔摆好了'
})

const lastItemName = computed(() => {
  const item = pet.lastKeepsake
  if (!item) return ''
  const catalog = item.kind === 'gift' ? PET_GIFTS : PET_TRASH
  return catalog.find((entry) => entry.id === item.itemId)?.name ?? ''
})

watch(
  () => pet.lastKeepsake?.id,
  (id) => {
    if (!id) return
    revealGift.value = true
    window.clearTimeout(revealTimer)
    revealTimer = window.setTimeout(() => (revealGift.value = false), 4200)
  }
)

function choose(kind: 'cat' | 'room' | 'furniture', id: string): void {
  if (pet.buyAndUse(kind, id)) return
  ui.info('伴学金币还差一点，再完成几次专注就够了')
}

function startFocus(): void {
  if (pomodoro.running) router.push('/pomodoro')
  else void pomodoro.start()
}

onBeforeUnmount(() => window.clearTimeout(revealTimer))
</script>

<template>
  <div class="page pet-page">
    <header class="pet-summary">
      <div>
        <p class="summary-eyebrow">{{ pet.completedSessions }} 次并肩完成 · {{ pet.abandonedSessions }} 次重新起笔</p>
        <h2>{{ status }}</h2>
      </div>
      <button class="btn focus-command" @click="startFocus">
        <AppIcon :name="pomodoro.running ? 'timer' : 'play'" :size="15" />
        {{ pomodoro.running ? '查看番茄钟' : '开始专注' }}
      </button>
    </header>

    <PetRoom
      :state="visualState"
      :cat-id="pet.catId"
      :room-id="pet.roomId"
      :furniture-id="pet.furnitureId"
      :cat-name="pet.selectedCat.name"
      :status="status"
      :keepsake="pet.lastKeepsake"
    />

    <Transition name="reward-note">
      <div v-if="revealGift && lastItemName" class="reward-note">
        <AppIcon :name="pet.lastKeepsake?.kind === 'gift' ? 'sparkle' : 'note'" :size="17" />
        <span>{{ pet.selectedCat.name }}刚刚留下了<strong>{{ lastItemName }}</strong></span>
      </div>
    </Transition>

    <div class="pet-workbench">
      <PetWardrobe
        :coins="pet.coins"
        :cat-id="pet.catId"
        :room-id="pet.roomId"
        :furniture-id="pet.furnitureId"
        :unlocked-cats="pet.unlockedCats"
        :unlocked-rooms="pet.unlockedRooms"
        :unlocked-furniture="pet.unlockedFurniture"
        @choose="choose"
      />
      <PetCollection :keepsakes="pet.keepsakes" />
    </div>
  </div>
</template>

<style scoped>
.pet-page {
  max-width: 1180px;
  padding-bottom: 28px;
}
.pet-summary {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 13px;
}
.pet-summary h2 {
  margin: 2px 0 0;
  font-size: 20px;
  line-height: 1.3;
}
.summary-eyebrow {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 680;
}
.focus-command {
  flex-shrink: 0;
}
.reward-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: fit-content;
  max-width: calc(100% - 24px);
  min-height: 38px;
  margin: -20px auto 0;
  padding: 0 14px;
  position: relative;
  z-index: 5;
  border: 1px solid rgba(168, 117, 31, 0.23);
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.95);
  color: #6d562c;
  box-shadow: var(--shadow-raised);
  font-size: 12px;
}
.reward-note strong { margin-left: 4px; }
.reward-note-enter-active,
.reward-note-leave-active { transition: opacity 180ms var(--ease), transform 180ms var(--ease); }
.reward-note-enter-from,
.reward-note-leave-to { opacity: 0; transform: translateY(-7px); }
.pet-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(360px, 0.84fr);
  gap: 28px;
  margin-top: 28px;
  align-items: start;
}
@media (max-width: 980px) {
  .pet-workbench { grid-template-columns: 1fr; }
}
@media (max-width: 650px) {
  .pet-summary { align-items: stretch; flex-direction: column; }
  .focus-command { width: 100%; }
}
</style>
