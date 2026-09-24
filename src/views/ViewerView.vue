<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { bookImageBusi } from '@/core/books/bookImgBusi'
import { bookImgInput } from '@/core/model/book/bookImgInput'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { Loading, RefreshRight } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'
import {
  cacheImageUrl,
  getBookInfoWithCache,
  getCachedImagePages,
  getCachedImageUrls,
  invalidateCachedImageUrl,
  isCachedImageUrlValid,
  updateImagePageProgress,
} from '@/core/cache/galleryCache'
import type { GalleryImagePageRecord } from '@/core/cache/indexedDb'
import { getReadingHistory, isReadingHistoryEnabled, recordViewedImage } from '@/core/cache/readingHistory'

interface ViewerImageItem {
  key: string
  ordinal: number
  imageId: string
  url: string
  loading: boolean
  rendered: boolean
  failed: boolean
  autoRetryAttempted: boolean
}

interface PageImageQueue {
  bookId: string
  pageIndex: number
  imageIds: string[]
  nextImageIndex: number
}

const imageBatchSize = 4
const route = useRoute()
const bookId = (route.query.bookId ?? route.params.bookId) as string | undefined
const imageBusi = new bookImageBusi()

let bookInfo: bookInfoOutput | null = null
let bookMetadata: bookInfoOutput | null = null
let currentPageQueue: PageImageQueue | null = null
let isViewUnmounted = false
let loadingPrevious = false
let lastMainScrollTop = 0
let scrollRoot: HTMLElement | null = null
let cachedImagePages = new Map<number, GalleryImagePageRecord>()
let cachedImageUrls = new Map<string, string>()

const pageData = reactive({
  loading: true,
  loadingMore: false,
  pageRendering: false,
  pageIndex: 0,
  noMore: false,
})
const bookImages = ref<ViewerImageItem[]>([])
const totalImages = ref(0)
const currentImageOrdinal = ref(0)
const compactProgress = ref(false)
const isSmallPortrait = ref(false)
const progressPercentage = computed(() =>
  totalImages.value ? Math.min(100, Math.round((currentImageOrdinal.value / totalImages.value) * 100)) : 0,
)
const showLineProgress = computed(() => isSmallPortrait.value !== compactProgress.value)
let imageObserver: IntersectionObserver | null = null
let viewportQuery: MediaQueryList | null = null

const infiniteScrollDisabled = computed(() => {
  return pageData.loading || pageData.loadingMore || pageData.pageRendering || pageData.noMore
})

onMounted(() => {
  isViewUnmounted = false
  viewportQuery = window.matchMedia('(max-width: 767px) and (orientation: portrait)')
  isSmallPortrait.value = viewportQuery.matches
  viewportQuery.addEventListener('change', updateViewportMode)
  scrollRoot = document.querySelector<HTMLElement>('.layout-main')
  scrollRoot?.addEventListener('scroll', handleReaderScroll, { passive: true })
  void initialize()
})

onUnmounted(() => {
  isViewUnmounted = true
  imageObserver?.disconnect()
  viewportQuery?.removeEventListener('change', updateViewportMode)
  scrollRoot?.removeEventListener('scroll', handleReaderScroll)
})

watch(currentImageOrdinal, (ordinal) => {
  if (!bookImages.value.some((image) => image.ordinal === ordinal && image.rendered)) return
  persistViewedImage(ordinal)
})

function persistViewedImage(ordinal: number) {
  if (!bookId || !bookMetadata || !ordinal || !isReadingHistoryEnabled()) return
  void recordViewedImage(bookId, ordinal, {
    title: bookMetadata.bookName,
    coverUrl: bookMetadata.coverImage,
    imageCount: totalImages.value,
  })
}

function handleImageRendered(image: ViewerImageItem) {
  image.rendered = true
  if (image.ordinal === currentImageOrdinal.value) persistViewedImage(image.ordinal)
}

watch(() => bookImages.value.length, () => void observeVisibleImages(), { flush: 'post' })

function updateViewportMode() {
  isSmallPortrait.value = viewportQuery?.matches ?? false
}

