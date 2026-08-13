<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { useTimetableStatus } from '@/composables/useTimetableStatus'

const pomodoro = usePomodoroStore()
const pet = usePetCompanionStore()
const timetable = useTimetableStatus()

const title = computed(() => timetable.current.value?.name || '一起专注')
const timer = computed(() => {
  if (timetable.current.value) return `${timetable.current.value.period.end} 下课`
  return pomodoro.clockText
})

function hide(): void {
  void window.api.petWidget.hide()
}

onMounted(() => document.documentElement.classList.add('pet-widget-window'))
onBeforeUnmount(() => document.documentElement.classList.remove('pet-widget-window'))
</script>

<template>
  <main class="pet-widget-root">
    <button class="widget-close" title="本次先隐藏" aria-label="本次先隐藏" @click="hide">
      <AppIcon name="x" :size="13" />
    </button>
    <div class="widget-bubble">
      <strong>{{ title }}</strong>
      <span>{{ timer }}</span>
    </div>
    <PetSpriteAnimation
      class="widget-cat"
      animation="writing"
      :cat-id="pet.catId"
      :label="`${pet.selectedCat.name}正在陪伴学习`"
    />
    <span class="widget-name">{{ pet.selectedCat.name }}</span>
  </main>
</template>

<style scoped>
:global(html.pet-widget-window),
:global(html.pet-widget-window body),
:global(html.pet-widget-window #app) {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent !important;
}
.pet-widget-root {
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-app-region: drag;
}
.widget-cat {
  position: absolute;
  left: 12px;
  bottom: 0;
  width: 205px;
  height: 205px;
  filter: drop-shadow(0 10px 8px rgba(21, 32, 27, 0.25));
}
.widget-bubble {
  position: absolute;
  z-index: 2;
  top: 2px;
  left: 3px;
  display: flex;
  flex-direction: column;
  min-width: 118px;
  padding: 8px 11px;
  border: 1px solid rgba(57, 92, 76, 0.18);
  border-radius: 8px 8px 8px 2px;
  background: rgba(255, 252, 247, 0.94);
  color: #25332d;
  box-shadow: 0 8px 24px rgba(39, 58, 48, 0.16);
  backdrop-filter: blur(12px);
}
.widget-bubble strong { font-size: 11px; }
.widget-bubble span {
  margin-top: 1px;
  color: #4a7b6a;
  font-size: 14px;
  font-weight: 780;
  font-variant-numeric: tabular-nums;
}
.widget-close {
  position: absolute;
  z-index: 4;
  top: 4px;
  right: 4px;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(57, 92, 76, 0.15);
  border-radius: 50%;
  background: rgba(255, 252, 247, 0.88);
  color: #62736b;
  -webkit-app-region: no-drag;
}
.widget-name {
  position: absolute;
  z-index: 3;
  right: 9px;
  bottom: 8px;
  padding: 4px 7px;
  border-radius: 6px;
  background: rgba(37, 51, 45, 0.72);
  color: white;
  font-size: 10px;
  font-weight: 720;
}
</style>
