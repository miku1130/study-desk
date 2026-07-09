<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type Stage = 'available' | 'downloading' | 'downloaded'

interface UpdateStatus {
  state: string
  version?: string
  percent?: number
}

const visible = ref(false)
const stage = ref<Stage>('available')
const version = ref('')
const percent = ref(0)
// 每个阶段被手动关闭后本次会话不再重复弹；进入 downloaded 阶段会作为新提醒再弹一次
const dismissedAvailable = ref(false)
const dismissedDownloaded = ref(false)
let unsub: (() => void) | null = null

onMounted(() => {
  unsub = window.api.update.onStatus((s) => {
    const st = s as UpdateStatus
    if (st.state === 'available') {
      stage.value = 'available'
      version.value = st.version ?? ''
      percent.value = 0
      if (!dismissedAvailable.value) visible.value = true
    } else if (st.state === 'downloading') {
      if (stage.value !== 'downloaded') stage.value = 'downloading'
      percent.value = st.percent ?? 0
    } else if (st.state === 'downloaded') {
      stage.value = 'downloaded'
      version.value = st.version ?? version.value
      percent.value = 100
      if (!dismissedDownloaded.value) visible.value = true
    }
  })
})
onUnmounted(() => unsub?.())

const ready = computed(() => stage.value === 'downloaded')

const title = computed(() => (ready.value ? '新版本已准备就绪' : '发现新版本'))
const body = computed(() =>
  ready.value
    ? `新版本 ${version.value ? 'v' + version.value : ''} 已下载完成，重启应用即可完成安装，数据不会丢失。`
    : `发现新版本 ${version.value ? 'v' + version.value : ''}，正在后台自动下载，完成后会再次提醒你安装。`
)

function dismiss(): void {
  if (ready.value) dismissedDownloaded.value = true
  else dismissedAvailable.value = true
  visible.value = false
}

function install(): void {
  window.api.update.install()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="update">
      <div v-if="visible" class="update-mask" @click.self="dismiss">
        <div class="update-card" role="dialog" aria-modal="true">
          <div class="update-icon" :class="{ ready }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="ready" d="M20 6 9 17l-5-5" />
              <template v-else>
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M4 21h16" />
              </template>
            </svg>
          </div>
          <h3>{{ title }}</h3>
          <p>{{ body }}</p>
          <div v-if="!ready" class="update-bar">
            <div class="update-fill" :style="{ width: percent + '%' }" />
          </div>
          <p v-if="!ready" class="update-pct">{{ percent }}%</p>
          <div class="update-actions">
            <button class="btn btn-secondary btn-sm" @click="dismiss">稍后再说</button>
            <button v-if="ready" class="btn btn-sm" @click="install">立即重启更新</button>
            <button v-else class="btn btn-sm" @click="dismiss">知道了</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-mask {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.update-card {
  width: 350px;
  max-width: calc(100vw - 48px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--separator);
  background: var(--bg-card-strong);
  box-shadow: var(--shadow-pop);
  padding: 26px 24px 20px;
  text-align: center;
}
.update-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
}
.update-icon.ready {
  background: rgba(48, 209, 88, 0.16);
  color: #30d158;
}
.update-icon svg {
  width: 26px;
  height: 26px;
}
.update-card h3 {
  font-size: 16px;
  font-weight: 800;
}
.update-card p {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.update-bar {
  height: 6px;
  margin-top: 14px;
  border-radius: 999px;
  background: var(--active);
  overflow: hidden;
}
.update-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.3s var(--ease);
}
.update-pct {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.update-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}
.update-enter-active,
.update-leave-active {
  transition: opacity 0.2s var(--ease);
}
.update-enter-active .update-card,
.update-leave-active .update-card {
  transition: transform 0.2s var(--ease);
}
.update-enter-from,
.update-leave-to {
  opacity: 0;
}
.update-enter-from .update-card,
.update-leave-to .update-card {
  transform: translateY(12px) scale(0.96);
}
</style>
