<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <span
    class="app-logo"
    :style="{ width: (size ?? 36) + 'px', height: (size ?? 36) + 'px' }"
    aria-hidden="true"
  >
    <svg viewBox="0 0 40 40" fill="none">
      <path
        class="mark-orbit"
        d="M5.8 22.6C6.7 12.8 14.5 6.4 24.4 7.1c5.1.4 8.8 2.7 10.8 5.7"
      />
      <path
        class="mark-orbit mark-orbit--tail"
        d="M34.4 17.5c.3 1.1.4 2.2.3 3.4-.5 7.9-6.8 13.1-15 12.5"
      />
      <path
        class="mark-page mark-page--left"
        d="M8.4 15.5c4.2-2.2 8.1-2 11.3.3v14.1c-3.2-2.4-7.1-2.5-11.3-.3Z"
      />
      <path
        class="mark-page mark-page--right"
        d="M31.6 15.5c-4.2-2.2-8.1-2-11.3.3v14.1c3.2-2.4 7.1-2.5 11.3-.3Z"
      />
      <path class="mark-fold" d="M20 16v13.7" />
      <path class="mark-line" d="M11.8 19.1c2.1-.7 3.9-.6 5.5.2M11.8 22.5c2.1-.7 3.9-.6 5.5.2" />
      <path class="mark-line" d="M28.2 19.1c-2.1-.7-3.9-.6-5.5.2M28.2 22.5c-2.1-.7-3.9-.6-5.5.2" />
      <circle class="mark-focus" cx="31.8" cy="10.3" r="2.6" />
      <circle class="mark-focus-core" cx="31.8" cy="10.3" r="1" />
    </svg>
  </span>
</template>

<style scoped>
.app-logo {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
  color: var(--accent);
}
.app-logo svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 3px 5px color-mix(in srgb, var(--accent) 16%, transparent));
}
.mark-orbit {
  stroke: var(--brand-highlight);
  stroke-width: 1.35;
  stroke-linecap: round;
  opacity: 0.72;
}
.mark-orbit--tail {
  opacity: 0.42;
}
.mark-page {
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linejoin: round;
}
.mark-page--left {
  fill: color-mix(in srgb, var(--accent) 11%, var(--surface-raised));
}
.mark-page--right {
  fill: color-mix(in srgb, var(--accent) 19%, var(--surface-raised));
}
.mark-fold {
  stroke: currentColor;
  stroke-width: 1.15;
  stroke-linecap: round;
  opacity: 0.72;
}
.mark-line {
  stroke: currentColor;
  stroke-width: 0.9;
  stroke-linecap: round;
  opacity: 0.38;
}
.mark-focus {
  fill: var(--surface-raised);
  stroke: var(--brand-highlight);
  stroke-width: 1.3;
}
.mark-focus-core {
  fill: var(--brand-highlight);
}
</style>