async function observeVisibleImages() {
  await nextTick()
  if (isViewUnmounted) return
  imageObserver?.disconnect()
  const scrollRoot = document.querySelector<HTMLElement>('.layout-main')
  if (!scrollRoot) return
  imageObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (!visible.length) return
      const center = scrollRoot.getBoundingClientRect().top + scrollRoot.clientHeight / 2
      visible.sort((left, right) =>
        Math.abs(left.boundingClientRect.top + left.boundingClientRect.height / 2 - center) -
        Math.abs(right.boundingClientRect.top + right.boundingClientRect.height / 2 - center),
      )
      const ordinal = Number((visible[0]?.target as HTMLElement | undefined)?.dataset.ordinal)
      if (Number.isFinite(ordinal) && ordinal > 0) currentImageOrdinal.value = ordinal
    },
    { root: scrollRoot, rootMargin: '-35% 0px -35% 0px' },
  )
  document.querySelectorAll<HTMLElement>('.viewer-view .image-block[data-ordinal]').forEach((node) =>
    imageObserver?.observe(node),
  )
}

async function initialize() {
  if (!bookId) {
    console.error('没有书籍信息')
    pageData.loading = false
    return
  }

  try {
    pageData.loading = true
    bookImages.value = []
    currentPageQueue = null
    cachedImagePages = new Map()
    cachedImageUrls = new Map()
    pageData.noMore = false
    currentImageOrdinal.value = 0

    const [cachedPages, cachedUrls] = await Promise.all([
      getCachedImagePages(bookId),
      getCachedImageUrls(bookId),
    ])
    cachedImagePages = new Map(cachedPages.map((page) => [page.pageIndex, page]))
    cachedImageUrls = cachedUrls

    const firstPage = await fetchBookInfo(bookId)
    if (!firstPage.isSuccess || isViewUnmounted) {
      console.error('获取书籍信息失败:', firstPage.msg)
      return
    }
    bookMetadata = firstPage
    if (!firstPage.imageCount) {
      const detail = await getBookInfoWithCache(Object.assign(new bookInfoInput(), { bookId, page: 0 }), 'detail')
      if (detail.isSuccess) bookMetadata = detail
    }
    totalImages.value = bookMetadata.imageCount

    const history = await getReadingHistory(bookId)
    let resumeOrdinal = 1
    if (history?.lastOrdinal && history.lastOrdinal <= totalImages.value && route.query.reading !== 'start') {
      if (route.query.reading === 'continue') {
        resumeOrdinal = history.lastOrdinal
      } else {
        try {
          await ElMessageBox.confirm(
            `上次看到第 ${history.lastOrdinal} 张，继续阅读吗？`,
            '继续阅读',
            { confirmButtonText: '继续阅读', cancelButtonText: '从头阅读', showClose: false },
          )
          resumeOrdinal = history.lastOrdinal
        } catch {
          resumeOrdinal = 1
        }
      }
    }
    if (isViewUnmounted) return
    const targetPage = Math.floor((resumeOrdinal - 1) / 20)
    bookInfo = targetPage ? await fetchBookInfo(bookId, targetPage) : firstPage
    if (!bookInfo.isSuccess || isViewUnmounted) throw new Error(bookInfo.msg || '加载阅读位置失败')
    pageData.pageIndex = bookInfo.pageIndex
    await appendPageInOrder(bookInfo, (resumeOrdinal - 1) % 20)
  } catch (error) {
    console.error('初始化阅读页失败:', error)
  } finally {
    if (!isViewUnmounted) {
      pageData.loading = false
      refreshNoMoreState()
    }
  }
}

async function fetchBookInfo(currentBookId: string, page = 0): Promise<bookInfoOutput> {
  const input = new bookInfoInput()
  input.bookId = currentBookId
  input.page = page
  return await getBookInfoWithCache(input, 'viewer')
}

async function loadMorePic() {
  if (infiniteScrollDisabled.value) {
    return
  }

  try {
    if (isViewUnmounted) {
      return
    }

    pageData.loadingMore = true

    if (hasPendingCurrentPageImages()) {
      await loadNextImageBatch()
      return
    }

    const current = await loadNextPage()
    if (isViewUnmounted) {
      return
    }

    if (current.isSuccess) {
      await appendPageInOrder(current)
    } else {
      console.warn('没有更多图片了')
    }
  } catch (error) {
    console.error('加载更多图片失败:', error)
  } finally {
    if (!isViewUnmounted) {
      pageData.loadingMore = false
      refreshNoMoreState()
    }
  }
}

