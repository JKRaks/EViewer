<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoBusi } from '@/core/busi/bookInfoBusi'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import CategoryTag from '@/components/CategoryTag.vue'
import {
  Picture,
  Clock,
  User,
  Reading,
  View,
  Download,
  ChatLineRound,
  StarFilled,
} from '@element-plus/icons-vue'

const route = useRoute()
const bookInfo = ref<bookInfoOutput>()
const bookQueryInfo = ref<bookInfoInput>()
const loading = ref(true)
const readMode = ref(false)

// 计算评分星星
const ratingStars = computed(() => {
  if (!bookInfo.value?.rating) return 0
  return parseFloat(bookInfo.value.rating)
})

// 格式化日期
const formatDate = (date: Date | undefined) => {
  if (!date) return '未知'
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 格式化评论日期时间
const formatCommentDate = (dateStr: string | Date | undefined) => {
  if (!dateStr) return '未知时间'

  // 使用正则匹配 "Posted on 26 October 2025, 08:31 by:" 格式
  const dateMatch = String(dateStr).match(/(?<=Posted on )\d{1,2} \w+ \d{4}, \d{2}:\d{2}(?= by:)/)
  if (dateMatch) {
    return dateMatch[0]
  }

  // 如果是 Date 对象,使用标准格式化
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    return date.toLocaleString('zh-CN')
  }

  return String(dateStr)
}

await fetchBookInfo()

async function fetchBookInfo() {
  loading.value = true
  try {
    const infoBusi = new bookInfoBusi()
    if (!bookQueryInfo.value) {
      bookQueryInfo.value = new bookInfoInput()
    }
    if (!bookQueryInfo.value.bookId) {
      bookQueryInfo.value.bookId = route.query.bookId as string
    }
    bookQueryInfo.value.bookId = bookQueryInfo.value.bookId.replace('-', '/')
    bookInfo.value = await infoBusi.getBookInfo(bookQueryInfo.value)
  } catch (error) {
    console.error('获取书籍信息失败:', error)
  } finally {
    loading.value = false
  }
}

