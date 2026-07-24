<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { bookItem } from '@/core/model/book/bookOutput'
import { getTagDisplayInfo } from '@/core/common/tagTranslations'
import { Picture, Star, StarFilled, Clock } from '@element-plus/icons-vue'
import CategoryTag from './CategoryTag.vue'

interface Props {
  book: bookItem
  selectable?: boolean
  selected?: boolean
  favoritedAt?: Date
  favoriteCategoryName?: string
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  selected: false,
  favoriteCategoryName: '',
})
const emit = defineEmits<{
  'update:selected': [value: boolean]
}>()
const router = useRouter()

// 格式化图片数量
const imageCountText = computed(() => {
  return `${props.book.imgCount || 0} 张`
})

const displayTags = computed(() => {
  const officialTags = props.book.tags.flatMap((collection) =>
    collection.items
      .filter((tag) => tag.official)
      .map((tag) => ({
        key: `${collection.collection}:${tag.name}`,
        text: getTagDisplayInfo(collection.collection, tag).text,
      })),
  )
  const currentFallbackTags = props.book.tags.flatMap((collection) => {
    const selectedTag = collection.items.find((tag) => tag.official) ?? collection.items[0]
    return selectedTag
      ? [
          {
            key: `${collection.collection}:${selectedTag.name}`,
            text: getTagDisplayInfo(collection.collection, selectedTag).text,
          },
        ]
      : []
  })
  const seen = new Set<string>()
  const candidates =
    officialTags.length >= 3 ? officialTags : [...officialTags, ...currentFallbackTags]

  return candidates.filter((tag) => {
    if (!tag.text || seen.has(tag.key)) {
      return false
    }
    seen.add(tag.key)
    return true
  })
})

const visibleTags = computed(() => {
  return displayTags.value.slice(0, 3)
})

const hiddenTagCount = computed(() => {
  return Math.max(displayTags.value.length - visibleTags.value.length, 0)
})

const favoritedTimeText = computed(() => {
  if (!props.favoritedAt) return ''
  return props.favoritedAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const handleClick = () => {
  router.push({
    name: 'bookinfo',
    query: { bookId: props.book.bookId },
  })
}

const handleSelectionChange = (value: boolean | string | number) => {
  emit('update:selected', Boolean(value))
}
</script>

<template>
  <div class="book-item" :class="{ 'is-selected': selected }" @click="handleClick">
    <el-checkbox
      v-if="selectable"
      class="book-selection"
      :model-value="selected"
      aria-label="选择画册"
      @click.stop
      @change="handleSelectionChange"
    />
    <!-- 左侧封面图片 -->
    <div class="book-cover">
      <el-image :src="book.thumbnailUrl" fit="cover" class="cover-image" lazy> </el-image>
    </div>

    <!-- 右侧信息 -->
    <div class="book-info">
      <!-- 标题 -->
      <div class="book-title" :title="book.bookTitle">
        {{ book.bookTitle }}
      </div>

      <!-- 元数据 -->
      <div class="book-meta">
        <div class="meta-item">
          <el-icon :size="14">
            <Picture />
          </el-icon>
          <span>{{ imageCountText }}</span>
        </div>

        <CategoryTag v-if="book.category" :category="book.category" />

        <div v-if="book.rate" class="meta-item">
          <el-icon :size="14">
            <Star />
          </el-icon>
          <span>{{ book.rate?.toFixed(1) }}</span>
        </div>
      </div>

      <!-- 标签 -->
      <div class="book-tags" v-if="visibleTags.length > 0">
        <el-tag
          v-for="tag in visibleTags"
          :key="tag.key"
          size="small"
          type="info"
          class="tag-item"
          effect="plain"
        >
          <span class="tag-text">
            {{ tag.text }}
          </span>
        </el-tag>
        <el-tag
          v-if="hiddenTagCount > 0"
          size="small"
          type="info"
          class="tag-item tag-more"
          effect="plain"
        >
          <span class="tag-text">+{{ hiddenTagCount }}</span>
        </el-tag>
      </div>

      <!-- 上传时间 -->
      <div v-if="book.publishDate || favoritedTimeText" class="book-time-row">
        <div class="book-time" v-if="book.publishDate">
          <el-icon :size="12">
            <Clock />
          </el-icon>
          <span>{{ book.publishDate.toLocaleDateString() }}</span>
        </div>
        <div v-if="favoritedTimeText" class="book-time favorite-time" :title="favoriteCategoryName">
          <el-icon :size="12">
            <StarFilled />
          </el-icon>
          <span>{{ favoritedTimeText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
  transition: all 0.3s;
  min-height: 160px;
}

.book-item.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.book-selection {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  height: 24px;
  padding: 0 5px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
}

.book-item:has(.book-selection) .book-title {
  padding-right: 28px;
}

.book-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary);
  transform: translateY(-2px);
}

/* 左侧封面 */
.book-cover {
  flex-shrink: 0;
  width: 100px;
  height: 136px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--el-fill-color-light);
}

