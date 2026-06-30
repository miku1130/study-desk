<script setup lang="ts">
function onMin(): void {
  window.api.window.minimize()
}
function onMax(): void {
  window.api.window.maximize()
}
function onClose(): void {
  window.api.window.close()
}
</script>

<template>
  <div class="win-controls">
    <button class="wc" aria-label="最小化" @click="onMin">
      <svg viewBox="0 0 12 12"><rect x="2" y="5.4" width="8" height="1.1" fill="currentColor" /></svg>
    </button>
    <button class="wc" aria-label="最大化" @click="onMax">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1">
        <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
      </svg>
    </button>
    <button class="wc close" aria-label="关闭" @click="onClose">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.win-controls {
  display: flex;
  -webkit-app-region: no-drag;
}
.wc {
  width: 44px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition: background 0.12s var(--ease), color 0.12s var(--ease);
}
.wc svg {
  width: 12px;
  height: 12px;
}
.wc:hover {
  background: var(--hover);
  color: var(--text-primary);
}
.wc.close:hover {
  background: #ff453a;
  color: #fff;
}
</style>
