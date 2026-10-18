<script setup lang="ts">
import { t } from '@/i18n'

defineOptions({ name: 'InlineNotice' })
import { CircleAlert, X } from '@lucide/vue'
import { ref } from 'vue'
withDefaults(
  defineProps<{ title?: string; description?: string; tone?: string; closable?: boolean }>(),
  { closable: false },
)
const closed = ref(false)
</script>
<template>
  <div
    v-if="!closed"
    class="ui-alert"
    :data-tone="tone"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <CircleAlert :size="17" aria-hidden="true" />
    <div>
      <strong v-if="title || $slots.title"
        ><slot name="title">{{ t(title) }}</slot></strong
      >
      <p v-if="description">{{ t(description) }}</p>
      <slot />
    </div>
    <button v-if="closable" type="button" :aria-label="t('关闭提示')" @click="closed = true">
      <X :size="14" />
    </button>
  </div>
</template>
