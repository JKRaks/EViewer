<script setup lang="ts">
import { t } from '@/i18n'

import { computed, inject } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { checkContext, type ChoiceValue } from './choiceContext'
const props = defineProps<{
  value?: ChoiceValue
  disabled?: boolean
  indeterminate?: boolean
  label?: string
}>()
const model = defineModel<boolean>({ default: false })
const emit = defineEmits<{ change: [value: boolean] }>()
const group = inject(checkContext, undefined)
const checked = computed(() =>
  props.indeterminate
    ? 'indeterminate'
    : group
      ? group.value.value.includes(props.value!)
      : model.value,
)
function update(value: boolean | 'indeterminate') {
  const selected = value === true
  if (group && props.value !== undefined) group.toggle(props.value, selected)
  else model.value = selected
  emit('change', selected)
}
</script>
<template>
  <label class="ui-checkbox" :class="{ 'is-checked': checked === true }"
    ><Checkbox
      :model-value="checked"
      :aria-label="t($attrs['aria-label'] as string | undefined)"
      :disabled="disabled || group?.disabled.value"
      @update:model-value="update"
    /><span v-if="$slots.default || label"
      ><slot>{{ t(label) }}</slot></span
    ></label
  >
</template>
