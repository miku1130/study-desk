<script setup lang="ts">
import type { DesktopWidgetConfig, DesktopWidgetFont, DesktopWidgetSize } from '@/types'

const props = defineProps<{ modelValue: DesktopWidgetConfig }>()
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

function patch(value: Partial<DesktopWidgetConfig>): void {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

async function pickBackground(): Promise<void> {
  const path = await window.api.dialog.openFile([
    { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
  ])
  if (path) patch({ background: path })
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
.color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.color-grid input { width: 100%; height: 34px; padding: 3px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-muted); }
.row { display: flex; gap: 8px; }
.range-field input { width: 100%; }
.toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.toggle-grid label { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 7px; color: var(--text-secondary); font-size: 12px; }
@media (max-width: 620px) { .toggle-grid { grid-template-columns: 1fr; } }
</style>