async function toRead(bookQueryInfo: bookInfoInput) {
  loading.value = true
  readMode.value = true
  try {
    const infoBusi = new bookInfoBusi()
  } catch (error) {
    console.error('加载图片失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bookinfo-view" v-loading="loading">
    <div class="content-wrapper" v-if="bookInfo">
      <!-- 头部信息区 -->
      <el-card class="info-card" shadow="hover">
        <div class="header-section">
          <!-- 左侧封面 -->
          <div class="cover-container">
            <el-image
              :src="bookInfo.coverImage"
              fit="cover"
              class="cover-image"
              :preview-src-list="[bookInfo.coverImage]"
              lazy
            >
              <template #placeholder>
                <div class="image-placeholder">
                  <el-icon :size="40"><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </div>

          <!-- 右侧信息 -->
          <div class="info-container">
            <!-- 标题 -->
            <h1 class="book-title">{{ bookInfo.bookName }}</h1>

            <!-- 分类标签 -->
            <div class="category-row">
              <CategoryTag :category="bookInfo.category" />
            </div>

            <!-- 评分 -->
            <div class="rating-row">
              <el-rate
                v-model="ratingStars"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value}"
              />
              <span class="rating-count">({{ bookInfo.ratingCount }} 评分)</span>
            </div>

            <!-- 元数据 -->
            <div class="meta-info">
              <el-space wrap :size="16">
                <div class="meta-item">
                  <el-icon><User /></el-icon>
                  <span>上传者: {{ bookInfo.uploader }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Clock /></el-icon>
                  <span>{{ formatDate(bookInfo.publishDate) }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Picture /></el-icon>
                  <span>{{ bookInfo.imageCount }} 张图片</span>
                </div>
                <div class="meta-item">
                  <el-icon><Download /></el-icon>
                  <span>{{ bookInfo.totalSize }}</span>
                </div>
                <div class="meta-item" v-if="bookInfo.language">
                  <el-icon><Reading /></el-icon>
                  <span>{{ bookInfo.language }}</span>
                </div>
                <div class="meta-item" v-if="bookInfo.favorited">
                  <el-icon><StarFilled /></el-icon>
                  <span>{{ bookInfo.favorited }} 收藏</span>
                </div>
              </el-space>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
              <el-button
                type="primary"
                size="large"
                :icon="View"
                @click="toRead(bookQueryInfo!)"
                :loading="loading"
              >
                开始阅读
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 标签区 -->
      <el-card class="tags-card" shadow="hover" v-if="bookInfo.tags && bookInfo.tags.length > 0">
        <template #header>
          <div class="card-header">
            <el-icon><Reading /></el-icon>
            <span>标签</span>
          </div>
        </template>
        <div class="tags-container">
          <el-tag
            v-for="tag in bookInfo.tags"
            :key="tag"
            class="tag-item"
            size="large"
            effect="plain"
          >
            {{ tag }}
          </el-tag>
        </div>
      </el-card>

      <!-- 评论区 -->
      <el-card
        class="comments-card"
        shadow="hover"
        v-if="bookInfo.userComments && bookInfo.userComments.length > 0"
      >
        <template #header>
          <div class="card-header">
            <el-icon><ChatLineRound /></el-icon>
            <span>用户评论 ({{ bookInfo.userComments.length }})</span>
          </div>
        </template>
        <div class="comments-container">
          <div v-for="(comment, index) in bookInfo.userComments" :key="index" class="comment-item">
            <div class="comment-header">
              <div class="comment-user">
                <el-avatar :size="40" :icon="User" />
                <div class="user-info">
                  <div class="username">
                    {{ comment.username }}
                    <el-tag v-if="comment.isUploader" type="success" size="small" effect="dark">
                      上传者
                    </el-tag>
                  </div>
                  <div class="comment-date">{{ formatCommentDate(comment.date) }}</div>
                </div>
              </div>
              <el-rate
                v-if="comment.score > 0"
                :model-value="comment.score"
                disabled
                size="small"
              />
            </div>
            <div class="comment-content">{{ comment.comment }}</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.bookinfo-view {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
}

/* 返回按钮 */
.back-button {
  position: fixed;
  top: 80px;
  left: 20px;
  z-index: 100;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 信息卡片 */
.info-card {
  border-radius: 12px;
}

.header-section {
  display: flex;
  gap: 24px;
}

/* 封面容器 */
.cover-container {
  flex-shrink: 0;
  width: 280px;
}

.cover-image {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s;
  cursor: pointer;
}

.cover-image:hover {
  transform: scale(1.02);
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  border-radius: 8px;
}

/* 信息容器 */
.info-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.book-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.4;
}

.category-row {
  display: flex;
  align-items: center;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rating-count {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 元数据 */
.meta-info {
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.meta-item .el-icon {
  color: var(--el-color-primary);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

/* 标签卡片 */
.tags-card,
.comments-card,
.images-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.card-header .el-icon {
  color: var(--el-color-primary);
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.tag-item:hover {
  transform: scale(1.05);
}

/* 评论区 */
.comments-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comment-item {
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
  transition: background-color 0.3s;
}

.comment-item:hover {
  background-color: var(--el-fill-color-light);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.comment-user {
  display: flex;
  gap: 12px;
  align-items: center;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.username {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-date {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.comment-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
  padding-left: 52px;
}

/* 图片阅读区 */
.images-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reader-image {
  width: 100%;
  border-radius: 8px;
  cursor: pointer;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bookinfo-view {
    padding: 12px;
  }

  .back-button {
    top: 60px;
    left: 12px;
  }

  .header-section {
    flex-direction: column;
  }

  .cover-container {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }

  .book-title {
    font-size: 22px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-buttons .el-button {
    width: 100%;
  }

  .meta-info {
    padding: 12px;
  }

  .comment-content {
    padding-left: 0;
    margin-top: 8px;
  }
}

@media (max-width: 480px) {
  .bookinfo-view {
    padding: 8px;
  }

  .content-wrapper {
    gap: 12px;
  }

  .book-title {
    font-size: 18px;
  }

  .meta-item {
    font-size: 13px;
  }

  .tags-container {
    gap: 8px;
  }

  .comment-item {
    padding: 12px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .cover-image {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}
</style>
