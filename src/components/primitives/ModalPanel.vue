<script setup lang="ts">
import { t } from '@/i18n'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ref, watch } from 'vue'
withDefaults(
  defineProps<{
    title: string
    width?: string
    fullscreen?: boolean
    dismissible?: boolean
    outsideDismissible?: boolean
    sheet?: boolean
  }>(),
  { dismissible: true, outsideDismissible: true },
)
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ closed: []; open: []; 'close-auto-focus': [event: Event] }>()
let returnFocus: HTMLElement | null = null
const viewportStyles = ref<Record<string, string>>({})
watch(
  open,
  (shown, _previous, onCleanup) => {
    if (!shown) return
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const viewport = window.visualViewport
    if (!viewport) return
    const updateViewport = () => {
      // Follow the keyboard, without repositioning the dialog during pinch zoom.
      if (Math.abs(viewport.scale - 1) > 0.01) return
      viewportStyles.value = {
        '--dialog-viewport-top': `${viewport.offsetTop}px`,
        '--dialog-viewport-bottom': `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
        '--dialog-viewport-height': `${viewport.height}px`,
      }
    }
    updateViewport()
    viewport.addEventListener('resize', updateViewport)
    viewport.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    onCleanup(() => {
      viewport.removeEventListener('resize', updateViewport)
      viewport.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    })
  },
  { immediate: true },
)
function restoreFocus(event: Event) {
  emit('close-auto-focus', event)
  if (event.defaultPrevented) return
  if (returnFocus?.isConnected) {
    event.preventDefault()
    returnFocus.focus({ preventScroll: true })
  }
}
function updateOpen(shown: boolean) {
  open.value = shown
  if (shown) emit('open')
  else emit('closed')
}
</script>
<template>
  <Dialog :open="open" @update:open="updateOpen"
    ><DialogContent
      class="ui-dialog"
      :class="{ 'ui-dialog--fullscreen': fullscreen, 'ui-dialog--sheet': sheet }"
      :show-close-button="dismissible !== false"
      :style="[viewportStyles, width ? { maxWidth: width } : undefined]"
      @close-auto-focus="restoreFocus"
      @interact-outside="
        (dismissible === false || outsideDismissible === false) && $event.preventDefault()
      "
      @escape-key-down="dismissible === false && $event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>{{ t(title) }}</DialogTitle
        ><DialogDescription class="sr-only"
          >{{ t(title)
          }}{{
            dismissible !== false ? t('，可使用关闭按钮退出。') : t('，请使用下方操作继续。')
          }}</DialogDescription
        ></DialogHeader
      >
      <div class="ui-dialog__body"><slot /></div>
      <footer v-if="$slots.footer" class="ui-dialog__footer">
        <slot name="footer" /></footer></DialogContent
  ></Dialog>
</template>
