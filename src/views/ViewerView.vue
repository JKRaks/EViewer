<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { bookImageBusi } from '@/core/busi/bookImgBusi'
import { bookImgInput } from '@/core/model/book/bookImgInput'
import { bookInfoBusi } from '@/core/busi/bookInfoBusi'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { Loading, RefreshRight } from '@element-plus/icons-vue'

interface ViewerImageItem {
  key: string
  imageId: string
  url: string
  loading: boolean
  failed: boolean
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
let currentPageQueue: PageImageQueue | null = null
let isViewUnmounted = false

const pageData = reactive({
  loading: true,
  loadingMore: false,
  pageRendering: false,
  pageIndex: 0,
  noMore: false,
})
const bookImages = ref<ViewerImageItem[]>([])

const infiniteScrollDisabled = computed(() => {
  return pageData.loading || pageData.loadingMore || pageData.pageRendering || pageData.noMore
})

onMounted(() => {
  isViewUnmounted = false
  void initialize()
})

onUnmounted(() => {
  isViewUnmounted = true
})

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
    pageData.noMore = false

    bookInfo = await fetchBookInfo(bookId)
    if (!bookInfo?.isSuccess) {
      console.error('获取书籍信息失败:', bookInfo?.msg)
      return
    }

    pageData.pageIndex = bookInfo.pageIndex
    await appendPageInOrder(bookInfo)
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
  const bookBusi = new bookInfoBusi()
  const input = new bookInfoInput()
  input.bookId = currentBookId
  input.page = page
  return await bookBusi.getBookInfo(input)
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

async function appendPageInOrder(current: bookInfoOutput): Promise<void> {
  if (isViewUnmounted) {
    return
  }

  currentPageQueue = {
    bookId: current.bookId,
    pageIndex: current.pageIndex,
    imageIds: getPageImageIds(current),
    nextImageIndex: 0,
  }

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
    const batchImageIds = currentPageQueue.imageIds.slice(batchStart, batchEnd)
    const startIndex = bookImages.value.length

    currentPageQueue.nextImageIndex = batchEnd

    bookImages.value.push(
      ...batchImageIds.map((imageId, index) => ({
        key: `${currentPageQueue?.bookId}-${currentPageQueue?.pageIndex}-${batchStart + index}`,
        imageId,
        url: '',
        loading: false,
        failed: false,
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

      await loadImageItem(target)
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
  target.failed = false
  target.loading = true

  try {
    const input = new bookImgInput()
    input.imageId = target.imageId
    const result = await imageBusi.getBookImage(input)
    if (isViewUnmounted) {
      return
    }

    if (result.isSuccess && result.dataOrDefault) {
      target.url = result.dataOrDefault
    } else {
      target.failed = true
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
  await loadImageItem(image)
}

function handleImageLoadError(image: ViewerImageItem) {
  if (isViewUnmounted) {
    return
  }

  image.url = ''
  image.loading = false
  image.failed = true
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
      <div v-for="image in bookImages" :key="image.key" class="image-block">
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
