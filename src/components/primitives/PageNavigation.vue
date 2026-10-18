<script setup lang="ts">
import { t } from '@/i18n'

import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import ActionButton from './ActionButton.vue'
const props = defineProps<{ currentPage: number; pageCount: number }>()
const emit = defineEmits<{ 'current-change': [value: number] }>()
const pages = computed(() => {
  const start = Math.max(1, Math.min(props.currentPage - 2, props.pageCount - 4))
  return Array.from({ length: Math.min(5, props.pageCount) }, (_, index) => start + index)
})
</script>
<template>
  <nav class="ui-pagination" :aria-label="t('分页')">
    <ActionButton
      size="icon"
      :icon="ChevronLeft"
      :disabled="currentPage <= 1"
      :aria-label="t('上一页')"
      @click="emit('current-change', currentPage - 1)"
    /><ActionButton v-if="pages[0]! > 1" @click="emit('current-change', 1)">1 …</ActionButton
    ><ActionButton
      v-for="page in pages"
      :key="page"
      :variant="currentPage === page ? 'default' : 'ghost'"
      :aria-current="currentPage === page ? 'page' : undefined"
      @click="emit('current-change', page)"
      >{{ page }}</ActionButton
    ><ActionButton v-if="pages.at(-1)! < pageCount" @click="emit('current-change', pageCount)"
      >… {{ pageCount }}</ActionButton
    ><ActionButton
      size="icon"
      :icon="ChevronRight"
      :disabled="currentPage >= pageCount"
      :aria-label="t('下一页')"
      @click="emit('current-change', currentPage + 1)"
    />
  </nav>
</template>
