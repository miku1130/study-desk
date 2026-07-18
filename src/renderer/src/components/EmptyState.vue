<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

defineProps<{
  icon: string
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="es-badge">
      <AppIcon :name="icon" :size="30" :stroke-width="1.5" />
    </div>
    <h2>{{ title }}</h2>
    <p v-if="desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<style scoped>
.es-badge {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
</style>
