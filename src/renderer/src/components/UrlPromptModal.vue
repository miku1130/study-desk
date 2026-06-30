<script setup lang="ts">
import { ref } from 'vue'
import AppModal from './AppModal.vue'

defineProps<{ title: string; placeholder?: string; hint?: string }>()
const emit = defineEmits<{ confirm: [url: string]; close: [] }>()

const url = ref('')
const busy = ref(false)

function ok(): void {
  if (!url.value.trim() || busy.value) return
  busy.value = true
  emit('confirm', url.value.trim())
}
</script>

<template>
  <AppModal :title="title" @close="emit('close')">
    <input
      v-model="url"
      class="input"
      style="width: 100%"
      :placeholder="placeholder || 'https://...'"
      @keyup.enter="ok"
    />
    <p class="s-sub" style="margin-top: 8px">
      {{ hint || '将自动下载到本地后使用，支持任意免费资源的直链。' }}
    </p>
    <template #footer>
      <button class="btn btn-secondary btn-sm" @click="emit('close')">取消</button>
      <button class="btn btn-sm" :disabled="busy" @click="ok">{{ busy ? '下载中…' : '添加' }}</button>
    </template>
  </AppModal>
</template>