function handleReaderScroll() {
  if (!scrollRoot || isViewUnmounted) return
  const position = scrollRoot.scrollTop
  if (position < lastMainScrollTop && position < 180 && (bookImages.value[0]?.ordinal ?? 1) > 1) {
    void loadPreviousImages()
  }
  lastMainScrollTop = position
}

async function loadPreviousImages() {
  if (!bookId || loadingPrevious || isViewUnmounted || !scrollRoot) return
  const first = bookImages.value[0]
  if (!first || first.ordinal <= 1) return
  loadingPrevious = true
  const anchor = document.querySelector<HTMLElement>(`.viewer-view .image-block[data-ordinal="${first.ordinal}"]`)
  const anchorTop = anchor?.getBoundingClientRect().top ?? 0
  try {
    const previousOrdinal = first.ordinal - 1
    const pageIndex = Math.floor((previousOrdinal - 1) / 20)
    const page = await fetchBookInfo(bookId, pageIndex)
    if (!page.isSuccess || isViewUnmounted) throw new Error(page.msg || '加载前面的图片失败')
    const ids = getPageImageIds(page)
    const end = (previousOrdinal - 1) % 20 + 1
    const start = Math.max(0, end - imageBatchSize)
    const previousItems: ViewerImageItem[] = ids.slice(start, end).map((imageId, index) => ({
      key: `${bookId}-${pageIndex}-${start + index}`,
      ordinal: pageIndex * 20 + start + index + 1,
      imageId,
      url: getReusableCachedImageUrl(imageId),
      loading: false,
      rendered: false,
      failed: false,
      autoRetryAttempted: false,
    }))
    for (const item of previousItems) {
      if (!item.url) await loadImageItem(item)
      if (isViewUnmounted) return
    }
    bookImages.value.unshift(...previousItems)
    await nextTick()
    if (anchor && scrollRoot) scrollRoot.scrollTop += anchor.getBoundingClientRect().top - anchorTop
  } catch (error) {
    console.error('向上加载图片失败:', error)
  } finally {
    loadingPrevious = false
  }
}

async function appendPageInOrder(current: bookInfoOutput, startImageIndex = 0): Promise<void> {
  if (isViewUnmounted) {
    return
  }

  const imageIds = getPageImageIds(current)
  const cachedPage = cachedImagePages.get(current.pageIndex)
  const sameCachedPage =
    cachedPage?.imageIds.length === imageIds.length &&
    cachedPage.imageIds.every((imageId, index) => imageId === imageIds[index])
  const cachedAttemptedImageCount = sameCachedPage
    ? Math.min(cachedPage.nextImageIndex, imageIds.length)
    : 0
  const firstInvalidCachedIndex = imageIds
    .slice(0, cachedAttemptedImageCount)
    .findIndex((imageId) => !getReusableCachedImageUrl(imageId))
  const attemptedImageCount = Math.max(
    startImageIndex,
    firstInvalidCachedIndex === -1 ? cachedAttemptedImageCount : firstInvalidCachedIndex,
  )

  currentPageQueue = {
    bookId: current.bookId,
    pageIndex: current.pageIndex,
    imageIds,
    nextImageIndex: attemptedImageCount,
  }

  bookImages.value.push(
    ...imageIds.slice(startImageIndex, attemptedImageCount).map((imageId, index) => {
      const url = getReusableCachedImageUrl(imageId)
      return {
        key: `${current.bookId}-${current.pageIndex}-${startImageIndex + index}`,
        ordinal: current.pageIndex * 20 + startImageIndex + index + 1,
        imageId,
        url,
        loading: false,
        rendered: false,
        failed: !url,
        autoRetryAttempted: false,
      }
    }),
  )

  if (!hasPendingCurrentPageImages()) {
    refreshNoMoreState()
    return
  }

  await loadNextImageBatch()
}

