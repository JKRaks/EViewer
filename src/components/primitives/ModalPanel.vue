<script setup lang="ts">
import { t } from '@/i18n'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { watch } from 'vue'
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
const emit = defineEmits<{ closed: []; open: [] }>()
let returnFocus: HTMLElement | null = null
watch(
  open,
  (shown) => {
    if (shown)
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  },
  { immediate: true },
)
function restoreFocus(event: Event) {
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
      :style="width ? { maxWidth: width } : undefined"
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
