<script setup lang="ts">
import { t } from '@/i18n'

withDefaults(defineProps<{ loading?: boolean; rows?: number; count?: number }>(), {
  loading: true,
  rows: 3,
  count: 1,
})
</script>
<template>
  <div class="ui-skeleton" :aria-busy="loading || undefined">
    <template v-if="loading"
      ><div v-for="index in count" :key="index" :aria-label="t('加载中')" role="status">
        <slot name="template"
          ><div
            v-for="row in rows"
            :key="row"
            class="ui-skeleton__item"
            :style="{ width: row === rows ? '60%' : '100%' }"
        /></slot></div></template
    ><slot v-else />
  </div>
</template>
