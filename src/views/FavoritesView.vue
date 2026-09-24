<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Loading, Operation, RefreshRight, Search, Switch } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import BookItem from '@/components/BookItem.vue'
import { useAuthState } from '@/core/auth/authState'
import { favoriteBusi } from '@/core/books/favoriteBusi'
import { favoriteDataRevision } from '@/core/books/favoriteRevision'
import { seedFavoriteCategoryCache } from '@/core/auth/userConfigCache'
import { useLayoutMainScrollMemory } from '@/composables/useLayoutMainScrollMemory'
import {
  favoriteActionInput,
  favoriteListInput,
  favoriteSortInput,
  type favoriteCategoryValue,
  type favoriteSortMode,
} from '@/core/model/book/favoriteInput'
import type { favoriteBookItem, favoriteOutput } from '@/core/model/book/favoriteOutput'

defineOptions({
  name: 'FavoritesView',
})

const router = useRouter()
const authState = useAuthState()
const listBusi = new favoriteBusi()
const keyword = ref('')
const currentCategory = ref<favoriteCategoryValue>('all')
const sortMode = ref<favoriteSortMode>('published')
const listResult = ref<favoriteOutput>()
const books = ref<favoriteBookItem[]>([])
const selectedGalleryIds = ref<string[]>([])
const moveTarget = ref<number>()
const loading = ref(false)
const loadingMore = ref(false)
const sorting = ref(false)
const updating = ref(false)
const searchExpanded = ref(false)
const operationsExpanded = ref(false)
const initialized = ref(false)
const authenticationRequired = ref(false)
const errorMessage = ref('')
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let pendingReset = false
let loadedFavoriteRevision = favoriteDataRevision.value

const {
  persistScrollPosition,
  restoreScrollPosition,
  applyScrollTop,
  bindScrollListener,
  unbindScrollListener,
} = useLayoutMainScrollMemory('favorites-scroll-position')

const totalCount = computed(
  () => listResult.value?.categories.reduce((total, category) => total + category.count, 0) ?? 0,
)
const selectedIdSet = computed(() => new Set(selectedGalleryIds.value))
const allLoadedSelected = computed(
  () =>
    books.value.length > 0 && books.value.every((book) => selectedIdSet.value.has(book.galleryId)),
)
const partiallySelected = computed(
  () => selectedGalleryIds.value.length > 0 && !allLoadedSelected.value,
)

const createListInput = (nextPage?: string) => {
  const input = new favoriteListInput()
  input.category = currentCategory.value
  input.keyword = keyword.value.trim() || undefined
  input.pageNext = nextPage
  return input
}

const fetchFavorites = async (reset: boolean = true) => {
  if (!authState.loggedIn) return
  if (loading.value || loadingMore.value) {
    if (reset) {
      pendingReset = true
      loading.value = true
    }
    return
  }

  const isLoadingMore = !reset
  if (isLoadingMore && !listResult.value?.nextPage) return
  const requestInput = createListInput(isLoadingMore ? listResult.value?.nextPage : undefined)

  errorMessage.value = ''
  authenticationRequired.value = false
  if (isLoadingMore) loadingMore.value = true
  else loading.value = true

  try {
    const result = await listBusi.getFavoriteList(requestInput)
    if (requestInput.category !== currentCategory.value) {
      pendingReset = true
      return
    }

    initialized.value = true
    if (result.authenticationRequired) {
      authenticationRequired.value = true
      books.value = []
      listResult.value = result
      return
    }
    if (!result.isSuccess) {
      errorMessage.value = result.msg || '个人收藏获取失败'
      return
    }

    if (isLoadingMore) {
      const existingIds = new Set(books.value.map((book) => book.bookId))
      books.value.push(...(result.data ?? []).filter((book) => !existingIds.has(book.bookId)))
    } else {
      books.value = result.data ?? []
      selectedGalleryIds.value = []
      applyScrollTop(0)
    }
    listResult.value = result
    sortMode.value = result.sortMode
    loadedFavoriteRevision = favoriteDataRevision.value
    seedFavoriteCategoryCache(
      authState.memberId,
      result.categories.map((category) => ({ index: category.index, name: category.name })),
    )
    await nextTick()
    setupObserver()
  } catch (error) {
    if (requestInput.category === currentCategory.value) {
      errorMessage.value = error instanceof Error ? error.message : '个人收藏获取失败'
    }
  } finally {
    const shouldReload = pendingReset && authState.loggedIn
    pendingReset = false
    loading.value = false
    loadingMore.value = false
    if (shouldReload) void fetchFavorites()
  }
}

