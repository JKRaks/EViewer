<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowUp,
  Close,
  Filter,
  Loading,
  Picture,
  Plus,
  RefreshLeft,
  Search,
  Upload,
} from '@element-plus/icons-vue'
import { bookListBusi } from '@/core/books/bookListBusi'
import { galleryFileSearchBusi } from '@/core/books/galleryFileSearchBusi'
import {
  cloneBookInput,
  compileGallerySearch,
  deserializeGallerySearchCriteria,
  gallerySearchValidationError,
  serializeGallerySearchCriteria,
} from '@/core/books/gallerySearchCompiler'
import { gallerySimilaritySearchInput } from '@/core/model/book/galleryFileSearchInput'
import {
  createGallerySearchCriteria,
  type gallerySearchCriteria,
  type selectedGalleryTag,
} from '@/core/model/book/gallerySearchCriteria'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput, bookItem } from '@/core/model/book/bookOutput'
import { categoryEnum } from '@/core/common/enum/categoryEnum'
import BookItem from '@/components/BookItem.vue'
import SearchTagPicker from '@/components/SearchTagPicker.vue'
import { useLayoutMainScrollMemory } from '@/composables/useLayoutMainScrollMemory'

defineOptions({ name: 'BookList' })

const route = useRoute()
const router = useRouter()
const criteria = ref<gallerySearchCriteria>(createGallerySearchCriteria())
const titleText = ref('')
const activeInput = ref<bookInput>(new bookInput())
const bookOutputs = ref<bookOutput>()
const allBooks = ref<bookItem[]>([])
const showAdvanced = ref(false)
const tagPickerVisible = ref(false)
const imageSearchVisible = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const hasSearched = ref(false)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const imageFile = ref<File>()
const imagePreviewUrl = ref('')
const imageSearchLoading = ref(false)
const imageUploadProgress = ref(0)
const onlyCovers = ref(false)
let observer: IntersectionObserver | null = null
let requestController: AbortController | undefined
let requestVersion = 0
let appliedRouteCriteria = ''

