import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * 每秒更新的当前时间，供仪表盘 / 锁屏计时复用。
 */
export function useClock(): { now: Ref<Date> } {
  const now = ref<Date>(new Date())
  let timer: number | undefined

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = new Date()
    }, 1000)
  })

  onUnmounted(() => {
    if (timer) window.clearInterval(timer)
  })

  return { now }
}