const handleCategoryChange = (category: string | number) => {
  if (sorting.value || updating.value) return
  const nextCategory = String(category) as favoriteCategoryValue
  if (nextCategory === currentCategory.value) return
  currentCategory.value = nextCategory
  void fetchFavorites()
}

const handleSortChange = async (value: string | number | boolean) => {
  if (sorting.value || updating.value) return
  const nextMode = String(value) as favoriteSortMode
  if (nextMode === sortMode.value) return

  const previousMode = listResult.value?.sortMode ?? sortMode.value
  sortMode.value = nextMode
  sorting.value = true
  try {
    const result = await listBusi.updateFavoriteSort(new favoriteSortInput(nextMode))
    if (!result.isSuccess) throw new Error(result.msg)
    await fetchFavorites()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '收藏排序更新失败')
    sortMode.value = previousMode
  } finally {
    sorting.value = false
  }
}

const setBookSelected = (galleryId: string, selected: boolean) => {
  const selectedIds = new Set(selectedGalleryIds.value)
  if (selected) selectedIds.add(galleryId)
  else selectedIds.delete(galleryId)
  selectedGalleryIds.value = [...selectedIds]
}

const toggleAllLoaded = (value: boolean | string | number) => {
  selectedGalleryIds.value = Boolean(value)
    ? books.value.map((book) => book.galleryId).filter(Boolean)
    : []
}

const runFavoriteAction = async (action: 'delete' | `fav${number}`) => {
  if (selectedGalleryIds.value.length === 0 || sorting.value || updating.value) return
  updating.value = true
  try {
    const result = await listBusi.updateFavorites(
      new favoriteActionInput(action, selectedGalleryIds.value),
    )
    if (!result.isSuccess) throw new Error(result.msg)
    selectedGalleryIds.value = []
    ElMessage.success(action === 'delete' ? '已删除选中的收藏' : '收藏分类已更新')
    await fetchFavorites()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '收藏夹更新失败')
  } finally {
    updating.value = false
  }
}

const moveSelected = async () => {
  if (moveTarget.value === undefined) {
    ElMessage.warning('请选择目标收藏分类')
    return
  }
  await runFavoriteAction(`fav${moveTarget.value}`)
}

