<script setup lang="ts">
import { t } from '@/i18n'

import { computed } from 'vue'
const props = withDefaults(
  defineProps<{
    percentage?: number
    showText?: boolean
    strokeWidth?: number
    width?: number
    type?: string
    color?: string
    status?: string
    label?: string
    valueText?: string
  }>(),
  { percentage: 0, showText: true, strokeWidth: 5, width: 112 },
)
const percent = computed(() => Math.min(100, Math.max(0, props.percentage)))
</script>
<template>
  <span
    v-if="type === 'dashboard' || type === 'circle'"
    class="ui-progress-ring"
    role="progressbar"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label || t('进度')"
    :aria-valuetext="valueText"
    :style="{
      width: `${width}px`,
      height: `${width}px`,
      '--progress': `${percent}%`,
      '--gauge-color': color || 'var(--accent)',
    }"
    ><span>{{ Math.round(percent) }}%</span></span
  ><span v-else class="ui-progress" :style="{ '--gauge-color': color || 'var(--accent)' }"
    ><span
      class="ui-progress__track"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label || t('进度')"
      :aria-valuetext="valueText"
      :style="{ height: `${strokeWidth}px` }"
      ><span :style="{ width: `${percent}%` }" /></span
    ><small v-if="showText">{{ Math.round(percent) }}%</small></span
  >
</template>
