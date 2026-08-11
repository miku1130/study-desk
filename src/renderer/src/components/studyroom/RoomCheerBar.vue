<script setup lang="ts">
import { onUnmounted, shallowRef } from 'vue'
import type { StudyRoomCheer } from '@/types'

const props = defineProps<{
  cheers: StudyRoomCheer[]
  targetName: string
  soundEnabled: boolean
  cooldown: boolean
}>()

const emit = defineEmits<{
  send: [cheerId: string]
  'update:soundEnabled': [value: boolean]
}>()

const bouncingId = shallowRef('')
let bounceTimer = 0

function onSend(cheerId: string): void {
  if (props.cooldown) return
  bouncingId.value = ''
  window.clearTimeout(bounceTimer)
  requestAnimationFrame(() => {
    bouncingId.value = cheerId
    bounceTimer = window.setTimeout(() => (bouncingId.value = ''), 380)
  })
  emit('send', cheerId)
}

function onToggleSound(event: Event): void {
  emit('update:soundEnabled', (event.target as HTMLInputElement).checked)
}

onUnmounted(() => window.clearTimeout(bounceTimer))
</script>

<template>
  <div class="cheer-bar" :class="{ 'is-cooldown': cooldown }">
    <p class="cheer-target">
      给 <strong>{{ targetName || '全体' }}</strong> 加油
    </p>

    <div class="cheer-list" role="group" aria-label="预设加油动作">
      <div v-for="item in cheers" :key="item.id" class="cheer-item">
        <button
          type="button"
          class="cheer-btn"
          :class="{ bouncing: bouncingId === item.id }"
          :title="cooldown ? '歇一下，3 秒后可以再加油' : item.label"
          :disabled="cooldown"
          @click="onSend(item.id)"
        >
          {{ item.emoji }}
        </button>
        <span class="cheer-label">{{ item.label }}</span>
      </div>
    </div>

    <div class="cheer-sound">
      <span class="cheer-sound-text">提示音</span>
      <label class="switch">
        <input type="checkbox" :checked="soundEnabled" @change="onToggleSound" />
        <span class="slider" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.cheer-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 9px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  box-shadow: var(--shadow-raised);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  backdrop-filter: blur(14px) saturate(120%);
}

.cheer-target {
  font-size: 12.5px;
  font-weight: 660;
  color: var(--text-secondary);
  white-space: nowrap;
}

.cheer-target strong {
  color: var(--accent-strong);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: bottom;
}

.cheer-list {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cheer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 46px;
}

.cheer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  font-size: 18px;
  line-height: 1;
  transition:
    transform var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease);
}

.cheer-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 38%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 18%, transparent);
}

.cheer-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.94);
}

.cheer-btn.bouncing {
  animation: cheer-bounce 0.38s var(--ease);
}

@keyframes cheer-bounce {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.24);
  }
  65% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}

.cheer-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 680;
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease);
}

.cheer-item:hover .cheer-label,
.cheer-btn:focus-visible + .cheer-label {
  opacity: 1;
}

.is-cooldown .cheer-item {
  opacity: 0.62;
}

.cheer-sound {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cheer-sound-text {
  font-size: 11.5px;
  font-weight: 660;
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .cheer-bar {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .cheer-list {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
