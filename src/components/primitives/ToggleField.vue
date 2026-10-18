<script setup lang="ts">
import { t } from '@/i18n'

import { Switch } from '@/components/ui/switch'
import { inject } from 'vue'
import { fieldLabel } from './choiceContext'
const labelId = inject(fieldLabel, undefined)
defineOptions({ inheritAttrs: false })
defineProps<{ label?: string; disabled?: boolean }>()
const value = defineModel<boolean>({ default: false })
const emit = defineEmits<{ change: [value: boolean] }>()
</script>
<template>
  <label class="ui-switch" :class="$attrs.class"
    ><Switch
      v-bind="{ ...$attrs, class: undefined }"
      v-model="value"
      :aria-label="
        t(($attrs['aria-label'] as string | undefined) || (!labelId ? label : undefined))
      "
      :aria-labelledby="!$attrs['aria-label'] ? labelId : undefined"
      :disabled="disabled"
      @update:model-value="emit('change', $event)"
    /><span v-if="label">{{ t(label) }}</span></label
  >
</template>