async function loadNextImageBatch(): Promise<void> {
  if (!currentPageQueue || !hasPendingCurrentPageImages() || isViewUnmounted) {
    return
  }

  pageData.pageRendering = true

  try {
    const batchStart = currentPageQueue.nextImageIndex
    const batchEnd = Math.min(batchStart + imageBatchSize, currentPageQueue.imageIds.length)
    const queue = currentPageQueue
    const batchImageIds = queue.imageIds.slice(batchStart, batchEnd)
    const startIndex = bookImages.value.length

    bookImages.value.push(
      ...batchImageIds.map((imageId, index) => ({
        key: `${queue.bookId}-${queue.pageIndex}-${batchStart + index}`,
        ordinal: queue.pageIndex * 20 + batchStart + index + 1,
        imageId,
        url: getReusableCachedImageUrl(imageId),
        loading: false,
        rendered: false,
        failed: false,
        autoRetryAttempted: false,
      })),
    )

    for (let currentIndex = 0; currentIndex < batchImageIds.length; currentIndex++) {
      if (isViewUnmounted) {
        return
      }

      const target = bookImages.value[startIndex + currentIndex]
      if (!target) {
        continue
      }

      if (!target.url) {
        await loadImageItem(target)
      }

      queue.nextImageIndex = batchStart + currentIndex + 1
      await updateImagePageProgress(queue.bookId, queue.pageIndex, queue.nextImageIndex)
      if (isViewUnmounted) {
        return
      }
    }
  } finally {
    if (!isViewUnmounted) {
      pageData.pageRendering = false
      refreshNoMoreState()
    }
  }
}

async function loadImageItem(target: ViewerImageItem): Promise<void> {
  if (isViewUnmounted || target.loading) {
    return
  }

  target.url = ''
  target.rendered = false
  target.failed = false
  target.loading = true

  try {
    const input = new bookImgInput()
    input.imageId = target.imageId
    const result = await imageBusi.getBookImage(input)
    if (result.isSuccess && result.dataOrDefault) {
      const url = result.dataOrDefault
      await cacheImageUrl(bookId ?? '', target.imageId, url)
      cachedImageUrls.set(target.imageId, url)
      if (!isViewUnmounted) {
        target.url = url
      }
    } else {
      if (!isViewUnmounted) {
        target.failed = true
      }
    }
  } catch (error) {
    console.error(`加载图片失败: ${target.imageId}`, error)
    target.failed = true
  } finally {
    if (!isViewUnmounted) {
      target.loading = false
    }
  }
}

async function retryImage(image: ViewerImageItem) {
  image.autoRetryAttempted = false
  await loadImageItem(image)
}

async function handleImageLoadError(image: ViewerImageItem) {
  if (isViewUnmounted || image.loading) {
    return
  }

  const shouldAutoRetry = !image.autoRetryAttempted
  image.autoRetryAttempted = true
  image.url = ''
  image.rendered = false
  image.loading = shouldAutoRetry
  image.failed = !shouldAutoRetry
  cachedImageUrls.delete(image.imageId)
  await invalidateCachedImageUrl(bookId ?? '', image.imageId)

  if (shouldAutoRetry && !isViewUnmounted) {
    image.loading = false
    await loadImageItem(image)
  }
}

function getReusableCachedImageUrl(imageId: string): string {
  const url = cachedImageUrls.get(imageId) ?? ''
  if (!url || isCachedImageUrlValid(url)) return url

  cachedImageUrls.delete(imageId)
  void invalidateCachedImageUrl(bookId ?? '', imageId)
  return ''
}

async function loadNextPage(): Promise<bookInfoOutput> {
  if (!bookInfo) {
    return createFailedBookInfo('没有书籍信息')
  }

  if (isLastLoadedPage()) {
    pageData.noMore = true
    return createFailedBookInfo('没有下一页了')
  }

  const nextPageInfo = await fetchBookInfo(bookInfo.bookId, pageData.pageIndex + 1)
  if (nextPageInfo.isSuccess) {
    pageData.pageIndex = nextPageInfo.pageIndex
    bookInfo = nextPageInfo
  }

  return nextPageInfo
}

function getPageImageIds(current: bookInfoOutput): string[] {
  return Array.isArray(current.data) ? current.data : []
}

function hasPendingCurrentPageImages(): boolean {
  return Boolean(
    currentPageQueue && currentPageQueue.nextImageIndex < currentPageQueue.imageIds.length,
  )
}

function isLastLoadedPage(): boolean {
  return Boolean(bookInfo && bookInfo.lastPageIndex - 1 <= pageData.pageIndex)
}