.cover-image {
  width: 100%;
  height: 100%;
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}

/* 右侧信息 */
.book-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

/* 标题 */
.book-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  word-break: break-word;
}

/* 元数据 */
.book-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.meta-item .el-icon {
  color: var(--el-text-color-secondary);
}

/* 标签 */
.book-tags {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
}

.tag-item {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(150px, 100%);
  overflow: hidden;
}

.tag-item :deep(.el-tag__content) {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

/* 标签内部文字样式 */
.tag-text {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1.4;
}

.tag-more {
  flex-shrink: 0;
  background-color: var(--el-color-info-light-9);
}

.tag-more .tag-text {
  /* 确保+数字完整显示 */
  white-space: nowrap;
}

/* 时间 */
.book-time-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: auto;
}

.book-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.book-time .el-icon {
  color: var(--el-text-color-placeholder);
}

.favorite-time {
  color: var(--el-color-primary);
}

.favorite-time .el-icon {
  color: currentColor;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .book-item {
    min-height: 140px;
    gap: 10px;
    padding: 10px;
  }

  .book-cover {
    width: 80px;
    height: 120px;
  }

  .book-title {
    font-size: 15px;
    line-height: 1.5; /* 增加行高 */
  }

  .meta-item {
    font-size: 12px;
  }

  .book-tags {
    gap: 4px;
  }

  .tag-item {
    font-size: 11px;
    max-width: 120px;
    line-height: 1.4; /* 添加行高 */
  }

  /* 调整 el-tag 的内边距 */
  .tag-item :deep(.el-tag__content) {
    padding: 0 6px;
    line-height: 1.4;
  }
}

@media (max-width: 480px) {
  .book-item {
    min-height: 120px;
    gap: 8px;
    padding: 8px;
  }

  .book-cover {
    width: 70px;
    height: 104px;
  }

  .book-title {
    font-size: 14px;
    line-height: 1.5; /* 增加行高 */
  }

  .meta-item {
    font-size: 11px;
    line-height: 1.4;
  }

  .book-meta {
    gap: 8px;
  }

  .book-tags {
    gap: 4px;
  }

  .tag-item {
    font-size: 10px;
    max-width: 100px;
    line-height: 1.5; /* 增加行高 */
  }

  /* 小屏幕下进一步缩小内边距 */
  .tag-item :deep(.el-tag__content) {
    padding: 0 4px;
    line-height: 1.5;
  }

  .book-time {
    font-size: 11px;
    line-height: 1.4;
  }
}

/* 超小屏幕 - 限制标签数量 */
@media (max-width: 360px) {
  .book-item {
    min-height: 110px;
  }

  .tag-item {
    max-width: 80px;
    font-size: 9px;
    line-height: 1.5;
  }

  .tag-item :deep(.el-tag__content) {
    padding: 0 3px;
    line-height: 1.5;
  }

  .book-title {
    line-height: 1.5;
  }
}
</style>
