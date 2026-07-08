<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const iconOf: Record<string, string> = {
  success: '✓',
  info: 'ⓘ',
  error: '✕'
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type">
          <span class="toast-icon">{{ iconOf[t.type] }}</span>
          <span class="toast-text">{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>

    <Transition name="confirm">
      <div v-if="ui.confirmState" class="confirm-mask" @click.self="ui.settleConfirm(false)">
        <div class="confirm-card" role="dialog" aria-modal="true">
          <h3>{{ ui.confirmState.title }}</h3>
          <p>{{ ui.confirmState.message }}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary btn-sm" @click="ui.settleConfirm(false)">取消</button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-danger': ui.confirmState.danger }"
              @click="ui.settleConfirm(true)"
            >
              {{ ui.confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 240;
  pointer-events: none;
}
.toast {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: min(520px, calc(100vw - 60px));
  padding: 9px 16px 9px 12px;
  border-radius: 12px;
  background: var(--bg-card-strong);
  border: 1px solid var(--separator);
  box-shadow: var(--shadow-pop);
  font-size: 13px;
  font-weight: 600;
  backdrop-filter: blur(18px);
}
.toast-icon {
  display: inline-flex;
  width: 19px;
  height: 19px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  flex-shrink: 0;
}
.toast.success .toast-icon {
  background: #30d158;
}
.toast.info .toast-icon {
  background: var(--accent);
}
.toast.error .toast-icon {
  background: #ff453a;
}
.toast-text {
  min-width: 0;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s var(--ease), transform 0.22s var(--ease);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

.confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 230;
  background: rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-card {
  width: 340px;
  max-width: calc(100vw - 48px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--separator);
  background: var(--bg-card-strong);
  box-shadow: var(--shadow-pop);
  padding: 20px;
}
.confirm-card h3 {
  font-size: 15px;
  font-weight: 800;
}
.confirm-card p {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.18s var(--ease);
}
.confirm-enter-active .confirm-card,
.confirm-leave-active .confirm-card {
  transition: transform 0.18s var(--ease);
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-from .confirm-card,
.confirm-leave-to .confirm-card {
  transform: translateY(10px) scale(0.97);
}
</style>
