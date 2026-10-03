<script lang="ts" setup>
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { getBookInfoWithCache } from '@/core/cache/galleryCache'
import { getReadingHistory, isReadingHistoryEnabled } from '@/core/cache/readingHistory'
import type { ReadingHistoryRecord } from '@/core/cache/indexedDb'
import CategoryTag from '@/components/CategoryTag.vue'
import BookShareOverlay from '@/components/BookShareOverlay.vue'
import CommentContent from '@/components/CommentContent.vue'
import {
  Picture,
  Clock,
  User,
  Reading,
  View,
  Download,
  ChatLineRound,
  Star,
  StarFilled,
  Share,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import router from '@/router'
import { useLayoutMainScrollMemory } from '@/composables/useLayoutMainScrollMemory'
import { getTagCollectionDisplayName, getTagDisplayInfo } from '@/core/common/tagTranslations'
import { useAuthState } from '@/core/auth/authState'
import {
  getFavoriteCategoryOptionsCached,
  seedFavoriteCategoryCache,
  type FavoriteCategoryOption,
} from '@/core/auth/userConfigCache'
import { favoriteBusi } from '@/core/books/favoriteBusi'
import { markFavoriteDataChanged } from '@/core/books/favoriteRevision'
import { galleryFavoriteInput, galleryFavoriteUpdateInput } from '@/core/model/book/favoriteInput'
import {
  galleryFavoriteStateData,
  type galleryFavoriteStatus,
} from '@/core/model/book/favoriteOutput'

const route = useRoute()
const funcData = reactive({
  loading: true,
  readMode: false,
})
const pageData = ref(new bookInfoOutput())
const readingHistory = ref<ReadingHistoryRecord>()
let readingRequestVersion = 0
const readingProgress = computed(() => {
  const total = Number(pageData.value.imageCount)
  const record = readingHistory.value
  if (!isReadingHistoryEnabled() || !record || total <= 0 || !Number.isFinite(total)) {
    return { label: '开始阅读', percent: 0 }
  }
  const count = new Set(record.viewedOrdinals.filter(
    (ordinal) => Number.isInteger(ordinal) && ordinal > 0 && ordinal <= total,
  )).size
  const percent = count / total * 100
  return {
    label: count === 0 ? '开始阅读' : count === total ? '已读完' : `${Math.min(99, Math.floor(percent))}% · ${count}/${total} 张`,
    percent,
  }
})

async function refreshReadingProgress() {
  const bookId = getRouteBookId()
  const version = ++readingRequestVersion
  readingHistory.value = undefined
  if (!bookId) return
  const record = await getReadingHistory(bookId)
  if (version === readingRequestVersion && getRouteBookId() === bookId) readingHistory.value = record
}
const shareVisible = ref(false)
const shareCoverElement = ref<HTMLImageElement | null>(null)
const favoriteDialogVisible = ref(false)
const favoriteLoading = ref(false)
const favoriteUpdating = ref(false)
const favoriteCategories = ref<FavoriteCategoryOption[]>([])
const selectedFavoriteCategory = ref<number>()
const galleryFavoriteState = ref(new galleryFavoriteStateData())
let loadingBookId = ''
let bookRequestVersion = 0
let favoriteRequestVersion = 0
const { persistScrollPosition, bindScrollListener, unbindScrollListener } =
  useLayoutMainScrollMemory('bookinfo-scroll-position')
const authState = useAuthState()
const galleryFavoriteBusi = new favoriteBusi()

defineOptions({
  name: 'BookInfoView',
})

// 计算评分星星
const ratingStars = computed(() => {
  return parseFloat(pageData.value.rating)
})

const isGalleryFavorited = computed(() => pageData.value.personalFavoriteStatus === 'favorited')
const favoriteButtonLabel = computed(() => {
  if (!authState.loggedIn) return '登录后收藏'
  if (favoriteLoading.value) return '正在读取收藏状态'
  return isGalleryFavorited.value ? '管理收藏' : '添加收藏'
})

const tagGroups = computed(() => {
  return pageData.value.tags
    .filter((collection) => collection.items.length > 0)
    .map((collection) => ({
      collection: collection.collection,
      displayCollection: getTagCollectionDisplayName(collection.collection),
      items: collection.items.map((tag, index) => ({
        key: `${collection.collection}:${tag.name}:${index}`,
        tag,
        display: getTagDisplayInfo(collection.collection, tag),
      })),
    }))
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

onMounted(() => {
  bindScrollListener()
  void refreshReadingProgress()
  void fetchBookInfo()
})

onActivated(() => {
  bindScrollListener()
  void refreshReadingProgress()
  consumeFavoriteIntent()

  const routeBookId = getRouteBookId()
  if (!funcData.loading && pageData.value.bookId === routeBookId && authState.loggedIn) {
    void refreshGalleryFavoriteState(routeBookId)
  }

  if (routeBookId && routeBookId !== pageData.value.bookId && routeBookId !== loadingBookId) {
    void fetchBookInfo()
  }
})

watch(
  () => route.query.bookId,
  (bookId, previousBookId) => {
    if (bookId !== previousBookId) {
      void refreshReadingProgress()
      void fetchBookInfo()
    }
  },
)

watch(() => route.query.favorite, () => consumeFavoriteIntent())

watch(
  () => [authState.loggedIn, authState.memberId] as const,
  ([loggedIn]) => {
    favoriteRequestVersion += 1
    favoriteDialogVisible.value = false
    galleryFavoriteState.value = new galleryFavoriteStateData()
    favoriteCategories.value = []
    pageData.value.personalFavoriteStatus = 'unknown'
    pageData.value.personalFavoriteCategoryIndex = undefined
    if (loggedIn && pageData.value.bookId === getRouteBookId()) {
      void refreshGalleryFavoriteState(pageData.value.bookId)
    }
  },
)

onDeactivated(() => {
  readingRequestVersion++
  bookRequestVersion++
  loadingBookId = ''
  resetBookActions()
  persistScrollPosition()
  unbindScrollListener()
})

onUnmounted(() => {
  readingRequestVersion++
  bookRequestVersion++
  resetBookActions()
  persistScrollPosition()
  unbindScrollListener()
})

async function fetchBookInfo() {
  const routeBookId = getRouteBookId()
  if (!routeBookId || loadingBookId === routeBookId) {
    return
  }

  const requestVersion = ++bookRequestVersion
  loadingBookId = routeBookId
  funcData.loading = true
  resetBookActions()
  try {
    const requestInput = new bookInfoInput()
    requestInput.bookId = routeBookId
    const result = await getBookInfoWithCache(requestInput, 'detail')
    if (requestVersion === bookRequestVersion && getRouteBookId() === routeBookId) {
      pageData.value = result
      if (authState.loggedIn) void refreshGalleryFavoriteState(routeBookId)
    }
  } catch (error) {
    console.error('获取书籍信息失败:', error)
  } finally {
    if (requestVersion === bookRequestVersion) {
      loadingBookId = ''
      funcData.loading = false
      consumeFavoriteIntent()
    }
  }
}

function consumeFavoriteIntent() {
  if (route.query.favorite !== '1' || funcData.loading || pageData.value.bookId !== getRouteBookId()) return
  void router.replace({ path: route.path, query: { ...route.query, favorite: undefined } })
  void openFavoriteDialog()
}

function getRouteBookId(): string {
  const routeBookId = route.query.bookId
  return typeof routeBookId === 'string' ? routeBookId.replace('-', '/') : ''
}

function openSharePreview() {
  if (funcData.loading || pageData.value.bookId !== getRouteBookId()) return

  shareCoverElement.value = document.querySelector<HTMLImageElement>(
    '.bookinfo-view .cover-image img',
  )
  shareVisible.value = true
}

function resetBookActions() {
  favoriteRequestVersion += 1
  shareVisible.value = false
  shareCoverElement.value = null
  favoriteDialogVisible.value = false
  favoriteLoading.value = false
  favoriteUpdating.value = false
  favoriteCategories.value = []
  selectedFavoriteCategory.value = undefined
  galleryFavoriteState.value = new galleryFavoriteStateData()
}

async function refreshGalleryFavoriteState(bookId: string, showError = false) {
  if (!authState.loggedIn || !authState.memberId || bookId !== getRouteBookId()) return false

  const requestVersion = ++favoriteRequestVersion
  favoriteLoading.value = true
  const categoryRequest = getFavoriteCategoryOptionsCached(authState.memberId).catch((error) => {
    console.warn('读取收藏分类缓存失败，使用画册弹窗分类:', error)
    return []
  })
  try {
    const result = await galleryFavoriteBusi.getGalleryFavoriteState(
      new galleryFavoriteInput(bookId),
    )
    if (requestVersion !== favoriteRequestVersion || bookId !== getRouteBookId()) return false
    if (result.authenticationRequired) throw new Error(result.msg)
    if (!result.isSuccess || !result.data) {
      throw new Error(result.msg || '画册收藏状态获取失败')
    }

    let cachedCategories: FavoriteCategoryOption[] = await categoryRequest
    if (requestVersion !== favoriteRequestVersion || bookId !== getRouteBookId()) return false

    if (cachedCategories.length === 0) {
      cachedCategories = result.data.categories.map((category) => ({
        index: category.index,
        name: category.name,
      }))
      seedFavoriteCategoryCache(authState.memberId, cachedCategories)
    }
    favoriteCategories.value = cachedCategories
    applyGalleryFavoriteState(result.data)
    return true
  } catch (error) {
    if (showError && requestVersion === favoriteRequestVersion) {
      ElMessage.error(error instanceof Error ? error.message : '画册收藏状态获取失败')
    }
    return false
  } finally {
    if (requestVersion === favoriteRequestVersion) favoriteLoading.value = false
  }
}

async function openFavoriteDialog() {
  if (!authState.loggedIn) {
    ElMessage.warning('请先维护认证信息后再收藏画册')
    void router.push('/login')
    return
  }
  if (funcData.loading || pageData.value.bookId !== getRouteBookId()) return

  const ready =
    galleryFavoriteState.value.status !== 'unknown' && favoriteCategories.value.length > 0
      ? true
      : await refreshGalleryFavoriteState(pageData.value.bookId, true)
  if (!ready) return

  selectedFavoriteCategory.value =
    galleryFavoriteState.value.selectedCategoryIndex ?? favoriteCategories.value[0]?.index
  favoriteDialogVisible.value = true
}

async function saveGalleryFavorite() {
  if (selectedFavoriteCategory.value === undefined) {
    ElMessage.warning('请选择收藏分类')
    return
  }
  await updateGalleryFavorite(String(selectedFavoriteCategory.value))
}

async function removeGalleryFavorite() {
  if (!galleryFavoriteState.value.removeValue) {
    ElMessage.error('源站未提供取消收藏操作')
    return
  }
  try {
    await ElMessageBox.confirm('确定取消收藏当前画册吗？', '取消收藏', {
      type: 'warning',
      confirmButtonText: '取消收藏',
      cancelButtonText: '返回',
    })
    await updateGalleryFavorite(galleryFavoriteState.value.removeValue)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error
  }
}

async function updateGalleryFavorite(categoryValue: string) {
  if (favoriteUpdating.value || pageData.value.bookId !== getRouteBookId()) return
  const previousStatus = pageData.value.personalFavoriteStatus
  const bookId = pageData.value.bookId
  const requestVersion = ++favoriteRequestVersion
  favoriteUpdating.value = true
  try {
    const result = await galleryFavoriteBusi.updateGalleryFavorite(
      new galleryFavoriteUpdateInput(
        bookId,
        categoryValue,
        galleryFavoriteState.value.note,
        galleryFavoriteState.value.applyValue,
      ),
    )
    if (requestVersion !== favoriteRequestVersion || bookId !== getRouteBookId()) return
    if (!result.isSuccess || !result.data) throw new Error(result.msg || '画册收藏更新失败')

    applyGalleryFavoriteState(result.data)
    updateFavoriteCount(previousStatus, result.data.status)
    markFavoriteDataChanged()
    favoriteDialogVisible.value = false
    ElMessage.success(result.data.status === 'favorited' ? '收藏已更新' : '已取消收藏')
  } catch (error) {
    if (requestVersion === favoriteRequestVersion) {
      ElMessage.error(error instanceof Error ? error.message : '画册收藏更新失败')
    }
  } finally {
    if (requestVersion === favoriteRequestVersion) favoriteUpdating.value = false
  }
}

function applyGalleryFavoriteState(state: galleryFavoriteStateData) {
  galleryFavoriteState.value = state
  pageData.value.personalFavoriteStatus = state.status
  pageData.value.personalFavoriteCategoryIndex = state.selectedCategoryIndex
  selectedFavoriteCategory.value = state.selectedCategoryIndex ?? favoriteCategories.value[0]?.index
}

function updateFavoriteCount(previous: galleryFavoriteStatus, current: galleryFavoriteStatus) {
  if (previous !== 'favorited' && current === 'favorited') pageData.value.favorited += 1
  if (previous === 'favorited' && current === 'none') {
    pageData.value.favorited = Math.max(0, pageData.value.favorited - 1)
  }
}

async function toRead() {
  router.push({
    name: 'viewerview',
    query: {
      bookId: pageData.value.bookId,
    },
  })
}

function toDownload() {
  router.push({
    name: 'download',
    query: {
      bookId: pageData.value.bookId,
    },
  })
}
</script>
<template>
  <el-skeleton animated v-if="funcData.loading">
    <template #template>
      <div class="bookinfo-skeleton">
        <el-card class="info-card" shadow="never">
          <div class="header-section">
            <div class="cover-container">
              <el-skeleton-item variant="image" class="skeleton-cover" />
            </div>
            <div class="info-container">
              <el-skeleton-item variant="h1" class="skeleton-title" />
              <el-skeleton-item variant="text" class="skeleton-category" />
              <el-skeleton-item variant="text" class="skeleton-rating" />

              <div class="meta-info">
                <el-space wrap :size="16">
                  <el-skeleton-item variant="text" class="skeleton-meta-item" />
                  <el-skeleton-item variant="text" class="skeleton-meta-item" />
                  <el-skeleton-item variant="text" class="skeleton-meta-item" />
                  <el-skeleton-item variant="text" class="skeleton-meta-item" />
                </el-space>
              </div>

              <div class="action-buttons">
                <el-skeleton-item variant="button" class="skeleton-action-btn" />
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="tags-card" shadow="never">
          <div class="card-header">
            <el-skeleton-item variant="text" class="skeleton-card-title" />
          </div>
          <div class="tags-container">
            <el-skeleton-item
              v-for="i in 6"
              :key="`tag-${i}`"
              variant="button"
              class="skeleton-tag"
            />
          </div>
        </el-card>

        <el-card class="comments-card" shadow="never">
          <div class="card-header">
            <el-skeleton-item variant="text" class="skeleton-card-title" />
          </div>
          <div class="comments-container">
            <div v-for="i in 2" :key="`comment-${i}`" class="comment-item skeleton-comment-item">
              <el-skeleton-item variant="text" class="skeleton-comment-user" />
              <el-skeleton-item variant="p" class="skeleton-comment-content" />
            </div>
          </div>
        </el-card>
      </div>
    </template>
  </el-skeleton>
  <div class="bookinfo-view" v-loading="funcData.loading">
    <div class="content-wrapper" v-if="!funcData.loading">
      <!-- 头部信息区 -->
      <el-card class="info-card" shadow="hover">
        <div class="header-section">
          <!-- 左侧封面 -->
          <div class="cover-container">
            <el-image
              :src="pageData.coverImage"
              :zoom-rate="1.2"
              :max-scale="7"
              :min-scale="0.2"
              fit="cover"
              class="cover-image"
              :preview-src-list="[pageData.coverImage]"
            />
          </div>

          <!-- 右侧信息 -->
          <div class="info-container">
            <!-- 标题 -->
            <h1 class="book-title">{{ pageData.bookName }}</h1>

            <!-- 分类标签 -->
            <div class="category-row">
              <CategoryTag :category="pageData.category" />
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
              <span class="rating-count">({{ pageData.ratingCount }} 评分)</span>
            </div>

            <!-- 元数据 -->
            <div class="meta-info">
              <el-space wrap :size="16">
                <div class="meta-item">
                  <el-icon><User /></el-icon>
                  <span>上传者: {{ pageData.uploader }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Clock /></el-icon>
                  <span>{{ formatDate(pageData.publishDate) }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Picture /></el-icon>
                  <span>{{ pageData.imageCount }} 张图片</span>
                </div>
                <div class="meta-item">
                  <el-icon><Download /></el-icon>
                  <span>{{ pageData.totalSize }}</span>
                </div>
                <div class="meta-item" v-if="pageData.language">
                  <el-icon><Reading /></el-icon>
                  <span>{{ pageData.language }}</span>
                </div>
                <div class="meta-item" v-if="pageData.favorited">
                  <el-icon><StarFilled /></el-icon>
                  <span>{{ pageData.favorited }} 收藏</span>
                </div>
              </el-space>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
              <el-button
                class="read-button"
                :class="{ 'has-progress': readingProgress.percent > 0 }"
                :style="{ '--reading-progress': `${readingProgress.percent}%` }"
                type="primary"
                size="large"
                :aria-label="readingProgress.label"
                @click="toRead"
                :loading="funcData.loading"
              >
                <span v-if="readingProgress.percent > 0" class="read-button__liquid" aria-hidden="true">
                  <i v-for="bubble in 5" :key="bubble" class="read-button__bubble" :style="{ '--bubble-index': bubble }" />
                </span>
                <span class="read-button__label"><el-icon><View /></el-icon>{{ readingProgress.label }}</span>
                <span v-if="readingProgress.percent > 0" class="read-button__filled-label" aria-hidden="true">
                  <el-icon><View /></el-icon>{{ readingProgress.label }}
                </span>
              </el-button>
              <div class="secondary-action-buttons">
                <el-tooltip :content="favoriteButtonLabel" placement="bottom">
                  <el-button
                    class="detail-action-button"
                    :class="{ 'is-active': isGalleryFavorited }"
                    :icon="isGalleryFavorited ? StarFilled : Star"
                    circle
                    :loading="favoriteLoading"
                    :aria-label="favoriteButtonLabel"
                    @click="openFavoriteDialog"
                  />
                </el-tooltip>
                <el-tooltip content="分享" placement="bottom" :disabled="shareVisible">
                  <el-button
                    class="detail-action-button"
                    :icon="Share"
                    circle
                    aria-label="分享"
                    @click="openSharePreview"
                  />
                </el-tooltip>
                <el-tooltip content="下载" placement="bottom">
                  <el-button
                    class="detail-action-button"
                    :icon="Download"
                    circle
                    aria-label="下载"
                    @click="toDownload"
                  />
                </el-tooltip>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 标签区 -->
      <el-card class="tags-card" shadow="hover" v-if="tagGroups.length > 0">
        <template #header>
          <div class="card-header">
            <el-icon><Reading /></el-icon>
            <span>标签</span>
          </div>
        </template>
        <div class="tag-groups">
          <section v-for="group in tagGroups" :key="group.collection" class="tag-group">
            <h3 class="tag-group-title">{{ group.displayCollection }}</h3>
            <div class="tags-container">
              <el-tooltip
                v-for="item in group.items"
                :key="item.key"
                :content="item.display.original"
                :disabled="!item.display.translated"
                placement="top"
              >
                <el-tag
                  class="tag-item"
                  :class="item.tag.official ? 'is-official' : 'is-unofficial'"
                  :type="item.tag.official ? 'primary' : 'info'"
                  :effect="item.tag.official ? 'light' : 'plain'"
                  size="large"
                  tabindex="0"
                >
                  <span class="tag-label">{{ item.display.text }}</span>
                </el-tag>
              </el-tooltip>
            </div>
          </section>
        </div>
      </el-card>

      <!-- 评论区 -->
      <el-card
        class="comments-card"
        shadow="hover"
        v-if="pageData.userComments && pageData.userComments.length > 0"
      >
        <template #header>
          <div class="card-header">
            <el-icon><ChatLineRound /></el-icon>
            <span>用户评论 ({{ pageData.userComments.length }})</span>
          </div>
        </template>
        <div class="comments-container">
          <div v-for="(comment, index) in pageData.userComments" :key="index" class="comment-item">
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
            <CommentContent :key="`${pageData.bookId}-${index}`" class="comment-content" :comment="comment" />
          </div>
        </div>
      </el-card>
    </div>
  </div>
  <BookShareOverlay v-model="shareVisible" :book="pageData" :cover-element="shareCoverElement" />
  <el-dialog
    v-model="favoriteDialogVisible"
    class="favorite-dialog"
    :title="isGalleryFavorited ? '管理收藏' : '添加收藏'"
    width="min(460px, calc(100vw - 32px))"
    :close-on-click-modal="!favoriteUpdating"
  >
    <div class="favorite-dialog-content" v-loading="favoriteLoading || favoriteUpdating">
      <p>选择收藏夹</p>
      <el-radio-group v-model="selectedFavoriteCategory" class="favorite-category-grid">
        <el-radio
          v-for="category in favoriteCategories"
          :key="category.index"
          :value="category.index"
          border
        >
          {{ category.name }}
        </el-radio>
      </el-radio-group>
    </div>
    <template #footer>
      <div class="favorite-dialog-actions">
        <el-button
          v-if="isGalleryFavorited"
          type="danger"
          plain
          :disabled="favoriteUpdating"
          @click="removeGalleryFavorite"
        >
          取消收藏
        </el-button>
        <span class="favorite-dialog-actions__spacer"></span>
        <el-button :disabled="favoriteUpdating" @click="favoriteDialogVisible = false">
          返回
        </el-button>
        <el-button type="primary" :loading="favoriteUpdating" @click="saveGalleryFavorite">
          {{ isGalleryFavorited ? '更新分类' : '确认收藏' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.read-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.read-button.has-progress {
  color: #164b78;
  border-color: var(--el-color-primary);
  background: #fff;
}

.read-button__label,
.read-button__filled-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.read-button__label { position: relative; z-index: 1; }

.read-button__filled-label {
  position: absolute;
  inset: 0;
  z-index: 2;
  color: #fff;
  clip-path: inset(0 calc(100% - var(--reading-progress)) 0 0);
  transition: clip-path 900ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: reading-text-reveal 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}

.read-button__liquid {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--reading-progress);
  overflow: hidden;
  background: linear-gradient(110deg, #1765b3, #247aca);
  transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: reading-liquid-enter 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: left;
  pointer-events: none;
}

.read-button__liquid::after {
  position: absolute;
  top: -25%;
  right: -7px;
  width: 12px;
  height: 150%;
  border-radius: 45%;
  background: rgb(255 255 255 / 25%);
  content: '';
  animation: reading-liquid-wave 3s ease-in-out infinite alternate;
}

.read-button__bubble {
  position: absolute;
  left: calc(var(--bubble-index) * 17% - 5%);
  bottom: -10px;
  width: calc(3px + var(--bubble-index) * 1px);
  height: calc(3px + var(--bubble-index) * 1px);
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 50%;
  background: rgb(255 255 255 / 15%);
  animation: reading-bubble-rise calc(2.4s + var(--bubble-index) * 0.3s) linear infinite;
  animation-delay: calc(var(--bubble-index) * -0.7s);
}

.read-button.has-progress:hover,
.read-button.has-progress:focus-visible {
  color: #164b78;
  background: #fff;
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

@keyframes reading-liquid-enter {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes reading-text-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 calc(100% - var(--reading-progress)) 0 0); }
}
@keyframes reading-liquid-wave {
  from { transform: translateY(-3px) rotate(-8deg); }
  to { transform: translateY(3px) rotate(8deg); }
}
@keyframes reading-bubble-rise {
  0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
  20% { opacity: 0.7; }
  100% { transform: translate(5px, -56px) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .read-button__liquid,
  .read-button__liquid::after,
  .read-button__bubble,
  .read-button__filled-label {
    animation: none;
    transition: none;
  }
  .read-button__bubble { display: none; }
}

.bookinfo-view {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
}

.bookinfo-skeleton {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.skeleton-cover {
  width: 100%;
  height: 400px;
  border-radius: 8px;
}

.skeleton-title {
  width: 80%;
  height: 34px;
}

.skeleton-category {
  width: 120px;
}

.skeleton-rating {
  width: 220px;
}

.skeleton-meta-item {
  width: 140px;
}

.skeleton-action-btn {
  width: 140px;
  height: 40px;
}

.skeleton-card-title {
  width: 200px;
}

.skeleton-tag {
  width: 90px;
  height: 32px;
}

.skeleton-comment-item {
  pointer-events: none;
}

.skeleton-comment-user {
  width: 180px;
  margin-bottom: 12px;
}

.skeleton-comment-content {
  width: 100%;
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
  align-items: flex-start;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
}

.secondary-action-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.secondary-action-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

.detail-action-button {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  padding: 0;
  border-radius: 50%;
}

.detail-action-button.is-active {
  border-color: var(--el-color-primary);
  color: #fff;
  background-color: var(--el-color-primary);
}

.favorite-dialog-content > p {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.favorite-category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.favorite-category-grid :deep(.el-radio) {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.favorite-category-grid :deep(.el-radio__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.favorite-dialog-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.favorite-dialog-actions__spacer {
  flex: 1;
}

/* 标签卡片 */
.tags-card,
.comments-card {
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

.tag-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tag-group {
  display: grid;
  grid-template-columns: minmax(96px, 140px) minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.tag-group-title {
  margin: 5px 0 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.tag-item {
  max-width: min(320px, 100%);
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.tag-item :deep(.el-tag__content) {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.tag-label {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-item.is-unofficial {
  border-style: dashed;
  color: var(--el-text-color-secondary);
}

.tag-item:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 2px;
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

  .bookinfo-skeleton {
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

  .skeleton-cover {
    height: 320px;
  }

  .book-title {
    font-size: 22px;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .read-button {
    width: 100%;
  }

  .secondary-action-buttons {
    justify-content: center;
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

  .bookinfo-skeleton {
    padding: 8px;
    gap: 12px;
  }

  .content-wrapper {
    gap: 12px;
  }

  .favorite-category-grid {
    grid-template-columns: 1fr;
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

  .tag-group {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .tag-group-title {
    margin-top: 0;
  }

  .comment-item {
    padding: 12px;
  }
}

/* 深色模式适配 */
html.dark .cover-image {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
