<script setup lang="ts">
import { t } from '@/i18n'

defineOptions({ name: 'FormField' })
import { provide, useId } from 'vue'
import { fieldLabel } from './choiceContext'
defineProps<{ label?: string }>()
const id = useId()
provide(fieldLabel, id)
</script>
<template>
  <div class="ui-form-item" role="group" :aria-labelledby="label ? id : undefined">
    <label
      v-if="label"
      :id="id"
      @click="
        ($event.currentTarget as HTMLElement).parentElement
          ?.querySelector<HTMLElement>('input,select,textarea,[role=combobox]')
          ?.focus()
      "
      >{{ t(label) }}</label
    ><slot />
  </div>
</template>
