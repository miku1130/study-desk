<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { TodoAttachment } from '@/types'

const props = withDefaults(
  defineProps<{
    attachments: TodoAttachment[]
    editable?: boolean
    mode?: 'list' | 'editor' | 'widget'
  }>(),
  { editable: false, mode: 'list' }
)

const emit = defineEmits<{
  remove: [id: string]
  'open-error': [attachment: TodoAttachment]
}>()

const images = computed(() => props.attachments.filter((item) => item.kind === 'image'))
const files = computed(() => props.attachments.filter((item) => item.kind === 'file'))

function imageUrl(path: string): string {
  return window.api.media.url(path)
}

async function openAttachment(attachment: TodoAttachment): Promise<void> {
  const error = await window.api.shell.openPath(attachment.path)
  if (error) emit('open-error', attachment)
}
</script>

<template>
  <div class="todo-attachments" :class="`mode-${mode}`" @click.stop>
    <div v-if="images.length" class="attachment-images">
      <div v-for="attachment in images" :key="attachment.id" class="attachment-image">
        <button
          type="button"
          class="todo-attachment-open image-open"
          :title="`打开 ${attachment.name}`"
          @click="openAttachment(attachment)"
        >
          <img :src="imageUrl(attachment.path)" :alt="attachment.name" />
        </button>
        <button
          v-if="editable"
          type="button"
          class="attachment-remove"
          :title="`移除 ${attachment.name}`"
          @click="emit('remove', attachment.id)"
        >
          <AppIcon name="x" :size="12" />
        </button>
      </div>
    </div>
    <div v-if="files.length" class="attachment-files">
      <div v-for="attachment in files" :key="attachment.id" class="attachment-file">
        <button
          type="button"
          class="todo-attachment-open file-open"
          :title="`用系统应用打开 ${attachment.name}`"
          @click="openAttachment(attachment)"
        >
          <AppIcon name="file" :size="14" />
          <span>{{ attachment.name }}</span>
        </button>
        <button
          v-if="editable"
          type="button"
          class="attachment-remove file-remove"
          :title="`移除 ${attachment.name}`"
          @click="emit('remove', attachment.id)"
        >
          <AppIcon name="x" :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-attachments {
  min-width: 0;
}
.attachment-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 7px;
}
.attachment-image {
  position: relative;
  min-width: 0;
}
.image-open {
  width: 100%;
  height: 92px;
  display: block;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--separator);
  border-radius: 6px;
  background: var(--bg-input);
}
.image-open img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.attachment-remove {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  background: rgba(30, 36, 33, 0.75);
  color: #fff;
}
.attachment-files {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 7px;
}
.attachment-file {
  position: relative;
  min-width: 0;
}
.file-open {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 6px 34px 6px 9px;
  border: 1px solid var(--separator);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-secondary);
  text-align: left;
}
.file-open span {
  min-width: 0;
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-remove {
  top: 5px;
  right: 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-tertiary);
}
.mode-list .attachment-images {
  grid-template-columns: repeat(3, 82px);
}
.mode-list .image-open {
  height: 58px;
}
.mode-list .attachment-files {
  max-width: 420px;
}
.mode-widget .attachment-images {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.mode-widget .image-open {
  height: 46px;
  border-color: color-mix(in srgb, var(--widget-color) 18%, transparent);
  background: rgba(255, 255, 255, 0.08);
}
.mode-widget .attachment-files {
  gap: 4px;
  margin-top: 5px;
}
.mode-widget .file-open {
  min-height: 27px;
  padding: 4px 7px;
  border-color: color-mix(in srgb, var(--widget-color) 18%, transparent);
  background: rgba(255, 255, 255, 0.08);
  color: color-mix(in srgb, var(--widget-color) 76%, transparent);
}
.mode-widget .file-open span {
  font-size: 9.5px;
}
.mode-widget:has(.attachment-files) {
  display: grid;
  grid-template-columns: minmax(0, 96px) minmax(0, 1fr);
  align-items: start;
  gap: 5px;
}
.mode-widget:has(.attachment-files) .attachment-images {
  grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
}
.mode-widget:has(.attachment-files) .attachment-files {
  margin-top: 0;
}
</style>
