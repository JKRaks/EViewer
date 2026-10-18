<script setup lang="ts">
import { t } from '@/i18n'

import { computed, ref, watch } from 'vue'
import { Check, CircleAlert, X } from '@lucide/vue'
import ModalPanel from './ModalPanel.vue'
import ActionButton from './ActionButton.vue'
import TextField from './TextField.vue'
import { dismissToast, feedbackState, settleDialog } from './feedback'
const current = computed(() => feedbackState.dialogs[0])
const value = ref('')
const error = ref('')
watch(current, (dialog) => {
  value.value = dialog?.options.inputValue ?? ''
  error.value = ''
})
function confirm() {
  const options = current.value?.options
  if (options?.inputPattern && !options.inputPattern.test(value.value)) {
    error.value = options.inputErrorMessage || t('请输入有效内容')
    return
  }
  settleDialog(true, value.value)
}
</script>
<template>
  <Teleport to="body"
    ><div class="feedback-toasts" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast"
        ><div
          v-for="item in feedbackState.toasts"
          :key="item.id"
          class="feedback-toast"
          :data-tone="item.tone"
          :role="item.tone === 'error' ? 'alert' : 'status'"
        >
          <component :is="item.tone === 'success' ? Check : CircleAlert" :size="18" />
          <div>
            <strong v-if="item.title">{{ t(item.title) }}</strong>
            <p>{{ t(item.message) }}</p>
          </div>
          <button type="button" :aria-label="t('关闭提示')" @click="dismissToast(item.id)">
            <X :size="15" />
          </button></div
      ></TransitionGroup></div
  ></Teleport>
  <ModalPanel
    v-if="current"
    :model-value="true"
    :title="t(current.title)"
    :dismissible="current.options.showClose !== false"
    width="min(440px, calc(100vw - 24px))"
    @update:model-value="!$event && settleDialog(false)"
  >
    <form @submit.prevent="confirm">
      <p>{{ t(current.message) }}</p>
      <TextField
        v-if="current.prompt"
        v-model="value"
        :type="current.options.inputType || 'text'"
        :aria-label="t(current.title)"
        autofocus
      />
      <p v-if="error" class="field-error" role="alert">{{ t(error) }}</p>
    </form>
    <template #footer
      ><ActionButton
        v-if="current.options.showCancelButton !== false"
        @click="settleDialog(false)"
        >{{ t(current.options.cancelButtonText || '取消') }}</ActionButton
      ><ActionButton
        :variant="
          current.options.confirmButtonClass?.includes('danger') ? 'destructive' : 'default'
        "
        @click="confirm"
        >{{ t(current.options.confirmButtonText || '确定') }}</ActionButton
      ></template
    >
  </ModalPanel>
</template>
