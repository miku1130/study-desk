import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'info' | 'error'

export interface ToastItem {
  id: number
  type: ToastType
  text: string
}

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let toastSeq = 0

/** 全局 UI 反馈：轻提示 toast + Promise 化确认弹窗 */
export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastItem[]>([])
  const confirmState = ref<ConfirmState | null>(null)

  function toast(text: string, type: ToastType = 'success', duration = 2400): void {
    const id = ++toastSeq
    toasts.value.push({ id, type, text })
    if (toasts.value.length > 4) toasts.value.shift()
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }

  const success = (text: string): void => toast(text, 'success')
  const info = (text: string): void => toast(text, 'info')
  const error = (text: string): void => toast(text, 'error', 3200)

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = { confirmText: '确定', danger: false, ...options, resolve }
    })
  }

  function settleConfirm(ok: boolean): void {
    confirmState.value?.resolve(ok)
    confirmState.value = null
  }

  return { toasts, confirmState, toast, success, info, error, confirm, settleConfirm }
})
