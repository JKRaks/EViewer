<script setup lang="ts">
import { t } from '@/i18n'

import { X } from '@lucide/vue'
defineProps<{ tone?: string; closable?: boolean; size?: string; effect?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <span class="ui-tag" :data-tone="tone"
    ><span class="ui-tag__content"><slot /></span
    ><button
      v-if="closable"
      type="button"
      :aria-label="t('移除此条件')"
      @click.stop="emit('close')"
    >
      <X :size="12" /></button
  ></span>
</template>
