<script setup lang="ts" generic="T extends string | number | undefined">
import { t } from '@/i18n'

import { inject } from 'vue'
import { fieldLabel } from './choiceContext'
const labelId = inject(fieldLabel, undefined)
defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  placeholder?: string
}>()
const value = defineModel<T>()
const emit = defineEmits<{ change: [value: T] }>()
function update(event: Event) {
  const field = event.target as HTMLInputElement
  const next = (
    typeof value.value === 'string'
      ? field.value
      : field.value === ''
        ? undefined
        : field.valueAsNumber
  ) as T
  value.value = next
  emit('change', next)
}
</script>
<template>
  <input
    class="ui-input-number"
    type="number"
    :aria-labelledby="!$attrs['aria-label'] ? labelId : undefined"
    :value="value"
    :min="min"
    :max="max"
    :step="step ?? 1"
    :disabled="disabled"
    :placeholder="t(placeholder)"
    @input="update"
  />
</template>
