<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS } from '@/lib/icons'

const props = defineProps<{ name: string; size?: number; strokeWidth?: number }>()

const inner = computed(() => ICON_PATHS[props.name] ?? '')
</script>

<template>
  <svg
    class="app-icon"
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth ?? 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="inner"
  />
</template>

<style scoped>
.app-icon {
  flex-shrink: 0;
  vertical-align: -0.14em;
}
</style>
