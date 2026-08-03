<script setup lang="ts">
import { computed } from 'vue'
import type { DesktopWidgetConfig, DesktopWidgetFont, DesktopWidgetSize, TodoItem } from '@/types'

const props = defineProps<{ modelValue: DesktopWidgetConfig; memos?: TodoItem[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: DesktopWidgetConfig] }>()

const sizes: Array<{ value: DesktopWidgetSize; label: string }> = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' }
]
const fonts: Array<{ value: DesktopWidgetFont; label: string }> = [
  { value: 'system', label: '系统黑体' },
  { value: 'serif', label: '书卷宋体' },
  { value: 'rounded', label: '柔和圆体' },
  { value: 'mono', label: '等宽数字' },
  { value: 'handwriting', label: '马善政手写体' },
  { value: 'literary', label: '站酷小薇体' },
  { value: 'display', label: '站酷庆科黄油体' }
]

const memoImages = computed(() =>
  (props.memos ?? []).flatMap((memo) =>
    memo.attachments
      .filter((attachment) => attachment.kind === 'image')
      .map((attachment) => ({ ...attachment, memoText: memo.text }))
  )
)

function patch(value: Partial<DesktopWidgetConfig>): void {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

function imageUrl(path: string): string {
  return window.api.media.url(path)
}

async function pickBackground(): Promise<void> {
  const path = await window.api.dialog.openFile([
    { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
  ])
  if (path) patch({ background: path })
}

function useImageMode(): void {
  const selected = memoImages.value.find(
    (image) => image.id === props.modelValue.memoImageAttachmentId
  )
  patch({
    memoDisplayMode: 'image',
    memoImageAttachmentId: selected?.id ?? memoImages.value[0]?.id ?? ''
  })
}
</script>

<template>
  <div class="appearance-editor">
    <label class="field">
      <span>摆件标题</span>
      <input class="input" :value="modelValue.title" placeholder="可留空使用默认标题" @input="patch({ title: ($event.target as HTMLInputElement).value })" />
    </label>

    <div class="field">
      <span>尺寸</span>
      <div class="segmented">
        <button v-for="item in sizes" :key="item.value" :class="{ active: modelValue.size === item.value }" @click="patch({ size: item.value, width: undefined, height: undefined })">
          {{ item.label }}
        </button>
      </div>
    </div>

    <div v-if="modelValue.kind === 'memo'" class="field">
      <span>显示模式</span>
      <div class="segmented memo-mode-segmented">
        <button :class="{ active: modelValue.memoDisplayMode === 'list' }" @click="patch({ memoDisplayMode: 'list' })">
          内容卡片
        </button>
        <button :class="{ active: modelValue.memoDisplayMode === 'image' }" :disabled="!memoImages.length" @click="useImageMode">
          纯图片
        </button>
      </div>
    </div>

    <div v-if="modelValue.kind === 'memo' && modelValue.memoDisplayMode === 'image' && memoImages.length" class="field">
      <span>桌面图片</span>
      <div class="memo-image-picker">
        <button
          v-for="image in memoImages"
          :key="image.id"
          :class="{ active: modelValue.memoImageAttachmentId === image.id }"
          :title="`${image.memoText} - ${image.name}`"
          @click="patch({ memoImageAttachmentId: image.id })"
        >
          <img :src="imageUrl(image.path)" :alt="image.name" />
          <span>{{ image.name }}</span>
        </button>
      </div>
    </div>

    <label class="field">
      <span>字体</span>
      <select class="input select" :value="modelValue.font" @change="patch({ font: ($event.target as HTMLSelectElement).value as DesktopWidgetFont })">
        <option v-for="item in fonts" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    </label>

    <div class="color-grid">
      <label class="field"><span>底色</span><input type="color" :value="modelValue.backgroundColor" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value })" /></label>
      <label class="field"><span>文字</span><input type="color" :value="modelValue.fontColor" @input="patch({ fontColor: ($event.target as HTMLInputElement).value })" /></label>
      <label class="field"><span>强调色</span><input type="color" :value="modelValue.accentColor" @input="patch({ accentColor: ($event.target as HTMLInputElement).value })" /></label>
    </div>

    <div class="field">
      <span>背景图片{{ modelValue.background ? ' · 已选择' : '' }}</span>
      <div class="row">
        <button class="btn btn-secondary btn-sm" @click="pickBackground">选择图片</button>
        <button class="btn btn-secondary btn-sm" :disabled="!modelValue.background" @click="patch({ background: '' })">清除</button>
      </div>
    </div>

    <label class="field range-field">
      <span>卡片不透明度 <strong>{{ Math.round(modelValue.surfaceOpacity * 100) }}%</strong></span>
      <input type="range" min="0.1" max="1" step="0.01" :value="modelValue.surfaceOpacity" @input="patch({ surfaceOpacity: Number(($event.target as HTMLInputElement).value) })" />
    </label>
    <label v-if="modelValue.background" class="field range-field">
      <span>图片遮罩 <strong>{{ Math.round(modelValue.overlayOpacity * 100) }}%</strong></span>
      <input type="range" min="0" max="0.85" step="0.01" :value="modelValue.overlayOpacity" @input="patch({ overlayOpacity: Number(($event.target as HTMLInputElement).value) })" />
    </label>

    <div class="toggle-grid">
      <label><input type="checkbox" :checked="modelValue.enabled" @change="patch({ enabled: ($event.target as HTMLInputElement).checked })" /><span>固定显示</span></label>
      <label><input type="checkbox" :checked="modelValue.locked" @change="patch({ locked: ($event.target as HTMLInputElement).checked })" /><span>锁定位置和大小</span></label>
      <label><input type="checkbox" :checked="modelValue.launchOnStartup" @change="patch({ launchOnStartup: ($event.target as HTMLInputElement).checked })" /><span>开机自动启动</span></label>
    </div>
  </div>
</template>

<style scoped>
.appearance-editor { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 7px; }
.field > span { color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.field strong { color: var(--text-primary); }
.segmented { display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border-radius: 7px; background: var(--surface-muted); }
.segmented button { min-height: 32px; border: 0; border-radius: 5px; background: transparent; color: var(--text-secondary); }
.segmented button.active { background: var(--surface-raised); color: var(--accent-strong); box-shadow: 0 1px 5px rgba(20, 28, 24, 0.1); }
.segmented button:disabled { opacity: 0.42; cursor: not-allowed; }
.memo-mode-segmented { grid-template-columns: repeat(2, 1fr); }
.memo-image-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.memo-image-picker button { min-width: 0; overflow: hidden; padding: 4px; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--surface-muted); color: var(--text-secondary); text-align: left; }
.memo-image-picker button.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.memo-image-picker img { width: 100%; aspect-ratio: 1; display: block; border-radius: 4px; object-fit: cover; }
.memo-image-picker span { display: block; overflow: hidden; margin-top: 4px; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.color-grid input { width: 100%; height: 34px; padding: 3px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-muted); }
.row { display: flex; gap: 8px; }
.range-field input { width: 100%; }
.toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.toggle-grid label { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 7px; color: var(--text-secondary); font-size: 12px; }
@media (max-width: 620px) { .toggle-grid { grid-template-columns: 1fr; } }
</style>