function refreshNoMoreState() {
  pageData.noMore = !hasPendingCurrentPageImages() && isLastLoadedPage()
}

function createFailedBookInfo(msg: string): bookInfoOutput {
  return {
    isSuccess: false,
    msg,
  } as bookInfoOutput
}
</script>

<template>
  <div
    v-infinite-scroll="loadMorePic"
    class="viewer-view"
    :infinite-scroll-disabled="infiniteScrollDisabled"
    :infinite-scroll-distance="300"
    :infinite-scroll-delay="200"
    :infinite-scroll-immediate="true"
  >
    <div v-if="pageData.loading && bookImages.length === 0" class="viewer-skeleton">
      <el-skeleton v-for="index in 3" :key="index" animated class="image-skeleton">
        <template #template>
          <el-skeleton-item variant="image" class="image-skeleton__media" />
        </template>
      </el-skeleton>
    </div>

    <div v-else class="image-list">
      <div v-for="image in bookImages" :key="image.key" class="image-block" :data-ordinal="image.ordinal">
        <el-skeleton :loading="image.loading" animated class="image-skeleton">
          <template #template>
            <el-skeleton-item variant="image" class="image-skeleton__media" />
          </template>
          <template #default>
            <el-image
              v-if="image.url"
              :src="image.url"
              class="reader-image"
              lazy
              @load="handleImageRendered(image)"
              @error="handleImageLoadError(image)"
            />
            <button
              v-else-if="image.failed"
              type="button"
              class="image-error"
              @click="retryImage(image)"
            >
              <el-icon>
                <RefreshRight />
              </el-icon>
              <span>图片加载失败，点击重试</span>
            </button>
          </template>
        </el-skeleton>
      </div>
    </div>

    <div v-if="pageData.loadingMore" class="load-state">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>加载更多中...</span>
    </div>

    <div v-else-if="pageData.noMore && bookImages.length > 0" class="load-state">
      没有更多图片了
    </div>

    <button
      v-if="totalImages && currentImageOrdinal"
      type="button"
      class="reader-progress"
      :class="{ 'reader-progress--line': showLineProgress }"
      :aria-label="`阅读进度 ${currentImageOrdinal} / ${totalImages}，点击切换样式`"
      @click="compactProgress = !compactProgress"
    >
      <template v-if="showLineProgress">
        <span class="reader-progress__count">{{ currentImageOrdinal }}/{{ totalImages }}</span>
        <el-progress :percentage="progressPercentage" :show-text="false" :stroke-width="7" />
      </template>
      <el-progress v-else type="dashboard" :percentage="progressPercentage" :width="112" :stroke-width="9" />
    </button>
  </div>
</template>

<style scoped>
.viewer-view {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}

.viewer-skeleton,
.image-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-block {
  width: 100%;
}

.image-skeleton {
  width: 100%;
}

.image-skeleton__media,
.reader-image,
.image-error {
  width: 100%;
  min-height: 320px;
  border-radius: 12px;
}

.reader-image {
  display: block;
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--el-border-color);
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font: inherit;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background-color 0.2s ease;
}

.image-error:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0 8px;
  color: var(--el-text-color-secondary);
}

.reader-progress {
  position: fixed;
  bottom: calc(18px + env(safe-area-inset-bottom));
  left: calc(14px + env(safe-area-inset-left));
  z-index: 1500;
  display: grid;
  place-items: center;
  width: 136px;
  height: 112px;
  padding: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-bg-color-overlay) 72%, transparent);
  backdrop-filter: blur(12px);
  cursor: pointer;
}

.reader-progress--line {
  left: calc(48px + env(safe-area-inset-left));
  display: flex;
  width: clamp(88px, 16.67dvh, 150px);
  height: 34px;
  flex-direction: row-reverse;
  gap: 5px;
  transform: rotate(-90deg);
  transform-origin: left bottom;
}

.reader-progress--line :deep(.el-progress) {
  flex: 1;
  min-width: 0;
}

.reader-progress__count {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .viewer-skeleton,
  .image-list {
    gap: 12px;
  }

  .image-skeleton__media,
  .reader-image,
  .image-error {
    min-height: 240px;
    border-radius: 8px;
  }
}
</style>