const categoryOptions = [
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
const ratingOptions = [
  { label: '2 星及以上', value: 2 },
  { label: '3 星及以上', value: 3 },
  { label: '4 星及以上', value: 4 },
  { label: '5 星', value: 5 },
]
const allCategoriesSelected = computed({
  get: () => criteria.value.categories.length === 0,
  set: (selected: boolean) => {
    if (selected) criteria.value.categories = []
  },
})
const canClearSearch = computed(() => {
  const value = criteria.value
  return Boolean(
    hasSearched.value ||
      imageFile.value ||
      value.freeText.trim() ||
      titleText.value.trim() ||
      value.uploader.trim() ||
      value.uploaderUid.trim() ||
      value.includeTags.length ||
      value.excludeTags.length ||
      value.categories.length ||
      value.minRating !== undefined ||
      value.minPages !== undefined ||
      value.maxPages !== undefined ||
      value.requireTorrent ||
      value.browseExpunged ||
      Object.values(value.disableCustomFilters).some(Boolean),
  )
})

const { persistScrollPosition, applyScrollTop, bindScrollListener, unbindScrollListener } =
  useLayoutMainScrollMemory('booklist-scroll-position')

watch(
  () => [route.query.criteria, route.query.keyword, route.query.uploader] as const,
  ([serialized, keyword, uploader]) => {
    if (route.name !== 'booklist') return
    const nextCriteria = deserializeGallerySearchCriteria(serialized, keyword, uploader)
    const signature = serializeGallerySearchCriteria(nextCriteria)
    if (signature === appliedRouteCriteria) return
    appliedRouteCriteria = signature
    criteria.value = nextCriteria
    titleText.value = nextCriteria.titleTerms.join(' ')
    const routeHasSearch = [serialized, keyword, uploader].some((value) =>
      Array.isArray(value) ? Boolean(value[0]) : Boolean(value),
    )
    if (!routeHasSearch) {
      requestController?.abort()
      bookOutputs.value = undefined
      allBooks.value = []
      hasSearched.value = false
      return
    }
    void executeStructuredSearch(hasSearched.value)
  },
  { immediate: true },
)

async function submitSearch() {
  criteria.value.titleTerms = titleText.value.trim() ? [titleText.value.trim()] : []
  const serialized = serializeGallerySearchCriteria(criteria.value)
  if (serialized === appliedRouteCriteria) {
    await executeStructuredSearch(false)
    return
  }
  await router.replace({ name: 'booklist', query: { criteria: serialized } })
}

async function clearSearchConditions() {
  requestController?.abort()
  requestVersion++
  criteria.value = createGallerySearchCriteria()
  titleText.value = ''
  activeInput.value = new bookInput()
  bookOutputs.value = undefined
  allBooks.value = []
  loading.value = false
  loadingMore.value = false
  imageSearchLoading.value = false
  hasSearched.value = false
  imageSearchVisible.value = false
  clearImagePreview()
  appliedRouteCriteria = serializeGallerySearchCriteria(criteria.value)
  applyScrollTop(0)
  await router.replace({ name: 'booklist' })
}

async function executeStructuredSearch(resetScroll: boolean) {
  let input: bookInput
  try {
    input = compileGallerySearch(criteria.value)
  } catch (error) {
    showSearchError(error)
    return
  }

  const version = beginRequest()
  loading.value = true
  activeInput.value = input
  try {
    const result = await new bookListBusi().getBookPageList(input, {
      signal: requestController?.signal,
    })
    if (version !== requestVersion) return
    bookOutputs.value = result
    allBooks.value = result.data ?? []
    hasSearched.value = true
    if (!result.isSuccess && result.msg) ElMessage.error(result.msg)
    if (resetScroll) applyScrollTop(0)
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

async function loadMore() {
  if (
    loadingMore.value ||
    loading.value ||
    imageSearchLoading.value ||
    !bookOutputs.value?.nxtPage
  ) {
    return
  }
  loadingMore.value = true
  const version = requestVersion
  try {
    const nextInput = cloneBookInput(activeInput.value)
    nextInput.pageNxt = bookOutputs.value.nxtPage
    nextInput.pagePrev = undefined
    const result = await new bookListBusi().getBookPageList(nextInput, {
      signal: requestController?.signal,
    })
    if (version !== requestVersion) return
    if (result.isSuccess && result.data) {
      allBooks.value.push(...result.data)
      bookOutputs.value = result
      activeInput.value = nextInput
    } else if (result.msg) {
      ElMessage.error(result.msg)
    }
  } finally {
    loadingMore.value = false
  }
}

function updateIncludeTags(tags: selectedGalleryTag[]) {
  criteria.value.includeTags = tags
}

function updateExcludeTags(tags: selectedGalleryTag[]) {
  criteria.value.excludeTags = tags
}

function removeTag(type: 'include' | 'exclude', tag: selectedGalleryTag) {
  const target = type === 'include' ? criteria.value.includeTags : criteria.value.excludeTags
  const filtered = target.filter(
    (item) => item.namespace !== tag.namespace || item.master !== tag.master,
  )
  if (type === 'include') criteria.value.includeTags = filtered
  else criteria.value.excludeTags = filtered
}

function chooseImage() {
  fileInput.value?.click()
}

function handleImageFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  setImageFile(file)
}

function handleImageDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (file) setImageFile(file)
}

function setImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  clearImagePreview()
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
}

function clearImagePreview() {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = ''
  imageFile.value = undefined
  imageUploadProgress.value = 0
  if (fileInput.value) fileInput.value.value = ''
}

