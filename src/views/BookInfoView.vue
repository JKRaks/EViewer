<script lang="ts" setup>
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t, getDisplayLocale } from '@/i18n'

import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import SkeletonLine from '@/components/primitives/SkeletonLine.vue'
import MediaImage from '@/components/primitives/MediaImage.vue'
import Rating from '@/components/primitives/Rating.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Hint from '@/components/primitives/Hint.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import AvatarMark from '@/components/primitives/AvatarMark.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
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
import { useRoute, useRouter } from 'vue-router'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { getBookInfoWithCache } from '@/core/cache/galleryCache'
import { getReadingHistory, isReadingHistoryEnabled } from '@/core/cache/readingHistory'
import type { ReadingHistoryRecord } from '@/core/cache/indexedDb'
import CategoryTag from '@/components/CategoryTag.vue'
import GalleryTagPopover from '@/components/GalleryTagPopover.vue'
import BookShareOverlay from '@/components/BookShareOverlay.vue'
import CommentContent from '@/components/CommentContent.vue'
import {
  Image as Picture,
  Clock,
  User,
  BookOpen as Reading,
  Eye as View,
  Download,
  MessageCircle as ChatLineRound,
  Star,
  Star as StarFilled,
  Share2 as Share,
} from '@lucide/vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import { useLayoutMainScrollMemory } from '@/composables/useLayoutMainScrollMemory'
import { getTagCollectionDisplayName } from '@/core/common/tagTranslations'
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
const router = useRouter()
const funcData = reactive({
  loading: true,
  readMode: false,
})
useAppLaunchReadiness(() => funcData.loading)
const pageData = ref(new bookInfoOutput())
const readingHistory = ref<ReadingHistoryRecord>()
let readingRequestVersion = 0
const readingProgress = computed(() => {
  const total = Number(pageData.value.imageCount)
  const record = readingHistory.value
  if (!isReadingHistoryEnabled() || !record || total <= 0 || !Number.isFinite(total)) {
    return { label: t('开始阅读'), percent: 0 }
  }
  const count = new Set(
    record.viewedOrdinals.filter(
      (ordinal) => Number.isInteger(ordinal) && ordinal > 0 && ordinal <= total,
    ),
  ).size
  const percent = (count / total) * 100
  return {
    label:
      count === 0
        ? t('开始阅读')
        : count === total
          ? t('已读完')
          : t('{p0}% · {p1}/{p2} 张', {
              p0: Math.min(99, Math.floor(percent)),
              p1: count,
              p2: total,
            }),
    percent,
  }
})

async function refreshReadingProgress() {
  const bookId = getRouteBookId()
  const version = ++readingRequestVersion
  readingHistory.value = undefined
  if (!bookId) return
  const record = await getReadingHistory(bookId)
  if (version === readingRequestVersion && getRouteBookId() === bookId)
    readingHistory.value = record
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
  if (!authState.loggedIn) return t('登录后收藏')
  if (favoriteLoading.value) return t('正在读取收藏状态')
  return isGalleryFavorited.value ? t('管理收藏') : t('添加收藏')
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
      })),
    }))
})

// 格式化日期
const formatDate = (date: Date | undefined) => {
  if (!date) return t('未知')
  return new Date(date).toLocaleDateString(getDisplayLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 格式化评论日期时间
const formatCommentDate = (dateStr: string | Date | undefined) => {
  if (!dateStr) return t('未知时间')

  // 使用正则匹配 "Posted on 26 October 2025, 08:31 by:" 格式
  const dateMatch = String(dateStr).match(/(?<=Posted on )\d{1,2} \w+ \d{4}, \d{2}:\d{2}(?= by:)/)
  if (dateMatch) {
    return dateMatch[0]
  }

  // 如果是 Date 对象,使用标准格式化
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    return date.toLocaleString(getDisplayLocale())
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

watch(
  () => route.query.favorite,
  () => consumeFavoriteIntent(),
)

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
    console.error(t('获取书籍信息失败:'), error)
  } finally {
    if (requestVersion === bookRequestVersion) {
      loadingBookId = ''
      funcData.loading = false
      consumeFavoriteIntent()
    }
  }
}

function consumeFavoriteIntent() {
  if (
    route.query.favorite !== '1' ||
    funcData.loading ||
    pageData.value.bookId !== getRouteBookId()
  )
    return
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
    console.warn(t('读取收藏分类缓存失败，使用画册弹窗分类:'), error)
    return []
  })
  try {
    const result = await galleryFavoriteBusi.getGalleryFavoriteState(
      new galleryFavoriteInput(bookId),
    )
    if (requestVersion !== favoriteRequestVersion || bookId !== getRouteBookId()) return false
    if (result.authenticationRequired) throw new Error(result.msg)
    if (!result.isSuccess || !result.data) {
      throw new Error(result.msg || t('画册收藏状态获取失败'))
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
      notify.error(error instanceof Error ? error.message : t('画册收藏状态获取失败'))
    }
    return false
  } finally {
    if (requestVersion === favoriteRequestVersion) favoriteLoading.value = false
  }
}

