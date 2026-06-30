<script setup lang="ts">
function onClose(): void {
  window.api.window.close()
}
function onMinimize(): void {
  window.api.window.minimize()
}
function onToggleMaximize(): void {
  window.api.window.maximize()
}
</script>

<template>
  <div class="traffic-lights">
    <button class="tl tl-close" aria-label="关闭" @click="onClose">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M3.4 3.4l5.2 5.2M8.6 3.4l-5.2 5.2" />
      </svg>
    </button>
    <button class="tl tl-min" aria-label="最小化" @click="onMinimize">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M3 6h6" />
      </svg>
    </button>
    <button class="tl tl-max" aria-label="最大化" @click="onToggleMaximize">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M6 3v6M3 6h6" />
      </svg>
    </button>
  </div>
</template>
