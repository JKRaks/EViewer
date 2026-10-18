<script setup lang="ts">
import { computed, provide } from 'vue'
import { checkContext, type ChoiceValue } from './choiceContext'
const props = defineProps<{ disabled?: boolean }>()
const value = defineModel<ChoiceValue[]>({ default: () => [] })
provide(checkContext, {
  value: computed(() => value.value),
  disabled: computed(() => !!props.disabled),
  toggle: (item, selected) => {
    value.value = selected ? [...value.value, item] : value.value.filter((entry) => entry !== item)
  },
})
</script>
<template>
  <div class="ui-checkbox-group" role="group"><slot /></div>
</template>
