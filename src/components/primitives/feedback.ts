import { reactive } from 'vue'

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info'
export interface ToastItem {
  id: number
  message: string
  title?: string
  tone: FeedbackTone
}
export interface DialogOptions {
  type?: string
  inputValue?: string
  inputType?: string
  inputPattern?: RegExp
  inputErrorMessage?: string
  confirmButtonText?: string
  cancelButtonText?: string
  showCancelButton?: boolean
  showClose?: boolean
  confirmButtonClass?: string
}
interface DialogRequest {
  title: string
  message: string
  prompt: boolean
  options: DialogOptions
  resolve: (result: { value: string }) => void
  reject: (reason: 'cancel' | 'close') => void
}
export const feedbackState = reactive<{ toasts: ToastItem[]; dialogs: DialogRequest[] }>({
  toasts: [],
  dialogs: [],
})
let nextId = 0

export function dismissToast(id: number) {
  feedbackState.toasts = feedbackState.toasts.filter((item) => item.id !== id)
}

function toast(
  tone: FeedbackTone,
  content: string | { message: string; title?: string; duration?: number },
) {
  const item = typeof content === 'string' ? { message: content } : content
  const id = ++nextId
  feedbackState.toasts.push({ id, tone, message: item.message, title: item.title })
  window.setTimeout(
    () => dismissToast(id),
    ('duration' in item ? item.duration : undefined) ?? 4500,
  )
}

export const notify = {
  success: (content: string | { message: string; title?: string; duration?: number }) =>
    toast('success', content),
  warning: (message: string) => toast('warning', message),
  error: (message: string) => toast('error', message),
  info: (message: string) => toast('info', message),
}

function requestDialog(
  prompt: boolean,
  message: string,
  title: string,
  options: DialogOptions = {},
) {
  return new Promise<{ value: string }>((resolve, reject) => {
    feedbackState.dialogs.push({ prompt, message, title, options, resolve, reject })
  })
}

export const dialogs = {
  confirm: (message: string, title: string, options?: DialogOptions) =>
    requestDialog(false, message, title, options),
  prompt: (message: string, title: string, options?: DialogOptions) =>
    requestDialog(true, message, title, options),
}

export function settleDialog(confirmed: boolean, value = '') {
  const dialog = feedbackState.dialogs.shift()
  if (confirmed) dialog?.resolve({ value })
  else dialog?.reject('cancel')
}
