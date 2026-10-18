<script setup lang="ts">
import { t } from '@/i18n'

defineOptions({ name: 'ReadRating' })
import { Star } from '@lucide/vue'
defineProps<{
  modelValue?: number
  disabled?: boolean
  showScore?: boolean
  scoreTemplate?: string
  size?: string
}>()
</script>
<template>
  <span class="ui-rate" :aria-label="t('评分 {p0} / 5', { p0: modelValue ?? 0 })"
    ><Star
      v-for="index in 5"
      :key="index"
      :size="14"
      :fill="index <= Math.round(modelValue || 0) ? 'currentColor' : 'none'"
    /><span v-if="showScore">{{
      scoreTemplate?.replace('{value}', String(modelValue ?? 0)) || modelValue?.toFixed(1)
    }}</span></span
  >
</template>
