<script setup lang="ts">
import { computed, provide, useId } from 'vue'
import { choiceContext, type ChoiceValue } from './choiceContext'
const props = defineProps<{ disabled?: boolean }>()
const value = defineModel<ChoiceValue>()
const emit = defineEmits<{ change: [value: ChoiceValue] }>()
provide(choiceContext, {
  name: useId(),
  value: computed(() => value.value),
  disabled: computed(() => !!props.disabled),
  select: (selected) => {
    value.value = selected
    emit('change', selected)
  },
})
</script>
<template>
  <div class="ui-radio-group" role="radiogroup"><slot /></div>
</template>
