<script setup lang="ts">
import { t } from '@/i18n'

import TagChip from '@/components/primitives/TagChip.vue'
import { computed } from 'vue'
import { getCategoryDisplayName, getCategoryType } from '@/core/common/category'

interface Props {
  category: string
  size?: 'large' | 'default' | 'small'
  effect?: 'dark' | 'light' | 'plain'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  effect: 'plain',
})

const categoryType = computed(() => getCategoryType(props.category))
const categoryText = computed(() => getCategoryDisplayName(props.category))
</script>

<template>
  <TagChip :tone="categoryType" :size="size" :effect="effect" class="category-tag">
    {{ t(categoryText) }}
  </TagChip>
</template>

<style scoped>
.category-tag {
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.category-tag:hover {
  opacity: 0.8;
}
</style>
