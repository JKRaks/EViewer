<script setup lang="ts">
import { ref, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { bookListBusi } from '@/core/busi/bookListBusi'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput, bookItem } from '@/core/model/book/bookOutput'
import { categoryEnum } from '@/core/common/enum/categoryEnum'
import BookItem from '@/components/BookItem.vue'
import { Search, ArrowDown, ArrowUp, Filter, Loading } from '@element-plus/icons-vue'

const bookInputs = ref<bookInput>(new bookInput())
const bookOutputs = ref<bookOutput>()
const showAdvanced = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const allBooks = ref<bookItem[]>([])
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// 分类选项
const categoryOptions = [
  { label: '全部', value: categoryEnum.All },
  { label: '同人志', value: categoryEnum.Doujinshi },
  { label: '漫画', value: categoryEnum.Manga },
  { label: '艺术家CG', value: categoryEnum.ArtistCG },
  { label: '游戏CG', value: categoryEnum.GameCG },
  { label: '西方', value: categoryEnum.Western },
  { label: '非H', value: categoryEnum.NonH },
  { label: '图像集', value: categoryEnum.ImageSet },
  { label: 'Cosplay', value: categoryEnum.Cosplay },
  { label: '亚洲色情', value: categoryEnum.AsianPorn },
  { label: '杂项', value: categoryEnum.Misc },
]

// 评分选项
const ratingOptions = [
  { label: '不限', value: undefined },
  { label: '2星及以上', value: 2 },
  { label: '3星及以上', value: 3 },
  { label: '4星及以上', value: 4 },
  { label: '5星', value: 5 },
]

async function fetchBookList() {
  loading.value = true
  try {
    // 重置分页参数
    bookInputs.value.pageNxt = undefined
    bookInputs.value.pagePrev = undefined

    const busi = new bookListBusi()
    const result = await busi.getBookPageList(bookInputs.value)
    bookOutputs.value = result
    allBooks.value = result.data || []

    // 重置滚动位置
    const mainElement = document.querySelector('.layout-main') as HTMLElement
    if (mainElement) {
      mainElement.scrollTop = 0
    }
  } catch (error) {
    console.error('获取书籍列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载更多（下一页）
async function loadMore() {
  if (loadingMore.value || loading.value || !bookOutputs.value?.nxtPage) {
    return
  }

  console.log('开始加载下一页...')
  loadingMore.value = true
  try {
    const busi = new bookListBusi()
    const nextInput = new bookInput()
    nextInput.keyword = bookInputs.value.keyword
    nextInput.category = bookInputs.value.category
    nextInput.minRating = bookInputs.value.minRating
    nextInput.showHide = bookInputs.value.showHide
    nextInput.pageNxt = bookOutputs.value.nxtPage

    const result = await busi.getBookPageList(nextInput)

    if (result.isSuccess && result.data) {
      // 追加新数据
      allBooks.value.push(...result.data)
      bookOutputs.value = result
      console.log('加载成功，当前总数:', allBooks.value.length)
    }
  } catch (error) {
    console.error('加载更多失败:', error)
  } finally {
    loadingMore.value = false
  }
}

// 设置 IntersectionObserver
const setupObserver = () => {
  // 清理旧的 observer
  if (observer) {
    observer.disconnect()
  }

  // 创建新的 observer
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          console.log('触发器进入视野，准备加载更多')
          loadMore()
        }
      })
    },
    {
      root: null,
      rootMargin: '200px', // 提前 200px 开始加载
      threshold: 0.1,
    },
  )

  // 观察触发元素
  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
    console.log('已设置 IntersectionObserver')
  }
}

// 切换高级搜索
const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value
}

// 定义组件名称(用于 KeepAlive)
defineOptions({
  name: 'BookList',
})

const scrollPosition = ref(0)

// 挂载时设置 observer
onMounted(() => {
  setupObserver()
})

// 卸载时清理 observer
onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})

// 组件被激活时调用(从缓存中恢复)
onActivated(() => {
  // 重新设置 observer
  setupObserver()

  // 恢复滚动位置
  if (scrollPosition.value > 0) {
    const mainElement = document.querySelector('.layout-main') as HTMLElement
    if (mainElement) {
      mainElement.scrollTop = scrollPosition.value
    }
  }
})

// 组件被停用时调用(进入缓存)
onDeactivated(() => {
  // 保存滚动位置
  const mainElement = document.querySelector('.layout-main') as HTMLElement
  if (mainElement) {
    scrollPosition.value = mainElement.scrollTop
  }

  // 清理 observer
  if (observer) {
    observer.disconnect()
  }
})
</script>