async function searchByImage(mode: 'exact' | 'similar') {
  if (!imageFile.value) {
    ElMessage.warning('请先选择图片')
    return
  }
  const version = beginRequest()
  imageSearchLoading.value = true
  imageUploadProgress.value = 0
  try {
    const busi = new galleryFileSearchBusi()
    const result =
      mode === 'exact'
        ? await busi.searchExact(imageFile.value, { signal: requestController?.signal })
        : await busi.searchSimilar(
            new gallerySimilaritySearchInput(imageFile.value, true, onlyCovers.value),
            {
              signal: requestController?.signal,
              timeout: 60000,
              onUploadProgress: (loaded, total) => {
                imageUploadProgress.value = total ? Math.round((loaded / total) * 100) : 0
              },
            },
          )
    if (version !== requestVersion) return
    bookOutputs.value = result
    bookOutputs.value.nxtPage = undefined
    allBooks.value = result.data ?? []
    activeInput.value = new bookInput()
    hasSearched.value = true
    if (!result.isSuccess && result.msg) ElMessage.error(result.msg)
    applyScrollTop(0)
    if (result.isSuccess) imageSearchVisible.value = false
  } catch (error) {
    if (version === requestVersion) showSearchError(error)
  } finally {
    if (version === requestVersion) imageSearchLoading.value = false
  }
}

function beginRequest() {
  requestController?.abort()
  requestController = new AbortController()
  return ++requestVersion
}

function showSearchError(error: unknown) {
  if (error instanceof gallerySearchValidationError) {
    ElMessage.warning(error.messages.join('；'))
  } else {
    ElMessage.error(error instanceof Error ? error.message : '搜索失败')
  }
}

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    },
    { root: null, rootMargin: '200px', threshold: 0.1 },
  )
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value)
}

onMounted(() => {
  bindScrollListener()
  setupObserver()
})
onUnmounted(() => {
  requestController?.abort()
  clearImagePreview()
  unbindScrollListener()
  observer?.disconnect()
})
onActivated(() => {
  bindScrollListener()
  setupObserver()
})
onBeforeRouteLeave(() => persistScrollPosition())
onDeactivated(() => {
  persistScrollPosition()
  unbindScrollListener()
  observer?.disconnect()
})
</script>

