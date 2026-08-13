<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useTimetableStatus } from '@/composables/useTimetableStatus'

const router = useRouter()
const pomodoro = usePomodoroStore()
const pet = usePetCompanionStore()
const timetable = useTimetableStatus()

const visible = computed(() => (pomodoro.phase === 'work' && pomodoro.running) || Boolean(timetable.current.value))
const title = computed(() => timetable.current.value?.name || pomodoro.phaseLabel)
const detail = computed(() => {
  if (timetable.current.value) return `${timetable.current.value.period.end} 下课`
  return pomodoro.clockText
})
</script>

<template>
  <Transition name="dock">
    <button v-if="visible" class="pet-dock" aria-label="打开猫咪伴学小屋" @click="router.push('/pomodoro?tab=room')">
      <PetSpriteAnimation class="dock-cat" animation="writing" :cat-id="pet.catId" />
      <span class="dock-copy">
        <strong>{{ pet.selectedCat.name }}陪着你</strong>
        <small>{{ title }} · {{ detail }}</small>
      </span>
      <span class="dock-live" />
    </button>
  </Transition>
</template>

<style scoped>
.pet-dock {
  position: fixed;
  z-index: 30;
  right: 18px;
  bottom: 18px;
  width: 222px;
  height: 70px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 8px;
  align-items: center;
  gap: 9px;
  padding: 6px 10px 6px 5px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  color: var(--text-primary);
  text-align: left;
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(18px);
}
.dock-cat {
  width: 58px;
  height: 58px;
}
.dock-copy {
  min-width: 0;
}
.dock-copy strong,
.dock-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dock-copy strong { font-size: 12.5px; }
.dock-copy small { margin-top: 3px; color: var(--text-tertiary); font-size: 10.5px; }
.dock-live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-success);
  animation: dock-live 1.8s ease-in-out infinite;
}
.dock-enter-active,
.dock-leave-active { transition: opacity 180ms var(--ease), transform 180ms var(--ease); }
.dock-enter-from,
.dock-leave-to { opacity: 0; transform: translateY(12px); }
@keyframes dock-live { 50% { opacity: 0.5; } }
@media (max-width: 760px) {
  .pet-dock { right: 10px; bottom: 10px; width: 190px; }
}
</style>
