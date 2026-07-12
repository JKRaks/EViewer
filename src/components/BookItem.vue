<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { bookItem } from '@/core/model/book/bookOutput'
import type { tagCollection } from '@/core/model/book/tag'
import { getTagDisplayInfo } from '@/core/common/tagTranslations'
import { Picture, Star, Clock } from '@element-plus/icons-vue'
import CategoryTag from './CategoryTag.vue'

interface Props {
  book: bookItem
}

const props = defineProps<Props>()
const router = useRouter()

// 格式化图片数量
const imageCountText = computed(() => {
  return `${props.book.imgCount || 0} 张`
})

// 处理点击事件 - 跳转到详情页
const formatTagText = (tag: tagCollection) => {
  const officialTag = tag.items.find((item) => item.official)
  const selectedTag = officialTag ?? tag.items[0]

  if (!selectedTag) {
    return ''
  }

  return getTagDisplayInfo(tag.collection, selectedTag).text
}

const validTagTexts = computed(() => {
  return props.book.tags.map(formatTagText).filter(Boolean)
})

const visibleTags = computed(() => {
  return validTagTexts.value.slice(0, 3)
})

const hiddenTagCount = computed(() => {
  return Math.max(validTagTexts.value.length - visibleTags.value.length, 0)
})

const handleClick = () => {
  router.push({
    name: 'bookinfo',
    query: { bookId: props.book.bookId },
  })
}
</script>

<template>
  <div class="book-item" @click="handleClick">
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
          v-for="(tagText, index) in visibleTags"
          :key="index"
          size="small"
          type="info"
          class="tag-item"
          effect="plain"
        >
          <span class="tag-text">
            {{ tagText }}
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
      <div class="book-time" v-if="book.publishDate">
        <el-icon :size="12">
          <Clock />
        </el-icon>
        <span>{{ book.publishDate.toLocaleDateString() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
  transition: all 0.3s;
  height: 160px;
  overflow: hidden;
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
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex-wrap: wrap;
  align-items: center;
  /* 最多显示2行标签 */
  max-height: 56px;
  overflow: hidden;
  line-height: 1.4;
}

.tag-item {
  /* 移除最大宽度限制,让标签自适应内容 */
  flex-shrink: 0;
  /* 确保标签内容不被压缩 */
  min-width: 0;
  /* 添加最大宽度,防止过长标签 */
  max-width: min(150px, 100%);
  height: auto; /* 允许高度自适应 */
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
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1.4;
}

.tag-more {
  background-color: var(--el-color-info-light-9);
}

.tag-more .tag-text {
  /* 确保+数字完整显示 */
  white-space: nowrap;
}

/* 时间 */
.book-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: auto;
}

.book-time .el-icon {
  color: var(--el-text-color-placeholder);
}

/* 响应式适配 */
@media (max-width: 768px) {
  .book-item {
    height: auto; /* 改为自动高度 */
    min-height: 140px; /* 设置最小高度 */
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
    max-height: 60px; /* 增加最大高度,允许多行 */
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
    height: auto; /* 改为自动高度 */
    min-height: 120px; /* 设置最小高度 */
    gap: 8px;
    padding: 8px;
  }

  .book-cover {
    width: 70px;
    height: 104px;
  }

  .book-title {
    font-size: 14px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
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
    max-height: 52px; /* 增加最大高度 */
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

  .book-tags {
    max-height: 48px; /* 允许2行标签 */
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
