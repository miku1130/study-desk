<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import PetSpriteAnimation from '@/components/pet/PetSpriteAnimation.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'
import { usePetCompanionStore } from '@/stores/petCompanion'
import { PET_ROOM_IMAGES } from '@/lib/petAssets'

const pomodoro = usePomodoroStore()
const settings = useSettingsStore()
const pet = usePetCompanionStore()

const mmss = computed(
  () => `${String(pomodoro.minutes).padStart(2, '0')}:${String(pomodoro.seconds).padStart(2, '0')}`
)
const digits = computed(() => {
  const m = String(pomodoro.minutes).padStart(2, '0')
  const s = String(pomodoro.seconds).padStart(2, '0')
  return [m[0], m[1], s[0], s[1]]
})
const style = computed(() => settings.s.pomodoro.lockStyle || 'minimal')

const bgStyle = computed(() => {
  const wp = settings.s.pomodoro.wallpaper
  const background = wp
    ? window.api.media.url(wp)
    : PET_ROOM_IMAGES[pet.roomId] ?? PET_ROOM_IMAGES.sunroom
  return { backgroundImage: `url("${background}")` }
})

// 暂停 / 结束都会让计时停止，主进程随即关闭锁屏窗口（不再被每秒重新弹出）
function pause(): void {
  window.api.pomodoro.pause()
}
function end(): void {
  window.api.pomodoro.reset()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') pause()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void Promise.all([pomodoro.init(), pet.load()])
})

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="lock" :class="{ wp: !!settings.s.pomodoro.wallpaper }" :style="bgStyle">
    <div class="lock-layout">
      <section class="lock-companion">
        <p class="companion-bubble">{{ pet.selectedCat.name }}在旁边陪你写</p>
        <PetSpriteAnimation
          class="lock-cat"
          animation="writing"
          :cat-id="pet.catId"
          :label="`${pet.selectedCat.name}正在伴学`"
        />
      </section>
      <section class="lock-inner">
        <p class="lock-phase">{{ pomodoro.phaseLabel }}</p>

        <p v-if="style === 'minimal'" class="lock-time minimal">{{ mmss }}</p>

        <div v-else-if="style === 'flip'" class="flip">
          <span class="flip-card">{{ digits[0] }}</span>
          <span class="flip-card">{{ digits[1] }}</span>
          <span class="flip-colon">:</span>
          <span class="flip-card">{{ digits[2] }}</span>
          <span class="flip-card">{{ digits[3] }}</span>
        </div>

        <p v-else-if="style === 'pixel'" class="lock-time pixel">{{ mmss }}</p>

        <div v-else class="breath">
          <span class="breath-glow" />
          <span class="breath-time">{{ mmss }}</span>
        </div>

        <p class="lock-meta">今日 {{ pomodoro.completed }} 个番茄 · 完成后花园会生长，猫会留下礼物</p>
        <div class="lock-actions">
          <button class="lock-btn" @click="pause">暂停</button>
          <button class="lock-btn primary" @click="end">结束专注</button>
        </div>
        <p class="lock-hint">按 Esc 暂停并退出</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.lock {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #28362f;
  background-size: cover;
  background-position: center;
  color: #fff;
  user-select: none;
}
.lock::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(17, 24, 21, 0.34);
}
.lock-layout {
  position: relative;
  z-index: 1;
  width: min(1240px, calc(100vw - 80px));
  display: grid;
  grid-template-columns: minmax(320px, 0.75fr) minmax(620px, 1.25fr);
  align-items: end;
  gap: 18px;
}
.lock-companion {
  position: relative;
  height: min(72vh, 720px);
  display: flex;
  align-items: end;
  justify-content: center;
}
.lock-cat {
  width: 100%;
  height: 92%;
  filter: drop-shadow(0 24px 22px rgba(0, 0, 0, 0.28));
}
.companion-bubble {
  position: absolute;
  z-index: 2;
  top: 5%;
  right: 1%;
  margin: 0;
  padding: 10px 13px;
  border-radius: 8px 8px 8px 2px;
  background: rgba(255, 252, 247, 0.9);
  color: #25332d;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  font-weight: 700;
}
.lock-inner {
  position: relative;
  text-align: center;
  padding: 46px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(18px);
}
.lock.wp .lock-inner {
  background: rgba(0, 0, 0, 0.45);
}
.lock-phase {
  font-size: 22px;
  letter-spacing: 2px;
  opacity: 0.85;
  margin-bottom: 10px;
}

/* 极简 */
.lock-time.minimal {
  font-size: 140px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.5);
}

/* 翻页钟 */
.flip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.flip-card {
  position: relative;
  width: 92px;
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 96px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f5f5f7;
  background: #292b2f;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.flip-card::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: rgba(0, 0, 0, 0.5);
  transform: translateY(-1px);
}
.flip-colon {
  font-size: 72px;
  font-weight: 700;
  opacity: 0.85;
}

/* 像素 LED */
.lock-time.pixel {
  font-family: 'DS-Digital', 'Courier New', ui-monospace, monospace;
  font-size: 132px;
  font-weight: 700;
  letter-spacing: 10px;
  line-height: 1;
  color: #35ff9b;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(53, 255, 155, 0.9), 0 0 26px rgba(53, 255, 155, 0.55);
}

/* 呼吸光 */
.breath {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.breath-glow {
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  box-shadow: 0 0 100px color-mix(in srgb, var(--accent) 68%, transparent);
  animation: breathe 8s ease-in-out infinite;
}
.breath-time {
  position: relative;
  font-size: 100px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}
.lock-meta {
  margin-top: 24px;
  font-size: 15px;
  opacity: 0.7;
}
.lock-actions {
  margin-top: 30px;
  display: flex;
  gap: 14px;
  justify-content: center;
}
.lock-btn {
  padding: 11px 26px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s ease;
}
.lock-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
.lock-btn.primary {
  background: #ff453a;
  border-color: transparent;
}
.lock-btn.primary:hover {
  filter: brightness(1.1);
}
.lock-hint {
  margin-top: 16px;
  font-size: 12.5px;
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .breath-glow {
    animation: none;
  }
}
@media (max-width: 1050px) {
  .lock-layout {
    width: min(920px, calc(100vw - 40px));
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .lock-inner { padding: 34px 28px; }
  .lock-time.minimal { font-size: 104px; }
  .flip-card { width: 70px; height: 102px; font-size: 76px; }
}
</style>
