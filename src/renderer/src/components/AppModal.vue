<script setup lang="ts">
defineProps<{ title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div class="modal-mask" @click.self="emit('close')">
        <div class="modal-card">
          <div class="modal-head">
            <h3>{{ title }}</h3>
            <button class="modal-x" aria-label="关闭" @click="emit('close')">✕</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div class="modal-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-card {
  width: 460px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 80px);
  overflow: auto;
  background: var(--bg-card-strong);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--separator);
}
.modal-head h3 {
  font-size: 15px;
  font-weight: 700;
}
.modal-x {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  width: 26px;
  height: 26px;
  border-radius: 7px;
}
.modal-x:hover {
  background: var(--hover);
}
.modal-body {
  padding: 20px;
}
.modal-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--separator);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-foot:empty {
  display: none;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s var(--ease);
}
.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.2s var(--ease);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: translateY(12px) scale(0.97);
}
</style>
