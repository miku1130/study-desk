<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { StartupAnnouncement } from '@/types'

const announcement = ref<StartupAnnouncement | null>(null)
const visible = ref(false)

onMounted(async () => {
  try {
    const value = (await window.api.announcement.get()) as StartupAnnouncement | null
    if (value?.enabled && value.title && value.content) {
      announcement.value = value
      visible.value = true
    }
  } catch {
    // 公告属于增强能力，网络不可用时不影响主界面启动。
  }
})

function openAction(): void {
  const url = announcement.value?.actionUrl
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="announcement">
      <div v-if="visible && announcement" class="announcement-mask" @click.self="visible = false">
        <section class="announcement-card" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
          <div class="announcement-kicker">学习桌面公告</div>
          <h2 id="announcement-title">{{ announcement.title }}</h2>
          <time v-if="announcement.publishedAt">{{ announcement.publishedAt }}</time>
          <p class="announcement-content">{{ announcement.content }}</p>
          <div class="announcement-actions">
            <button class="btn btn-secondary btn-sm" @click="visible = false">知道了</button>
            <button v-if="announcement.actionUrl" class="btn btn-sm" @click="openAction">
              {{ announcement.actionText || '查看详情' }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.announcement-mask { position:fixed; inset:0; z-index:230; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(16,24,20,.38); backdrop-filter:blur(7px); }
.announcement-card { width:min(520px,100%); max-height:min(620px,calc(100vh - 48px)); overflow:auto; padding:28px 30px 22px; border:1px solid var(--separator); border-radius:10px; background:var(--bg-card-strong); box-shadow:var(--shadow-pop); }
.announcement-kicker { color:var(--accent-strong); font-size:11px; font-weight:800; letter-spacing:.08em; }.announcement-card h2 { margin-top:9px; font-size:23px; line-height:1.3; }.announcement-card time { display:block; margin-top:7px; color:var(--text-tertiary); font-size:11px; }.announcement-content { margin-top:18px; color:var(--text-secondary); font-size:13px; line-height:1.8; white-space:pre-wrap; }.announcement-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:22px; }.announcement-enter-active,.announcement-leave-active { transition:opacity .2s var(--ease); }.announcement-enter-from,.announcement-leave-to { opacity:0; }
</style>