<template>
  <div class="booklist-view">
    <section class="search-surface">
      <div class="search-basic">
        <el-input
          v-model="criteria.freeText"
          placeholder="标题、标签或关键词"
          clearable
          @keyup.enter="submitSearch"
        >
          <template #prefix
            ><el-icon><Search /></el-icon
          ></template>
        </el-input>
        <el-button type="primary" :loading="loading" :icon="Search" @click="submitSearch"
          >搜索</el-button
        >
        <el-tooltip content="图片搜索" placement="top" :disabled="imageSearchVisible">
          <el-button
            class="search-icon-action image-search-trigger"
            circle
            plain
            :icon="Picture"
            aria-label="图片搜索"
            @click="imageSearchVisible = true"
          />
        </el-tooltip>
        <el-tooltip content="清除搜索条件" placement="top">
          <el-button
            class="search-icon-action clear-search-trigger"
            circle
            plain
            :icon="RefreshLeft"
            :disabled="!canClearSearch"
            aria-label="清除搜索条件"
            @click="clearSearchConditions"
          />
        </el-tooltip>
        <el-button
          text
          :icon="showAdvanced ? ArrowUp : ArrowDown"
          @click="showAdvanced = !showAdvanced"
        >
          {{ showAdvanced ? '收起' : '筛选' }}
        </el-button>
      </div>

      <el-collapse-transition>
        <div v-show="showAdvanced" class="advanced-search">
          <div class="filter-section tag-filter-section">
            <div class="section-heading">
              <strong>标签</strong>
              <el-segmented
                v-model="criteria.tagMode"
                :options="[
                  { label: '全部匹配', value: 'all' },
                  { label: '任意匹配', value: 'any' },
                ]"
              />
            </div>
            <div class="selected-tags">
              <el-tag
                v-for="tag in criteria.includeTags"
                :key="`include-${tag.namespace}-${tag.master}`"
                closable
                type="success"
                @close="removeTag('include', tag)"
                >{{ tag.displayName }} <small>{{ tag.namespace }}</small></el-tag
              >
              <el-tag
                v-for="tag in criteria.excludeTags"
                :key="`exclude-${tag.namespace}-${tag.master}`"
                closable
                type="danger"
                @close="removeTag('exclude', tag)"
                >{{ tag.displayName }} <small>{{ tag.namespace }}</small></el-tag
              >
              <el-button
                circle
                plain
                :icon="Plus"
                title="选择标签"
                @click="tagPickerVisible = true"
              />
            </div>
          </div>

          <el-form label-position="top" class="advanced-form">
            <el-form-item label="标题"><el-input v-model="titleText" clearable /></el-form-item>
            <el-form-item label="上传者"
              ><el-input v-model="criteria.uploader" clearable
            /></el-form-item>
            <el-form-item label="上传者 UID"
              ><el-input v-model="criteria.uploaderUid" inputmode="numeric" clearable
            /></el-form-item>
            <el-form-item label="最低评分">
              <el-select v-model="criteria.minRating" clearable placeholder="不限">
                <el-option
                  v-for="item in ratingOptions"
                  :key="item.label"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="页数范围" class="page-range-item">
              <div class="page-range">
                <el-input-number
                  v-model="criteria.minPages"
                  :min="0"
                  :controls="false"
                  placeholder="最少"
                />
                <span>至</span>
                <el-input-number
                  v-model="criteria.maxPages"
                  :min="0"
                  :controls="false"
                  placeholder="最多"
                />
              </div>
            </el-form-item>
          </el-form>

          <div class="filter-section categories-section">
            <strong>分类</strong>
            <div class="category-options">
              <el-checkbox v-model="allCategoriesSelected">全部</el-checkbox>
              <el-checkbox-group v-model="criteria.categories">
                <el-checkbox
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :value="item.value"
                  >{{ item.label }}</el-checkbox
                >
              </el-checkbox-group>
            </div>
          </div>

          <div class="switch-options">
            <el-switch v-model="criteria.requireTorrent" active-text="存在种子" />
            <el-switch v-model="criteria.browseExpunged" active-text="显示已移除" />
            <el-switch
              v-model="criteria.disableCustomFilters.language"
              active-text="忽略语言过滤"
            />
            <el-switch
              v-model="criteria.disableCustomFilters.uploader"
              active-text="忽略上传者过滤"
            />
            <el-switch v-model="criteria.disableCustomFilters.tags" active-text="忽略标签过滤" />
          </div>
        </div>
      </el-collapse-transition>
    </section>

    <SearchTagPicker
      v-model="tagPickerVisible"
      :include-tags="criteria.includeTags"
      :exclude-tags="criteria.excludeTags"
      @update:include-tags="updateIncludeTags"
      @update:exclude-tags="updateExcludeTags"
    />

    <el-dialog
      v-model="imageSearchVisible"
      title="图片搜索"
      width="min(620px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="!imageSearchLoading"
      class="image-search-dialog"
    >
      <input
        ref="fileInput"
        class="native-file-input"
        type="file"
        accept="image/*"
        @change="handleImageFile"
      />
      <div class="image-file-picker">
        <button
          class="image-drop-zone"
          type="button"
          @click="chooseImage"
          @dragover.prevent
          @drop.prevent="handleImageDrop"
        >
          <img v-if="imagePreviewUrl" :src="imagePreviewUrl" alt="待搜索图片" />
          <el-icon v-else><Upload /></el-icon>
          <span>{{ imageFile?.name ?? '选择图片' }}</span>
        </button>
        <el-button
          v-if="imageFile"
          class="remove-image-button"
          circle
          :icon="Close"
          title="移除图片"
          @click.stop="clearImagePreview"
        />
      </div>
      <div class="image-search-options">
        <el-checkbox v-model="onlyCovers">仅封面</el-checkbox>
      </div>
      <div class="image-search-actions">
        <el-button :icon="Picture" :loading="imageSearchLoading" @click="searchByImage('exact')"
          >精确匹配</el-button
        >
        <el-button
          type="primary"
          :icon="Search"
          :loading="imageSearchLoading"
          @click="searchByImage('similar')"
          >近似搜索</el-button
        >
      </div>
      <el-progress
        v-if="imageSearchLoading && imageUploadProgress"
        class="image-search-progress"
        :percentage="imageUploadProgress"
        :stroke-width="4"
      />
    </el-dialog>

    <div v-if="hasSearched" class="result-info">
      <el-icon><Filter /></el-icon>
      <span
        >找到 {{ bookOutputs?.totalCount ?? allBooks.length }} 个结果，已加载
        {{ allBooks.length }} 条</span
      >
    </div>

    <div class="book-list" v-loading="loading || imageSearchLoading">
      <BookItem v-for="book in allBooks" :key="book.bookId" :book="book" class="book-item" />
      <div ref="loadMoreTrigger" class="load-more-trigger"></div>
      <div v-if="loadingMore" class="loading-more">
        <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
      </div>
      <div v-else-if="allBooks.length > 0 && !bookOutputs?.nxtPage" class="no-more">
        没有更多数据了
      </div>
    </div>

    <el-empty
      v-if="hasSearched && !loading && !imageSearchLoading && allBooks.length === 0"
      description="暂无数据"
    />
    <el-backtop :bottom="100" />
  </div>
