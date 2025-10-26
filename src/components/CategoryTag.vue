<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  category: string
  size?: 'large' | 'default' | 'small'
  effect?: 'dark' | 'light' | 'plain'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  effect: 'plain',
})

// 根据分类返回不同的颜色
const categoryType = computed(() => {
  const categoryMap: Record<string, string> = {
    Doujinshi: 'danger',
    Manga: 'warning',
    'Artist CG': 'success',
    'Game CG': 'info',
    Western: 'primary',
    'Non-H': '',
    'Image Set': 'success',
    Cosplay: 'warning',
    'Asian Porn': 'danger',
    Misc: 'info',
  }

  return categoryMap[props.category] || 'info'
})

// 将英文分类翻译为中文
const categoryText = computed(() => {
  const translationMap: Record<string, string> = {
    Doujinshi: '同人志',
    Manga: '漫画',
    'Artist CG': '艺术家CG',
    'Game CG': '游戏CG',
    Western: '西方',
    'Non-H': '非H',
    'Image Set': '图像集',
    Cosplay: 'Cosplay',
    'Asian Porn': '亚洲色情',
    Misc: '杂项',
  }

  return translationMap[props.category] || props.category
})
</script>

<template>
  <el-tag :type="categoryType" :size="size" :effect="effect" class="category-tag">
    {{ categoryText }}
  </el-tag>
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
