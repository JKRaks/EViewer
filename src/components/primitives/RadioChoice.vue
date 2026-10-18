<script setup lang="ts">
import { computed, inject } from 'vue'
import { choiceContext, type ChoiceValue } from './choiceContext'
const props = defineProps<{ value: ChoiceValue; disabled?: boolean }>()
const group = inject(choiceContext, undefined)
const selected = computed(() => group?.value.value === props.value)
</script>
<template>
  <label
    class="ui-radio"
    :class="{ 'is-checked': selected, 'is-disabled': disabled || group?.disabled.value }"
    ><input
      type="radio"
      :name="group?.name"
      :checked="selected"
      :disabled="disabled || group?.disabled.value"
      @change="group?.select(value)" /><span><slot /></span
  ></label>
</template>