async function openFavoriteDialog() {
  if (!authState.loggedIn) {
    notify.warning(t('请先维护认证信息后再收藏画册'))
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
    notify.warning(t('请选择收藏分类'))
    return
  }
  await updateGalleryFavorite(String(selectedFavoriteCategory.value))
}

async function removeGalleryFavorite() {
  if (!galleryFavoriteState.value.removeValue) {
    notify.error(t('源站未提供取消收藏操作'))
    return
  }
  try {
    await dialogs.confirm(t('确定取消收藏当前画册吗？'), t('取消收藏'), {
      type: 'warning',
      confirmButtonText: t('取消收藏'),
      cancelButtonText: t('返回'),
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
    if (!result.isSuccess || !result.data) throw new Error(result.msg || t('画册收藏更新失败'))

    applyGalleryFavoriteState(result.data)
    updateFavoriteCount(previousStatus, result.data.status)
    markFavoriteDataChanged()
    favoriteDialogVisible.value = false
    notify.success(result.data.status === 'favorited' ? t('收藏已更新') : t('已取消收藏'))
  } catch (error) {
    if (requestVersion === favoriteRequestVersion) {
      notify.error(error instanceof Error ? error.message : t('画册收藏更新失败'))
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
  <SkeletonBlock v-if="funcData.loading">
    <template #template>
      <div class="bookinfo-skeleton">
        <section class="info-card">
          <div class="header-section">
            <div class="cover-container">
              <SkeletonLine variant="image" class="skeleton-cover" />
            </div>
            <div class="info-container">
              <SkeletonLine variant="h1" class="skeleton-title" />
              <SkeletonLine variant="text" class="skeleton-category" />
              <SkeletonLine variant="text" class="skeleton-rating" />

              <div class="meta-info">
                <div class="inline-space">
                  <SkeletonLine variant="text" class="skeleton-meta-item" />
                  <SkeletonLine variant="text" class="skeleton-meta-item" />
                  <SkeletonLine variant="text" class="skeleton-meta-item" />
                  <SkeletonLine variant="text" class="skeleton-meta-item" />
                </div>
              </div>

              <div class="action-buttons">
                <SkeletonLine variant="button" class="skeleton-action-btn" />
              </div>
            </div>
          </div>
        </section>

        <section class="tags-card">
          <div class="card-header">
            <SkeletonLine variant="text" class="skeleton-card-title" />
          </div>
          <div class="tags-container">
            <SkeletonLine v-for="i in 6" :key="`tag-${i}`" variant="button" class="skeleton-tag" />
          </div>
        </section>

        <section class="comments-card">
          <div class="card-header">
            <SkeletonLine variant="text" class="skeleton-card-title" />
          </div>
          <div class="comments-container">
            <div v-for="i in 2" :key="`comment-${i}`" class="comment-item skeleton-comment-item">
              <SkeletonLine variant="text" class="skeleton-comment-user" />
              <SkeletonLine variant="p" class="skeleton-comment-content" />
            </div>
          </div>
        </section>
      </div>
    </template>
  </SkeletonBlock>
  <div class="bookinfo-view" v-busy="funcData.loading">
    <div class="content-wrapper" v-if="!funcData.loading">
      <!-- 头部信息区 -->
      <section class="info-card">
        <div class="header-section">
          <!-- 左侧封面 -->
          <div class="cover-container">
            <MediaImage
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
              <Rating
                v-model="ratingStars"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value}"
              />
              <span class="rating-count">{{ t('({p0} 评分)', { p0: pageData.ratingCount }) }}</span>
            </div>

            <!-- 元数据 -->
            <div class="meta-info">
              <div class="inline-space">
                <div class="meta-item">
                  <IconFrame><User /></IconFrame>
                  <span>{{ t('上传者: {p0}', { p0: pageData.uploader }) }}</span>
                </div>
                <div class="meta-item">
                  <IconFrame><Clock /></IconFrame>
                  <span>{{ formatDate(pageData.publishDate) }}</span>
                </div>
                <div class="meta-item">
                  <IconFrame><Picture /></IconFrame>
                  <span>{{ t('{p0} 张图片', { p0: pageData.imageCount }) }}</span>
                </div>
                <div class="meta-item">
                  <IconFrame><Download /></IconFrame>
                  <span>{{ pageData.totalSize }}</span>
                </div>
                <div class="meta-item" v-if="pageData.language">
                  <IconFrame><Reading /></IconFrame>
                  <span>{{ pageData.language }}</span>
                </div>
                <div class="meta-item" v-if="pageData.favorited">
                  <IconFrame><StarFilled /></IconFrame>
                  <span>{{ t('{p0} 收藏', { p0: pageData.favorited }) }}</span>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
              <ActionButton
                class="read-button"
                :class="{ 'has-progress': readingProgress.percent > 0 }"
                :style="{ '--reading-progress': `${readingProgress.percent}%` }"
                variant="default"
                size="lg"
                :aria-label="t(readingProgress.label)"
                @click="toRead"
                :loading="funcData.loading"
              >
                <span
                  v-if="readingProgress.percent > 0"
                  class="read-button__liquid"
                  aria-hidden="true"
                />
                <span class="read-button__label"
                  ><IconFrame><View /></IconFrame>{{ t(readingProgress.label) }}</span
                >
                <span
                  v-if="readingProgress.percent > 0"
                  class="read-button__filled-label"
                  aria-hidden="true"
                >
                  <IconFrame><View /></IconFrame>{{ t(readingProgress.label) }}
                </span>
              </ActionButton>
              <div class="secondary-action-buttons">
                <Hint :content="t(favoriteButtonLabel)" placement="bottom">
                  <ActionButton
                    class="detail-action-button"
                    :class="{ 'is-active': isGalleryFavorited }"
                    :icon="isGalleryFavorited ? StarFilled : Star"
                    size="icon"
                    :loading="favoriteLoading"
                    :aria-label="t(favoriteButtonLabel)"
                    @click="openFavoriteDialog"
                  />
                </Hint>
                <Hint :content="t('分享')" placement="bottom" :disabled="shareVisible">
                  <ActionButton
                    class="detail-action-button"
                    :icon="Share"
                    size="icon"
                    :aria-label="t('分享')"
                    @click="openSharePreview"
                  />
                </Hint>
                <Hint :content="t('下载')" placement="bottom">
                  <ActionButton
                    class="detail-action-button"
                    :icon="Download"
                    size="icon"
                    :aria-label="t('下载')"
                    @click="toDownload"
                  />
                </Hint>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 标签区 -->
      <section class="tags-card" v-if="tagGroups.length > 0">
        <header class="section-header">
          <div class="card-header">
            <IconFrame><Reading /></IconFrame>
            <span>{{ t('标签') }}</span>
          </div>
        </header>
        <div class="tag-groups">
          <section v-for="group in tagGroups" :key="group.collection" class="tag-group">
            <h3 class="tag-group-title">{{ group.displayCollection }}</h3>
            <div class="tags-container">
              <GalleryTagPopover
                v-for="item in group.items"
                :key="item.key"
                :namespace="group.collection"
                :tag="item.tag"
              />
            </div>
          </section>
        </div>
      </section>

      <!-- 评论区 -->
      <section
        class="comments-card"
        v-if="pageData.userComments && pageData.userComments.length > 0"
      >
        <header class="section-header">
          <div class="card-header">
            <IconFrame><ChatLineRound /></IconFrame>
            <span>{{ t('用户评论 ({p0})', { p0: pageData.userComments.length }) }}</span>
          </div>
        </header>
        <div class="comments-container">
          <div v-for="(comment, index) in pageData.userComments" :key="index" class="comment-item">
            <div class="comment-header">
              <div class="comment-user">
                <AvatarMark :size="40" :icon="User" />
                <div class="user-info">
                  <div class="username">
                    {{ comment.username }}
                    <TagChip v-if="comment.isUploader" tone="success" size="small" effect="dark">{{
                      t('上传者')
                    }}</TagChip>
                  </div>
                  <div class="comment-date">{{ formatCommentDate(comment.date) }}</div>
                </div>
              </div>
              <Rating v-if="comment.score > 0" :model-value="comment.score" disabled size="small" />
            </div>
            <CommentContent
              :key="`${pageData.bookId}-${index}`"
              class="comment-content"
              :comment="comment"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
  <BookShareOverlay v-model="shareVisible" :book="pageData" :cover-element="shareCoverElement" />
  <ModalPanel
    v-model="favoriteDialogVisible"
    class="favorite-dialog"
    :title="isGalleryFavorited ? t('管理收藏') : t('添加收藏')"
    width="min(460px, calc(100vw - 32px))"
    :dismissible="!favoriteUpdating"
  >
    <div class="favorite-dialog-content" v-busy="favoriteLoading || favoriteUpdating">
      <p>{{ t('选择收藏夹') }}</p>
      <ChoiceGroup v-model="selectedFavoriteCategory" class="favorite-category-grid">
        <RadioChoice
          v-for="category in favoriteCategories"
          :key="category.index"
          :value="category.index"
          border
        >
          {{ category.name }}
        </RadioChoice>
      </ChoiceGroup>
    </div>
    <template #footer>
      <div class="favorite-dialog-actions">
        <ActionButton
          v-if="isGalleryFavorited"
          variant="destructive"
          :disabled="favoriteUpdating"
          @click="removeGalleryFavorite"
          >{{ t('取消收藏') }}</ActionButton
        >
        <span class="favorite-dialog-actions__spacer"></span>
        <ActionButton :disabled="favoriteUpdating" @click="favoriteDialogVisible = false">{{
          t('返回')
        }}</ActionButton>
        <ActionButton variant="default" :loading="favoriteUpdating" @click="saveGalleryFavorite">
          {{ isGalleryFavorited ? t('更新分类') : t('确认收藏') }}
        </ActionButton>
      </div>
    </template>
  </ModalPanel>
</template>

<style scoped>
.read-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.read-button.has-progress {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--surface);
}

.read-button__label,
.read-button__filled-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.read-button__label {
  position: relative;
  z-index: 1;
}

.read-button__filled-label {
  position: absolute;
  inset: 0;
  z-index: 2;
  color: var(--accent-foreground);
  clip-path: inset(0 calc(100% - var(--reading-progress)) 0 0);
  transition: clip-path 220ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: reading-text-reveal 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}

.read-button__liquid {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--reading-progress);
  overflow: hidden;
  background: linear-gradient(110deg, var(--accent-strong), var(--accent));
  transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: reading-liquid-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
}

.read-button.has-progress:hover,
.read-button.has-progress:focus-visible {
  color: var(--accent);
  background: var(--surface);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

@keyframes reading-liquid-enter {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes reading-text-reveal {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 calc(100% - var(--reading-progress)) 0 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .read-button__liquid,
  .read-button__liquid::after,
  .read-button__filled-label {
    animation: none;
    transition: none;
  }
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
  background-color: var(--muted);
  color: var(--muted-foreground);
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
  color: var(--foreground);
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
  color: var(--muted-foreground);
  font-size: 14px;
}

/* 元数据 */
.meta-info {
  padding: 16px;
  background-color: var(--muted-soft);
  border-radius: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 14px;
}

.meta-item .ui-icon {
  color: var(--accent);
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

.secondary-action-buttons :deep(.ui-button + .ui-button) {
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
  border-color: var(--accent);
  color: var(--accent-foreground);
  background-color: var(--accent);
}

.favorite-dialog-content > p {
  margin: 0 0 12px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.favorite-category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.favorite-category-grid :deep(.ui-radio) {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.favorite-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.favorite-dialog-actions :deep(.ui-button + .ui-button) {
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

.card-header .ui-icon {
  color: var(--accent);
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
  color: var(--text);
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

/* 评论区 */
.comments-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comment-item {
  padding: 16px;
  background-color: var(--muted-soft);
  border-radius: 8px;
  transition: background-color 0.3s;
}

.comment-item:hover {
  background-color: var(--muted);
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
  color: var(--foreground);
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-date {
  font-size: 13px;
  color: var(--muted-foreground);
}

.comment-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
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
