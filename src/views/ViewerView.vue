<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { bookImageBusi } from '@/core/busi/bookImgBusi'
import { bookImgInput } from '@/core/model/book/bookImgInput'
import { bookInfoBusi } from '@/core/busi/bookInfoBusi'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { Loading } from '@element-plus/icons-vue'

interface ViewerImageItem {
  key: string
  url: string
  loading: boolean
  failed: boolean
}

const route = useRoute()
const bookId = (route.query.bookId ?? route.params.bookId) as string | undefined
let bookInfo: bookInfoOutput | null = null
let observer: IntersectionObserver | null = null

const pageData = reactive({
  loading: true,
  loadingMore: false,
  pageRendering: false,
  pageIndex: 0,
  noMore: false,
})
const bookImages = ref<ViewerImageItem[]>([])
const loadMoreTrigger = ref<HTMLElement | null>(null)

onMounted(() => {
  void nextTick(() => {
    setupObserver()
  })
  void initialize()
})

onUnmounted(() => {
  observer?.disconnect()
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
    bookInfo = await fetchBookInfo(bookId)
    if (!bookInfo?.isSuccess) {
      console.error('获取书籍信息失败:', bookInfo?.msg)
      return
    }

    pageData.pageIndex = bookInfo.pageIndex
    pageData.noMore = bookInfo.lastPageIndex - 1 <= bookInfo.pageIndex
    await appendPageInOrder(bookInfo)
  } catch (error) {
    console.error('初始化阅读页失败:', error)
  } finally {
    pageData.loading = false
  }
}

async function fetchBookInfo(currentBookId: string, page = 0): Promise<bookInfoOutput> {
  const bookBusi = new bookInfoBusi()
  const input = new bookInfoInput()
  input.bookId = currentBookId
  input.page = page
  return await bookBusi.getBookInfo(input)
}

/**
 * 加载更多图片
 */
async function loadMorePic() {
  if (pageData.loading || pageData.loadingMore || pageData.pageRendering || pageData.noMore) {
    return
  }

  try {
    pageData.loadingMore = true
    const current = await loadNextPage()
    if (current.isSuccess && current.dataOrDefault) {
      await appendPageInOrder(current)
    } else {
      pageData.noMore = true
      console.warn('没有更多图片了')
    }
  } catch (error) {
    console.error('加载更多图片失败:', error)
  } finally {
    pageData.loadingMore = false
  }
}

async function appendPageInOrder(current: bookInfoOutput): Promise<void> {
  pageData.pageRendering = true
  try {
    await loadCurrentPage(current)
  } finally {
    pageData.pageRendering = false
  }
}

/**
 * 加载当前页图片
 * @param current 当前页信息
 */
async function loadCurrentPage(current: bookInfoOutput): Promise<void> {
  const imageIds = current.dataOrDefault ?? []
  const startIndex = bookImages.value.length

  if (imageIds.length === 0) {
    return
  }

  bookImages.value.push(
    ...imageIds.map((_, index) => ({
      key: `${current.bookId}-${current.pageIndex}-${startIndex + index}`,
      url: '',
      loading: true,
      failed: false,
    })),
  )

  const imageBusi = new bookImageBusi()

  for (let currentIndex = 0; currentIndex < imageIds.length; currentIndex++) {
    const imageId = imageIds[currentIndex] ?? ''
    const target = bookImages.value[startIndex + currentIndex]
    if (!target) {
      continue
    }

    try {
      const input = new bookImgInput()
      input.imageId = imageId
      const result = await imageBusi.getBookImage(input)
      if (result.isSuccess && result.dataOrDefault) {
        target.url = result.dataOrDefault
      } else {
        target.failed = true
      }
    } catch (error) {
      console.error(`加载图片失败: ${imageId}`, error)
      target.failed = true
    } finally {
      target.loading = false
    }
  }
}

/**
 * 加载下一页图片
 */
async function loadNextPage(): Promise<bookInfoOutput> {
  if (!bookInfo)
    return {
      isSuccess: false,
      msg: '没有书籍信息',
    } as bookInfoOutput
  if (bookInfo.lastPageIndex - 1 <= pageData.pageIndex) {
    pageData.noMore = true
    return {
      isSuccess: false,
      msg: '没有下一页了',
    } as bookInfoOutput
  }
  const nextPageInfo = await fetchBookInfo(bookInfo.bookId, pageData.pageIndex + 1)
  if (nextPageInfo.isSuccess && nextPageInfo.dataOrDefault) {
    pageData.pageIndex = nextPageInfo.pageIndex
    bookInfo = nextPageInfo
    pageData.noMore = nextPageInfo.lastPageIndex - 1 <= nextPageInfo.pageIndex
  }
  return nextPageInfo
}

function setupObserver() {
  observer?.disconnect()

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          void loadMorePic()
        }
      })
    },
    {
      root: null,
      rootMargin: '300px',
      threshold: 0.1,
    },
  )

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
}
</script>

<template>
  <div class="viewer-view">
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
            <el-image v-if="image.url" :src="image.url" class="reader-image" lazy />
            <div v-else-if="image.failed" class="image-error">图片加载失败</div>
          </template>
        </el-skeleton>
      </div>
    </div>

    <div ref="loadMoreTrigger" class="load-more-trigger"></div>

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
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.load-more-trigger {
  height: 1px;
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
