<script setup lang="ts">
import { t } from '@/i18n'

import StatusPanel from '@/components/primitives/StatusPanel.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Hint from '@/components/primitives/Hint.vue'
import SectionTabs from '@/components/primitives/SectionTabs'
import SectionTab from '@/components/primitives/SectionTab.vue'
import TextField from '@/components/primitives/TextField.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import Notice from '@/components/primitives/Notice.vue'
import CheckField from '@/components/primitives/CheckField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
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
import {
  Trash2 as Delete,
  LoaderCircle as Loading,
  SlidersHorizontal as Operation,
  RotateCw as RefreshRight,
  Search,
  ArrowLeftRight as Switch,
} from '@lucide/vue'
import { notify, dialogs } from '@/components/primitives/feedback'
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
let favoriteRequestId = 0

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
  const requestId = ++favoriteRequestId

  errorMessage.value = ''
  authenticationRequired.value = false
  if (isLoadingMore) loadingMore.value = true
  else loading.value = true

  try {
    const result = await listBusi.getFavoriteList(requestInput)
    if (requestId !== favoriteRequestId) return
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
      errorMessage.value = result.msg || t('个人收藏获取失败')
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
    if (requestId === favoriteRequestId && requestInput.category === currentCategory.value) {
      errorMessage.value = error instanceof Error ? error.message : t('个人收藏获取失败')
    }
  } finally {
    if (requestId === favoriteRequestId) {
      const shouldReload = pendingReset && authState.loggedIn
      pendingReset = false
      loading.value = false
      loadingMore.value = false
      if (shouldReload) void fetchFavorites()
    }
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
  const memberId = authState.memberId
  sortMode.value = nextMode
  sorting.value = true
  try {
    const result = await listBusi.updateFavoriteSort(new favoriteSortInput(nextMode))
    if (memberId !== authState.memberId) return
    if (!result.isSuccess) throw new Error(result.msg)
    await fetchFavorites()
  } catch (error) {
    if (memberId !== authState.memberId) return
    notify.error(error instanceof Error ? error.message : t('收藏排序更新失败'))
    sortMode.value = previousMode
  } finally {
    if (memberId === authState.memberId) sorting.value = false
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
  const memberId = authState.memberId
  updating.value = true
  try {
    const result = await listBusi.updateFavorites(
      new favoriteActionInput(action, selectedGalleryIds.value),
    )
    if (memberId !== authState.memberId) return
    if (!result.isSuccess) throw new Error(result.msg)
    selectedGalleryIds.value = []
    notify.success(action === 'delete' ? t('已删除选中的收藏') : t('收藏分类已更新'))
    await fetchFavorites()
  } catch (error) {
    if (memberId !== authState.memberId) return
    notify.error(error instanceof Error ? error.message : t('收藏夹更新失败'))
  } finally {
    if (memberId === authState.memberId) updating.value = false
  }
}

const moveSelected = async () => {
  if (moveTarget.value === undefined) {
    notify.warning(t('请选择目标收藏分类'))
    return
  }
  await runFavoriteAction(`fav${moveTarget.value}`)
}

const deleteSelected = async () => {
  if (selectedGalleryIds.value.length === 0) return
  const memberId = authState.memberId
  try {
    await dialogs.confirm(
      t('确定删除选中的 {p0} 个收藏吗？此操作无法撤销。', { p0: selectedGalleryIds.value.length }),
      t('删除收藏'),
      {
        type: 'warning',
        confirmButtonText: t('删除'),
        cancelButtonText: t('取消'),
      },
    )
    if (memberId === authState.memberId) await runFavoriteAction('delete')
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
  if (loading.value || loadingMore.value) return
  if (
    authState.loggedIn &&
    (!initialized.value || loadedFavoriteRevision !== favoriteDataRevision.value)
  ) {
    await fetchFavorites()
  } else await restoreScrollPosition()
}

watch(
  () => [authState.loggedIn, authState.memberId, authState.lastLoginAt] as const,
  ([loggedIn]) => {
    favoriteRequestId++
    books.value = []
    listResult.value = undefined
    selectedGalleryIds.value = []
    currentCategory.value = 'all'
    keyword.value = ''
    moveTarget.value = undefined
    loading.value = false
    loadingMore.value = false
    sorting.value = false
    updating.value = false
    pendingReset = false
    initialized.value = false
    errorMessage.value = ''
    authenticationRequired.value = false
    if (loggedIn) {
      void fetchFavorites()
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
      <StatusPanel
        icon="warning"
        :title="t('需要认证信息')"
        :sub-title="t('维护有效的认证 Cookie 后才能读取个人收藏。')"
      >
        <template #extra>
          <ActionButton variant="default" @click="goToLogin">{{ t('前往账号管理') }}</ActionButton>
        </template>
      </StatusPanel>
    </template>

    <template v-else>
      <header class="favorites-header">
        <div>
          <h1>{{ t('个人收藏') }}</h1>
          <p>{{ t('共 {p0} 个画册', { p0: totalCount }) }}</p>
        </div>
        <div class="favorites-header-actions">
          <Hint
            :content="searchExpanded ? t('收起搜索排序') : t('展开搜索排序')"
            placement="bottom"
          >
            <ActionButton
              class="tool-toggle"
              :class="{ 'is-active': searchExpanded }"
              :icon="Search"
              size="icon"
              :aria-label="searchExpanded ? t('收起搜索排序') : t('展开搜索排序')"
              :aria-expanded="searchExpanded"
              @click="searchExpanded = !searchExpanded"
            />
          </Hint>
          <span class="tool-toggle-wrapper">
            <Hint
              :content="operationsExpanded ? t('收起批量操作') : t('展开批量操作')"
              placement="bottom"
            >
              <ActionButton
                class="tool-toggle"
                :class="{ 'is-active': operationsExpanded }"
                :icon="Operation"
                size="icon"
                :disabled="books.length === 0"
                :aria-label="operationsExpanded ? t('收起批量操作') : t('展开批量操作')"
                :aria-expanded="operationsExpanded"
                @click="operationsExpanded = !operationsExpanded"
              />
            </Hint>
            <small v-if="selectedGalleryIds.length" class="tool-toggle-count">
              {{ selectedGalleryIds.length }}
            </small>
          </span>
          <Hint :content="t('刷新收藏')" placement="bottom">
            <ActionButton
              class="tool-toggle"
              :icon="RefreshRight"
              size="icon"
              :loading="loading || sorting"
              :aria-label="t('刷新收藏')"
              @click="fetchFavorites()"
            />
          </Hint>
        </div>
      </header>

      <SectionTabs
        :model-value="currentCategory"
        class="favorite-tabs"
        @tab-change="handleCategoryChange"
      >
        <SectionTab name="all" :disabled="sorting || updating">
          <template #label>
            <span class="category-tab"
              ><span>{{ t('全部') }}</span
              ><small>{{ totalCount }}</small></span
            >
          </template>
        </SectionTab>
        <SectionTab
          v-for="category in listResult?.categories ?? []"
          :key="category.index"
          :name="String(category.index)"
          :disabled="sorting || updating"
        >
          <template #label>
            <span class="category-tab" :title="t(category.name)">
              <span class="category-name">{{ category.name }}</span>
              <small>{{ category.count }}</small>
            </span>
          </template>
        </SectionTab>
      </SectionTabs>

      <Transition name="disclosure">
        <section v-show="searchExpanded" class="favorite-controls">
          <TextField
            v-model="keyword"
            class="favorite-search"
            :placeholder="t('搜索收藏...')"
            :aria-label="t('搜索收藏')"
            clearable
            :disabled="sorting || updating"
            @keyup.enter="fetchFavorites()"
          >
            <template #prefix>
              <IconFrame><Search /></IconFrame>
            </template>
          </TextField>
          <ActionButton
            variant="default"
            :loading="loading"
            :disabled="sorting || updating"
            @click="fetchFavorites()"
            >{{ t('搜索') }}</ActionButton
          >
          <ChoiceGroup
            :model-value="sortMode"
            class="sort-selector"
            :disabled="sorting || updating"
            @change="handleSortChange"
          >
            <RadioChoice value="published">{{ t('更新时间') }}</RadioChoice>
            <RadioChoice value="favorited">{{ t('收藏时间') }}</RadioChoice>
          </ChoiceGroup>
        </section>
      </Transition>

      <Notice
        v-if="errorMessage"
        class="favorite-error"
        tone="error"
        :title="t(errorMessage)"
        :closable="false"
      >
        <template #default>
          <ActionButton variant="ghost" @click="fetchFavorites()">{{ t('重新加载') }}</ActionButton>
        </template>
      </Notice>

      <Transition name="disclosure">
        <section v-show="operationsExpanded && books.length > 0" class="batch-toolbar">
          <CheckField
            :model-value="allLoadedSelected"
            :indeterminate="partiallySelected"
            :disabled="sorting || updating"
            @change="toggleAllLoaded"
            >{{ t('已选 {p0}', { p0: selectedGalleryIds.length }) }}
          </CheckField>
          <div class="batch-actions">
            <SelectField
              v-model="moveTarget"
              :placeholder="t('移动到')"
              :aria-label="t('目标收藏分类')"
              :disabled="sorting || updating"
            >
              <option
                v-for="category in listResult?.categories ?? []"
                :key="category.index"
                :label="t(category.name)"
                :value="category.index"
              ></option>
            </SelectField>
            <ActionButton
              :icon="Switch"
              :disabled="sorting || selectedGalleryIds.length === 0 || moveTarget === undefined"
              :loading="updating"
              @click="moveSelected"
              >{{ t('移动') }}</ActionButton
            >
            <ActionButton
              variant="destructive"
              :icon="Delete"
              :disabled="sorting || selectedGalleryIds.length === 0"
              :loading="updating"
              @click="deleteSelected"
              >{{ t('删除') }}</ActionButton
            >
          </div>
        </section>
      </Transition>

      <section class="favorite-list gallery-masonry" v-busy="loading || sorting">
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

        <EmptyState
          v-if="!loading && !errorMessage && books.length === 0"
          :description="t('暂无收藏')"
        />
        <div ref="loadMoreTrigger" class="load-more-trigger"></div>
        <div v-if="loadingMore" class="loading-more">
          <IconFrame class="is-loading"><Loading /></IconFrame>
          <span>{{ t('加载中...') }}</span>
        </div>
        <div v-else-if="books.length > 0 && !listResult?.nextPage" class="no-more">
          {{ t('已加载全部收藏') }}
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
  border-bottom: 1px solid var(--border-soft);
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

.favorites-header-actions :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.favorites-header h1 {
  margin: 0;
  color: var(--foreground);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
}

.favorites-header p {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
  background: var(--muted);
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

.tool-toggle :deep(.ui-icon) {
  font-size: var(--tool-icon-size);
}

.tool-toggle.is-active {
  color: var(--accent-foreground);
  background-color: var(--accent);
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
  border: 2px solid var(--background);
  border-radius: 9px;
  color: var(--background);
  background: var(--danger);
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
  border-bottom: 1px solid var(--border-soft);
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
  border-bottom: 1px solid var(--border-soft);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-actions :deep(.ui-select) {
  width: 180px;
}

.batch-actions :deep(.ui-button + .ui-button) {
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
  color: var(--muted-foreground);
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

  .batch-toolbar,
  .batch-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-actions :deep(.ui-select),
  .batch-actions :deep(.ui-button) {
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

  .favorite-controls > :deep(.ui-button),
  .sort-selector {
    grid-column: 1;
    width: 100%;
  }
}
.favorite-list {
  display: grid;
  columns: auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 26px 22px;
}
.favorite-list > :deep(.book-item) {
  margin: 0;
}
.favorite-list > .ui-empty,
.favorite-list > .load-more-trigger,
.favorite-list > .loading-more,
.favorite-list > .no-more {
  grid-column: 1/-1;
}
@media (max-width: 1050px) {
  .favorite-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .favorite-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
}
</style>