const deleteSelected = async () => {
  if (selectedGalleryIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedGalleryIds.value.length} 个收藏吗？此操作无法撤销。`,
      '删除收藏',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
    await runFavoriteAction('delete')
  } catch {
    // 用户取消时不执行操作。
  }
}

const goToLogin = () => {
  void router.push('/login')
}

const setupObserver = () => {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fetchFavorites(false)
    },
    { rootMargin: '240px', threshold: 0.1 },
  )
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value)
}

const activatePage = async () => {
  bindScrollListener()
  setupObserver()
  if (
    authState.loggedIn &&
    (!initialized.value || loadedFavoriteRevision !== favoriteDataRevision.value)
  ) {
    await fetchFavorites()
  } else await restoreScrollPosition()
}

watch(
  () => authState.loggedIn,
  (loggedIn) => {
    if (loggedIn) {
      initialized.value = false
      void fetchFavorites()
    } else {
      books.value = []
      listResult.value = undefined
      initialized.value = false
      authenticationRequired.value = false
      pendingReset = false
    }
  },
)

onMounted(() => {
  void activatePage()
})

onActivated(() => {
  void activatePage()
})

onDeactivated(() => {
  persistScrollPosition()
  unbindScrollListener()
  observer?.disconnect()
})

onUnmounted(() => {
  unbindScrollListener()
  observer?.disconnect()
})
</script>

<template>
  <main class="favorites-view">
    <template v-if="!authState.loggedIn || authenticationRequired">
      <el-result
        icon="warning"
        title="需要认证信息"
        sub-title="维护有效的认证 Cookie 后才能读取个人收藏。"
      >
        <template #extra>
          <el-button type="primary" @click="goToLogin">前往账号管理</el-button>
        </template>
      </el-result>
    </template>

    <template v-else>
      <header class="favorites-header">
        <div>
          <h1>个人收藏</h1>
          <p>共 {{ totalCount }} 个画册</p>
        </div>
        <div class="favorites-header-actions">
          <el-tooltip
            :content="searchExpanded ? '收起搜索排序' : '展开搜索排序'"
            placement="bottom"
          >
            <el-button
              class="tool-toggle"
              :class="{ 'is-active': searchExpanded }"
              :icon="Search"
              circle
              :aria-label="searchExpanded ? '收起搜索排序' : '展开搜索排序'"
              :aria-expanded="searchExpanded"
              @click="searchExpanded = !searchExpanded"
            />
          </el-tooltip>
          <span class="tool-toggle-wrapper">
            <el-tooltip
              :content="operationsExpanded ? '收起批量操作' : '展开批量操作'"
              placement="bottom"
            >
              <el-button
                class="tool-toggle"
                :class="{ 'is-active': operationsExpanded }"
                :icon="Operation"
                circle
                :disabled="books.length === 0"
                :aria-label="operationsExpanded ? '收起批量操作' : '展开批量操作'"
                :aria-expanded="operationsExpanded"
                @click="operationsExpanded = !operationsExpanded"
              />
            </el-tooltip>
            <small v-if="selectedGalleryIds.length" class="tool-toggle-count">
              {{ selectedGalleryIds.length }}
            </small>
          </span>
          <el-tooltip content="刷新收藏" placement="bottom">
            <el-button
              class="tool-toggle"
              :icon="RefreshRight"
              circle
              :loading="loading || sorting"
              aria-label="刷新收藏"
              @click="fetchFavorites()"
            />
          </el-tooltip>
        </div>
      </header>

      <el-tabs
        :model-value="currentCategory"
        class="favorite-tabs"
        @tab-change="handleCategoryChange"
      >
        <el-tab-pane name="all" :disabled="sorting || updating">
          <template #label>
            <span class="category-tab"
              ><span>全部</span><small>{{ totalCount }}</small></span
            >
          </template>
        </el-tab-pane>
        <el-tab-pane
          v-for="category in listResult?.categories ?? []"
          :key="category.index"
          :name="String(category.index)"
          :disabled="sorting || updating"
        >
          <template #label>
            <span class="category-tab" :title="category.name">
              <span class="category-name">{{ category.name }}</span>
              <small>{{ category.count }}</small>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <el-collapse-transition>
        <section v-show="searchExpanded" class="favorite-controls">
          <el-input
            v-model="keyword"
            class="favorite-search"
            placeholder="搜索收藏..."
            clearable
            :disabled="sorting || updating"
            @keyup.enter="fetchFavorites()"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="sorting || updating"
            @click="fetchFavorites()"
          >
            搜索
          </el-button>
          <el-radio-group
            :model-value="sortMode"
            class="sort-selector"
            :disabled="sorting || updating"
            @change="handleSortChange"
          >
            <el-radio-button value="published">更新时间</el-radio-button>
            <el-radio-button value="favorited">收藏时间</el-radio-button>
          </el-radio-group>
        </section>
      </el-collapse-transition>

      <el-alert
        v-if="errorMessage"
        class="favorite-error"
        type="error"
        :title="errorMessage"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button text type="primary" @click="fetchFavorites()">重新加载</el-button>
        </template>
      </el-alert>

      <el-collapse-transition>
        <section v-show="operationsExpanded && books.length > 0" class="batch-toolbar">
          <el-checkbox
            :model-value="allLoadedSelected"
            :indeterminate="partiallySelected"
            :disabled="sorting || updating"
            @change="toggleAllLoaded"
          >
            已选 {{ selectedGalleryIds.length }}
          </el-checkbox>
          <div class="batch-actions">
            <el-select v-model="moveTarget" placeholder="移动到" :disabled="sorting || updating">
              <el-option
                v-for="category in listResult?.categories ?? []"
                :key="category.index"
                :label="category.name"
                :value="category.index"
              />
            </el-select>
            <el-button
              :icon="Switch"
              :disabled="sorting || selectedGalleryIds.length === 0 || moveTarget === undefined"
              :loading="updating"
              @click="moveSelected"
            >
              移动
            </el-button>
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="sorting || selectedGalleryIds.length === 0"
              :loading="updating"
              @click="deleteSelected"
            >
              删除
            </el-button>
          </div>
        </section>
      </el-collapse-transition>

      <section
        class="favorite-list"
        v-loading="loading || sorting"
        :element-loading-text="sorting ? '正在切换排序...' : '正在加载收藏...'"
      >
        <BookItem
          v-for="book in books"
          :key="book.bookId"
          :book="book"
          selectable
          :selected="selectedIdSet.has(book.galleryId)"
          :favorited-at="book.favoritedAt"
          :favorite-category-name="book.favoriteCategoryName"
          @update:selected="setBookSelected(book.galleryId, $event)"
        />

        <el-empty v-if="!loading && !errorMessage && books.length === 0" description="暂无收藏" />
        <div ref="loadMoreTrigger" class="load-more-trigger"></div>
        <div v-if="loadingMore" class="loading-more">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载中...</span>
        </div>
        <div v-else-if="books.length > 0 && !listResult?.nextPage" class="no-more">
          已加载全部收藏
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.favorites-view {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 12px 72px 80px 0;
}

.favorites-header {
  --tool-button-size: 46px;
  --tool-icon-size: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.favorites-header > div:first-child {
  min-width: 0;
}

.favorites-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.favorites-header-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.favorites-header h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
}

.favorites-header p {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-tabs {
  margin-top: 12px;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
}

.category-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tab small {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.tool-toggle {
  width: var(--tool-button-size);
  height: var(--tool-button-size);
  min-width: var(--tool-button-size);
  min-height: var(--tool-button-size);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  transition:
    transform 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.tool-toggle:hover:not(.is-disabled) {
  transform: translateY(-1px);
}

.tool-toggle :deep(.el-icon) {
  font-size: var(--tool-icon-size);
}

.tool-toggle.is-active {
  color: #fff;
  background-color: var(--el-color-primary);
}

.tool-toggle-wrapper {
  position: relative;
  display: inline-flex;
}

.tool-toggle-count {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  padding: 0 5px;
  border: 2px solid var(--el-bg-color-page);
  border-radius: 9px;
  color: #fff;
  background: var(--el-color-danger);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
}

.favorite-controls {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.favorite-error {
  margin: 16px 0;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-actions :deep(.el-select) {
  width: 180px;
}

.batch-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.favorite-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 180px;
  padding-top: 16px;
}

.load-more-trigger {
  width: 100%;
  height: 1px;
}

.loading-more,
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 767px) {
  .favorites-view {
    padding: 8px 58px 88px 0;
  }

  .favorites-header {
    --tool-button-size: 40px;
    --tool-icon-size: 17px;
  }

  .favorites-header h1 {
    font-size: 21px;
  }

  .favorite-controls {
    grid-template-columns: 1fr auto;
  }

  .sort-selector {
    grid-column: 1 / -1;
    width: 100%;
  }

  .sort-selector :deep(.el-radio-button) {
    flex: 1;
  }

  .sort-selector :deep(.el-radio-button__inner) {
    width: 100%;
  }

  .batch-toolbar,
  .batch-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-actions :deep(.el-select),
  .batch-actions :deep(.el-button) {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .favorites-view {
    padding-right: 54px;
  }

  .favorites-header {
    --tool-button-size: 38px;
    --tool-icon-size: 16px;
    gap: 10px;
  }

  .favorites-header-actions {
    gap: 8px;
  }

  .favorite-controls {
    grid-template-columns: 1fr;
  }

  .favorite-controls > :deep(.el-button),
  .sort-selector {
    grid-column: 1;
    width: 100%;
  }
}
</style>