<template>
  <div class="booklist-view">
    <!-- 搜索区域 -->
    <div class="search-container">
      <!-- 基础搜索 -->
      <div class="search-basic">
        <el-input
          v-model="bookInputs.keyword"
          placeholder="搜索关键词..."
          class="search-input"
          clearable
          @keyup.enter="fetchBookList"
        >
          <template #prefix>
            <el-icon>
              <Search />
            </el-icon>
          </template>
        </el-input>

        <el-button type="primary" :loading="loading" @click="fetchBookList"> 搜索 </el-button>

        <el-button :icon="showAdvanced ? ArrowUp : ArrowDown" @click="toggleAdvanced" text>
          {{ showAdvanced ? '收起' : '高级' }}
        </el-button>
      </div>

      <!-- 高级搜索(折叠) -->
      <el-collapse-transition>
        <div v-show="showAdvanced" class="search-advanced">
          <el-form :model="bookInputs" label-position="top" class="advanced-form">
            <!-- 分类 -->
            <el-form-item label="分类">
              <el-select v-model="bookInputs.category" placeholder="选择分类" class="form-select">
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <!-- 最低评分 -->
            <el-form-item label="最低评分">
              <el-select
                v-model="bookInputs.minRating"
                placeholder="选择评分"
                class="form-select"
                clearable
              >
                <el-option
                  v-for="item in ratingOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <!-- 显示已移除 -->
            <el-form-item label="显示选项">
              <el-switch
                v-model="bookInputs.showHide"
                active-text="显示已移除"
                inactive-text="隐藏已移除"
              />
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>
    </div>

    <!-- 结果统计 -->
    <div v-if="bookOutputs?.data" class="result-info">
      <el-icon>
        <Filter />
      </el-icon>
      <span>找到 {{ bookOutputs.totalCount }} 个结果，已加载 {{ allBooks.length }} 条</span>
    </div>

    <!-- 书籍列表 -->
    <div class="book-list" v-loading="loading">
      <BookItem v-for="book in allBooks" :key="book.bookId" :book="book" class="book-item" />

      <!-- 加载更多触发器（用于 IntersectionObserver） -->
      <div ref="loadMoreTrigger" class="load-more-trigger"></div>

      <!-- 加载更多提示 -->
      <div v-if="loadingMore" class="loading-more">
        <el-icon class="is-loading">
          <Loading />
        </el-icon>
        <span>加载中...</span>
      </div>

      <!-- 没有更多数据提示 -->
      <div v-else-if="allBooks.length > 0 && !bookOutputs?.nxtPage" class="no-more">
        没有更多数据了
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && allBooks.length === 0" description="暂无数据" />

    <el-backtop :bottom="100" />
  </div>
</template>

<style scoped>
.booklist-view {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

/* 搜索容器 */
.search-container {
  background-color: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 基础搜索 */
.search-basic {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  max-width: 600px;
}

/* 高级搜索 */
.search-advanced {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

.advanced-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-select {
  width: 100%;
}

/* 结果信息 */
.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.result-info .el-icon {
  color: var(--el-color-primary);
}

/* 书籍列表 */
.book-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-item {
  transition: all 0.3s;
}

/* 加载更多触发器（不可见） */
.load-more-trigger {
  height: 1px;
  width: 100%;
  visibility: hidden;
}

/* 加载更多提示 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--el-color-primary);
  font-size: 14px;
}

.loading-more .el-icon {
  font-size: 18px;
}

/* 没有更多数据提示 */
.no-more {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-container {
    padding: 12px;
    margin-bottom: 16px;
  }

  .search-basic {
    flex-direction: column;
    gap: 10px;
  }

  .search-input {
    max-width: 100%;
  }

  .search-basic .el-button {
    width: 100%;
  }

  .advanced-form {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .book-list {
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .search-container {
    padding: 10px;
    margin-bottom: 12px;
    border-radius: 6px;
  }

  .search-basic {
    gap: 8px;
  }

  .advanced-form {
    gap: 10px;
  }

  .result-info {
    padding: 6px 10px;
    font-size: 13px;
    margin-bottom: 12px;
  }

  .book-list {
    gap: 8px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .search-container {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

/* iOS Safari: 输入控件字号小于 16px 会触发页面自动放大 */
@supports (-webkit-touch-callout: none) {
  .search-container :deep(.el-input__inner),
  .search-container :deep(.el-select__selected-item),
  .search-container :deep(.el-select__placeholder) {
    font-size: 16px;
  }
}
</style>
