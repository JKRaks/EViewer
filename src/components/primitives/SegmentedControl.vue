<script setup lang="ts">
import { t } from '@/i18n'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
defineProps<{
  options: Array<string | { label: string; value: string | number; disabled?: boolean }>
  disabled?: boolean
}>()
const value = defineModel<string | number>()
</script>
<template>
  <Tabs v-model="value" class="ui-segmented"
    ><TabsList
      ><TabsTrigger
        v-for="option in options"
        :key="typeof option === 'string' ? option : option.value"
        :value="typeof option === 'string' ? option : option.value"
        :disabled="disabled || (typeof option !== 'string' && option.disabled)"
        >{{ t(typeof option === 'string' ? option : option.label) }}</TabsTrigger
      ></TabsList
    ></Tabs
  >
</template>