</template>

<style scoped>
.booklist-view {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}
.search-surface {
  padding: 16px;
  margin-bottom: 20px;
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.search-basic {
  display: flex;
  align-items: center;
  gap: 12px;
}
.search-basic .el-input {
  flex: 1;
  max-width: 680px;
}
.search-basic .el-button + .el-button {
  margin-left: 0;
}
.search-icon-action {
  flex: none;
}
.advanced-search {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}
.filter-section + .filter-section,
.advanced-form + .filter-section {
  margin-top: 18px;
}
.section-heading {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
.selected-tags small {
  margin-left: 4px;
  opacity: 0.7;
}
.advanced-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px 16px;
  margin-top: 16px;
}
.advanced-form :deep(.el-form-item) {
  margin-bottom: 0;
}
.advanced-form :deep(.el-select) {
  width: 100%;
}
.page-range-item {
  grid-column: span 2;
}
.page-range {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(100px, 1fr) auto minmax(100px, 1fr);
  align-items: center;
  gap: 8px;
}
.page-range :deep(.el-input-number) {
  width: 100%;
}
.categories-section > strong {
  display: block;
  margin-bottom: 8px;
}
.category-options,
.category-options .el-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 18px;
}
.switch-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  margin-top: 18px;
}
.native-file-input {
  display: none;
}
.image-file-picker {
  position: relative;
}
.image-drop-zone {
  width: 100%;
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  overflow: hidden;
  padding: 8px 14px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  cursor: pointer;
}
.image-drop-zone img {
  width: min(180px, 45%);
  height: 184px;
  object-fit: contain;
  flex: none;
}
.image-drop-zone span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-drop-zone .el-icon {
  font-size: 32px;
  color: var(--el-color-primary);
}
.remove-image-button {
  position: absolute;
  top: 10px;
  right: 10px;
}
.image-search-options {
  min-height: 42px;
  display: flex;
  align-items: center;
  margin-top: 10px;
}
.image-search-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.image-search-actions .el-button {
  width: 100%;
  height: 42px;
  margin: 0;
}
.image-search-progress {
  margin-top: 14px;
}
.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 16px;
  border-radius: 6px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  font-size: 14px;
}
.result-info .el-icon {
  color: var(--el-color-primary);
}
.book-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.book-item {
  transition: all 0.3s;
}
.load-more-trigger {
  width: 100%;
  height: 1px;
  visibility: hidden;
}
.loading-more,
.no-more {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-color-primary);
}
html.dark .search-surface {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

@media (max-width: 900px) {
  .advanced-form {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }
}

@media (max-width: 767px) {
  .search-surface {
    padding: 12px;
    margin-bottom: 16px;
  }
  .search-basic {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px 40px;
    gap: 10px;
  }
  .search-basic .el-input {
    grid-column: 1 / -1;
    max-width: none;
  }
  .search-basic > .el-button:last-child {
    grid-column: 2;
    grid-row: 2;
  }
  .search-basic > .image-search-trigger {
    grid-column: 3;
  }
  .search-basic > .clear-search-trigger {
    grid-column: 4;
  }
  .advanced-form {
    grid-template-columns: 1fr;
  }
  .page-range-item {
    grid-column: auto;
  }
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .image-drop-zone {
    height: 180px;
  }
  .image-drop-zone img {
    height: 154px;
  }
  .book-list {
    gap: 10px;
  }
}
</style>
