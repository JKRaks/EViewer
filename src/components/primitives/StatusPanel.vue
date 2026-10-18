<script setup lang="ts">
import { t } from '@/i18n'

import { CircleAlert } from '@lucide/vue'
defineProps<{ title?: string; subTitle?: string; icon?: string }>()
</script>
<template>
  <section class="ui-result">
    <CircleAlert :size="32" :stroke-width="1.3" aria-hidden="true" />
    <h2>{{ t(title) }}</h2>
    <p>{{ t(subTitle) }}</p>
    <slot />
    <div v-if="$slots.extra"><slot name="extra" /></div>
  </section>
</template>
