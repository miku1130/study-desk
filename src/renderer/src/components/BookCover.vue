<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  path?: string
  /** 紧凑模式：用于列表卡片和继续阅读条 */
  compact?: boolean
}>()

interface CoverTheme {
  paper: string
  paperDeep: string
  ink: string
  accent: string
  label: string
}

const THEMES: Record<string, CoverTheme> = {
  pdf: { paper: '#fff3ef', paperDeep: '#f7ded5', ink: '#4a2d29', accent: '#df7769', label: 'PDF' },
  doc: { paper: '#eff8ff', paperDeep: '#dceeff', ink: '#263a48', accent: '#5b9fce', label: 'DOC' },
  docx: { paper: '#eff8ff', paperDeep: '#dceeff', ink: '#263a48', accent: '#5b9fce', label: 'DOC' },
  ppt: { paper: '#fff8e8', paperDeep: '#f6e7ba', ink: '#473722', accent: '#d59b3e', label: 'PPT' },
  pptx: { paper: '#fff8e8', paperDeep: '#f6e7ba', ink: '#473722', accent: '#d59b3e', label: 'PPT' },
  xls: { paper: '#effaf4', paperDeep: '#d9f0e3', ink: '#263a30', accent: '#55a978', label: 'XLS' },
  xlsx: { paper: '#effaf4', paperDeep: '#d9f0e3', ink: '#263a30', accent: '#55a978', label: 'XLS' },
  epub: { paper: '#f7f1ff', paperDeep: '#e8ddf6', ink: '#352c40', accent: '#8b70b8', label: 'EPUB' },
  mobi: { paper: '#f7f1ff', paperDeep: '#e8ddf6', ink: '#352c40', accent: '#8b70b8', label: 'MOBI' },
  azw3: { paper: '#f7f1ff', paperDeep: '#e8ddf6', ink: '#352c40', accent: '#8b70b8', label: 'AZW3' },
  md: { paper: '#effafa', paperDeep: '#d8eff0', ink: '#273c3d', accent: '#55a7ad', label: 'MD' },
  txt: { paper: '#fff9ed', paperDeep: '#f2e8cf', ink: '#3a3428', accent: '#b49352', label: 'TXT' }
}

const DEFAULT_THEME: CoverTheme = {
  paper: '#f0f1ef',
  paperDeep: '#dfe3df',
  ink: '#2d342f',
  accent: '#68746c',
  label: 'FILE'
}

const ext = computed(() => props.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? '')
const isImage = computed(() => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext.value) && !!props.path)
const imageUrl = computed(() => (isImage.value && props.path ? window.api.media.url(props.path) : ''))
const theme = computed(() => THEMES[ext.value] ?? DEFAULT_THEME)
const cleanName = computed(() => props.name.replace(/\.[^.]+$/, '').trim() || props.name)
const seal = computed(() => {
  const text = cleanName.value
  const han = text.match(/[\u4e00-\u9fff]/g)
  if (han?.length) return han.slice(0, 1).join('')
  const word = text.match(/[A-Za-z0-9]+/)?.[0] ?? text
  return word.slice(0, 1).toUpperCase()
})
</script>

<template>
  <div
    class="bk"
    :class="{ compact }"
    :style="{
      '--paper': theme.paper,
      '--paper-deep': theme.paperDeep,
      '--ink': theme.ink,
      '--cover-accent': theme.accent
    }"
  >
    <template v-if="isImage">
      <img class="bk-image" :src="imageUrl" :alt="cleanName" />
      <span class="bk-image-label">{{ cleanName }}</span>
    </template>
    <template v-else>
      <span class="bk-spine" />
      <span class="bk-texture" />
      <span class="bk-frame" />
      <span class="bk-series">STUDY DESK</span>
      <span class="bk-type">{{ theme.label }}</span>
      <span class="bk-seal">{{ seal }}</span>
      <span class="bk-title">{{ cleanName }}</span>
      <span v-if="!compact" class="bk-rule" />
      <span v-if="!compact" class="bk-footer">PERSONAL LIBRARY</span>
    </template>
  </div>
</template>

<style scoped>
.bk {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  background:
    linear-gradient(114deg, rgba(255, 255, 255, 0.38), transparent 38%),
    linear-gradient(158deg, var(--paper) 0%, var(--paper-deep) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset -1px -2px 5px rgba(30, 36, 32, 0.1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 11% 10% 9% 18%;
  color: var(--ink);
  user-select: none;
}
.bk-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #202522;
}
.bk-image-label {
  position: absolute;
  inset: auto 7px 7px;
  overflow: hidden;
  padding: 4px 6px;
  border-radius: 5px;
  background: rgba(12, 16, 14, 0.68);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bk-spine {
  position: absolute;
  inset: 0 auto 0 0;
  width: 10%;
  background: var(--cover-accent);
  box-shadow: inset -1px 0 rgba(0, 0, 0, 0.12);
}
.bk-spine::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 40%;
  width: 1px;
  background: rgba(255, 255, 255, 0.2);
}
.bk-texture {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, rgba(28, 36, 31, 0.025) 0 1px, transparent 1px 6px),
    radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--cover-accent) 9%, transparent), transparent 28%);
  pointer-events: none;
}
.bk-frame {
  position: absolute;
  inset: 7% 6% 7% 14%;
  border: 1px solid color-mix(in srgb, var(--cover-accent) 28%, transparent);
  pointer-events: none;
}
.bk-frame::before,
.bk-frame::after {
  content: '';
  position: absolute;
  width: 18%;
  height: 1px;
  background: var(--cover-accent);
  opacity: 0.7;
}
.bk-frame::before {
  inset: 10% auto auto 8%;
}
.bk-frame::after {
  inset: auto 8% 10% auto;
}
.bk-series {
  position: relative;
  z-index: 1;
  font-size: clamp(4px, 0.34em, 7px);
  font-weight: 750;
  letter-spacing: 0.09em;
  color: color-mix(in srgb, var(--ink) 62%, transparent);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bk-type {
  position: absolute;
  top: 10%;
  right: 9%;
  font-size: clamp(6px, 0.46em, 9px);
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--cover-accent);
}
.bk-seal {
  position: relative;
  z-index: 1;
  width: 1.55em;
  height: 1.55em;
  margin-top: 15%;
  border: 1px solid var(--cover-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cover-accent);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 0.72em;
  font-weight: 700;
}
.bk-title {
  position: relative;
  z-index: 1;
  max-width: 94%;
  margin-top: 8%;
  font-family: "Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif;
  font-size: 0.94em;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.bk-rule {
  width: 26%;
  height: 1px;
  margin-top: auto;
  background: var(--cover-accent);
  opacity: 0.62;
}
.bk-footer {
  position: relative;
  z-index: 1;
  margin-top: 5%;
  font-size: clamp(4px, 0.3em, 6.5px);
  font-weight: 700;
  letter-spacing: 0.07em;
  color: color-mix(in srgb, var(--ink) 52%, transparent);
  max-width: 92%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bk.compact {
  padding: 10% 8% 8% 17%;
}
.bk.compact .bk-seal {
  margin-top: 13%;
}
.bk.compact .bk-title {
  margin-top: 8%;
  font-size: 0.82em;
  -webkit-line-clamp: 2;
}
</style>
