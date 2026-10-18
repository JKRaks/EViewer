<script setup lang="ts">
import { t } from '@/i18n'

import { BookOpen } from '@lucide/vue'
defineProps<{ description?: string }>()
</script>
<template>
  <div class="ui-empty">
    <BookOpen :size="30" :stroke-width="1" aria-hidden="true" />
    <p>{{ description || t('暂无内容') }}</p>
    <slot />
  </div>
</template>
