<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t, locale } from '@/i18n'

import TextField from '@/components/primitives/TextField.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Hint from '@/components/primitives/Hint.vue'
import SearchConditionChip from '@/components/SearchConditionChip.vue'
import CheckField from '@/components/primitives/CheckField.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import BackToTop from '@/components/primitives/BackToTop.vue'
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
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { notify } from '@/components/primitives/feedback'
import {
  X as Close,
  Filter,
  LoaderCircle as Loading,
  Image as Picture,
  RotateCcw as RefreshLeft,
  Search,
  Upload,
} from '@lucide/vue'
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
  gallerySearchCategories,
  type gallerySearchCriteria,
  type selectedGalleryTag,
} from '@/core/model/book/gallerySearchCriteria'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput, bookItem } from '@/core/model/book/bookOutput'
import BookItem from '@/components/BookItem.vue'
import GalleryFilters from '@/components/GalleryFilters.vue'
import Notice from '@/components/primitives/Notice.vue'
import { cloneGalleryCriteria, galleryTagKey } from '@/core/books/gallerySearchState'
import { useLayoutMainScrollMemory } from '@/composables/useLayoutMainScrollMemory'
import { getLayoutScrollTop, getLayoutScrollViewport } from '@/composables/layoutScroll'
import { authState } from '@/core/auth/authState'
import { currentTransportSignal, connectionSettings } from '@/core/connector/connectionSettings'
import {
  clearGalleryListSession,
  readGalleryListSession,
  saveGalleryListSession,
  type GalleryListSession,
} from '@/core/books/galleryListSession'

defineOptions({ name: 'BookList' })

const route = useRoute()
const router = useRouter()
const criteria = ref<gallerySearchCriteria>(createGallerySearchCriteria())
const appliedCriteria = ref(createGallerySearchCriteria())
const filterDraft = ref(createGallerySearchCriteria())
const filterError = ref('')
const searchError = ref('')
const resultsStale = ref(false)
const isMobile = ref(window.matchMedia('(max-width: 767px)').matches)
const mobileQuery = window.matchMedia('(max-width: 767px)')
const syncViewport = () => {
  isMobile.value = mobileQuery.matches
}
const activeConditions = computed(() => {
  const value = appliedCriteria.value
  return [
    value.titleTerms.length ? t('标题：{p0}', { p0: value.titleTerms.join(' ') }) : '',
    value.uploader ? t('上传者：{p0}', { p0: value.uploader }) : '',
    value.uploaderUid ? t('上传者 UID：{p0}', { p0: value.uploaderUid }) : '',
    ...value.categories.map((category) =>
      t(gallerySearchCategories.find(([, value]) => value === category)?.[0] || String(category)),
    ),
    value.minRating !== undefined ? t('{p0} 星及以上', { p0: value.minRating }) : '',
    value.minPages !== undefined || value.maxPages !== undefined
      ? (value.minPages ?? 0) + '–' + (value.maxPages ?? t('不限')) + t(' 页')
      : '',
    value.requireTorrent ? t('存在种子') : '',
    value.browseExpunged ? t('包含已移除') : '',
    value.disableCustomFilters.language ? t('忽略账户语言过滤') : '',
    value.disableCustomFilters.uploader ? t('忽略账户上传者过滤') : '',
    value.disableCustomFilters.tags ? t('忽略账户标签过滤') : '',
  ].filter(Boolean)
})
const activeInput = ref<bookInput>(new bookInput())
const bookOutputs = ref<bookOutput>()
const allBooks = ref<bookItem[]>([])
const showAdvanced = ref(false)
const imageSearchVisible = ref(false)
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const loadingMore = ref(false)
const moreError = ref('')
const hasSearched = ref(false)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const imageFile = ref<File>()
const imagePreviewUrl = ref('')
const imageSearchLoading = ref(false)
const imageSearchError = ref('')
const imageUploadProgress = ref(0)
const onlyCovers = ref(false)
let observer: IntersectionObserver | null = null
let requestController: AbortController | undefined
let requestVersion = 0
let appliedRouteCriteria = ''
let resumeStructuredSearch = false
let resumeMore = false
let pendingMoreInput: bookInput | undefined
let successfulSearchKey = ''
let appliedScope = ''
let viewActive = true
let restoringPosition = false
let restoredPosition: GalleryListSession | undefined
const sessionScope = computed(() =>
  JSON.stringify([
    connectionSettings.mode,
    connectionSettings.site,
    authState.loggedIn,
    authState.memberId || authState.lastLoginAt || '',
  ]),
)
const searchSessionKey = () => `${sessionScope.value}\n${appliedRouteCriteria}`

const canClearSearch = computed(() => {
  const value = criteria.value
  return Boolean(
    hasSearched.value ||
      imageFile.value ||
      value.freeText.trim() ||
      value.titleTerms.length ||
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

function syncRouteSearch() {
  const { criteria: serialized, keyword, uploader } = route.query
  if (route.name !== 'booklist') return
  const nextCriteria = deserializeGallerySearchCriteria(serialized, keyword, uploader)
  const signature = serializeGallerySearchCriteria(nextCriteria)
  if (signature === appliedRouteCriteria && appliedScope === sessionScope.value) return
  if (appliedScope && appliedScope !== sessionScope.value) {
    clearGalleryListSession()
    allBooks.value = []
    bookOutputs.value = undefined
    successfulSearchKey = ''
  }
  appliedScope = sessionScope.value
  appliedRouteCriteria = signature
  criteria.value = nextCriteria
  appliedCriteria.value = cloneGalleryCriteria(nextCriteria)
  const routeHasSearch = [serialized, keyword, uploader].some((value) =>
    Array.isArray(value) ? Boolean(value[0]) : Boolean(value),
  )
  if (!routeHasSearch) {
    requestController?.abort()
    requestVersion++
    loading.value = false
    loadingMore.value = false
    searchError.value = ''
    moreError.value = ''
    resultsStale.value = false
    bookOutputs.value = undefined
    allBooks.value = []
    hasSearched.value = false
    pendingMoreInput = undefined
    resumeMore = false
    resumeStructuredSearch = false
    restoredPosition = undefined
    restoringPosition = false
    return
  }
  const session = readGalleryListSession(searchSessionKey())
  if (session) {
    beginRequest()
    activeInput.value = compileGallerySearch(nextCriteria)
    activeInput.value.pageNxt = session.requestCursor
    allBooks.value = session.books
    bookOutputs.value = Object.assign(new bookOutput(), {
      isSuccess: true,
      data: session.books,
      nxtPage: session.nextCursor,
      prvPage: session.previousCursor,
      totalCount: session.totalCount,
    })
    successfulSearchKey = searchSessionKey()
    moreError.value = session.moreError
    searchError.value = ''
    resultsStale.value = false
    hasSearched.value = true
    restoredPosition = session
    restoringPosition = true
    void restoreListPosition()
    return
  }
  void executeStructuredSearch(hasSearched.value)
}
watch(
  () => [route.query.criteria, route.query.keyword, route.query.uploader, sessionScope.value],
  syncRouteSearch,
  { immediate: true },
)

function persistListSession() {
  if (
    !viewActive ||
    route.name !== 'booklist' ||
    restoringPosition ||
    successfulSearchKey !== searchSessionKey() ||
    !bookOutputs.value ||
    resultsStale.value ||
    loading.value
  )
    return
  const viewport = getLayoutScrollViewport()
  const element = [...document.querySelectorAll<HTMLElement>('.booklist-view [data-book-id]')].find(
    (item) => {
      const bounds = item.getBoundingClientRect()
      return bounds.bottom > viewport.top && bounds.top < viewport.bottom
    },
  )
  saveGalleryListSession({
    key: successfulSearchKey,
    books: allBooks.value,
    requestCursor: activeInput.value.pageNxt,
    nextCursor: bookOutputs.value.nxtPage,
    previousCursor: bookOutputs.value.prvPage,
    totalCount: bookOutputs.value.totalCount,
    moreError: moreError.value,
    scrollTop: getLayoutScrollTop(),
    anchor: element
      ? {
          bookId: element.dataset.bookId!,
          offset: element.getBoundingClientRect().top - viewport.top,
        }
      : undefined,
  })
}

async function restoreListPosition() {
  if (!restoredPosition) return
  const session = restoredPosition
  const version = requestVersion
  await nextTick()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (restoredPosition !== session) return
      if (viewActive && version === requestVersion) {
        const element = [
          ...document.querySelectorAll<HTMLElement>('.booklist-view [data-book-id]'),
        ].find((item) => item.dataset.bookId === session.anchor?.bookId)
        applyScrollTop(
          element && session.anchor
            ? getLayoutScrollTop() +
                element.getBoundingClientRect().top -
                getLayoutScrollViewport().top -
                session.anchor.offset
            : session.scrollTop,
        )
        restoredPosition = undefined
        restoringPosition = false
        setupObserver()
      }
    }),
  )
}

async function submitSearch() {
  try {
    compileGallerySearch(criteria.value)
  } catch (error) {
    filterError.value = error instanceof Error ? error.message : t('请检查筛选条件')
    showSearchError(error)
    return
  }
  appliedCriteria.value = cloneGalleryCriteria(criteria.value)

  const serialized = serializeGallerySearchCriteria(criteria.value)
  if (serialized === appliedRouteCriteria) {
    await executeStructuredSearch(false)
    return
  }
  await router.replace({ name: 'booklist', query: { criteria: serialized } })
}

async function clearSearchConditions() {
  clearGalleryListSession()
  successfulSearchKey = ''
  pendingMoreInput = undefined
  resumeMore = false
  resumeStructuredSearch = false
  restoredPosition = undefined
  restoringPosition = false
  requestController?.abort()
  requestVersion++
  criteria.value = createGallerySearchCriteria()
  appliedCriteria.value = createGallerySearchCriteria()
  cancelFilters()
  searchError.value = ''
  moreError.value = ''
  resultsStale.value = false
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
  clearGalleryListSession()
  const key = searchSessionKey()
  const signal = AbortSignal.any([requestController!.signal, currentTransportSignal()])
  loading.value = true
  activeInput.value = input
  try {
    const result = await new bookListBusi().getBookPageList(input, {
      signal,
    })
    if (version !== requestVersion || signal.aborted) return
    hasSearched.value = true
    if (!result.isSuccess) throw new Error(result.msg || t('搜索失败，请重试'))
    bookOutputs.value = result
    allBooks.value = result.data ?? []
    searchError.value = ''
    resultsStale.value = false
    successfulSearchKey = key
    if (resetScroll) applyScrollTop(0)
  } catch (error) {
    if (
      version === requestVersion &&
      !signal.aborted &&
      !(error instanceof Error && error.name === 'AbortError')
    ) {
      searchError.value = error instanceof Error ? error.message : t('搜索失败，请重试')
      resultsStale.value = allBooks.value.length > 0
      hasSearched.value = true
    }
  } finally {
    if (version === requestVersion) {
      loading.value = false
      persistListSession()
    }
  }
}

async function loadMore(retry = false) {
  if (
    loadingMore.value ||
    !viewActive ||
    restoringPosition ||
    loading.value ||
    imageSearchLoading.value ||
    resultsStale.value ||
    Boolean(searchError.value) ||
    (!retry && Boolean(moreError.value)) ||
    !bookOutputs.value?.nxtPage
  ) {
    return
  }
  loadingMore.value = true
  moreError.value = ''
  const version = requestVersion
  if (!requestController || requestController.signal.aborted)
    requestController = new AbortController()
  const signal = AbortSignal.any([requestController.signal, currentTransportSignal()])
  const nextInput = pendingMoreInput
    ? cloneBookInput(pendingMoreInput)
    : cloneBookInput(activeInput.value)
  nextInput.pageNxt = bookOutputs.value.nxtPage
  nextInput.pagePrev = undefined
  pendingMoreInput = nextInput
  try {
    const result = await new bookListBusi().getBookPageList(nextInput, {
      signal,
    })
    if (version !== requestVersion || signal.aborted) return
    if (!result.isSuccess) throw new Error(result.msg || t('加载失败'))
    const knownIds = new Set(allBooks.value.map((book) => book.bookId))
    allBooks.value.push(
      ...(result.data ?? []).filter((book) => {
        if (knownIds.has(book.bookId)) return false
        knownIds.add(book.bookId)
        return true
      }),
    )
    bookOutputs.value = result
    activeInput.value = nextInput
    pendingMoreInput = undefined
  } catch (error) {
    if (
      version === requestVersion &&
      !signal.aborted &&
      !(error instanceof Error && error.name === 'AbortError')
    ) {
      moreError.value = error instanceof Error ? error.message : t('加载失败')
    }
  } finally {
    if (version === requestVersion) {
      loadingMore.value = false
      persistListSession()
    }
  }
}

function openFilters() {
  filterDraft.value = cloneGalleryCriteria({
    ...appliedCriteria.value,
    freeText: criteria.value.freeText,
  })
  filterError.value = ''
  showAdvanced.value = true
}
function cancelFilters() {
  showAdvanced.value = false
  filterError.value = ''
  filterDraft.value = cloneGalleryCriteria(appliedCriteria.value)
}
async function applyFilters() {
  try {
    compileGallerySearch(filterDraft.value)
  } catch (error) {
    filterError.value = error instanceof Error ? error.message : t('请检查筛选条件')
    await nextTick()
    document.querySelector<HTMLElement>('.gallery-filters .field-error')?.focus()
    return
  }
  criteria.value = cloneGalleryCriteria(filterDraft.value)
  await submitSearch()
  showAdvanced.value = false
}
async function removeAppliedTag(mode: 'include' | 'exclude', tag: selectedGalleryTag) {
  const next = cloneGalleryCriteria(appliedCriteria.value)
  const property = mode === 'include' ? 'includeTags' : 'excludeTags'
  next[property] = next[property].filter((item) => galleryTagKey(item) !== galleryTagKey(tag))
  criteria.value = next
  await submitSearch()
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
    notify.warning(t('请选择图片文件'))
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
  imageSearchError.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function searchByImage(mode: 'exact' | 'similar') {
  if (!imageFile.value) {
    notify.warning(t('请先选择图片'))
    return
  }
  const version = beginRequest()
  imageSearchLoading.value = true
  imageSearchError.value = ''
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
    if (!result.isSuccess) throw new Error(result.msg || t('图片搜索失败，请重试'))
    bookOutputs.value = result
    bookOutputs.value.nxtPage = undefined
    allBooks.value = result.data ?? []
    activeInput.value = new bookInput()
    hasSearched.value = true
    searchError.value = ''
    resultsStale.value = false
    criteria.value = createGallerySearchCriteria()
    appliedCriteria.value = cloneGalleryCriteria(criteria.value)
    appliedRouteCriteria = serializeGallerySearchCriteria(criteria.value)
    await router.replace({ name: 'booklist' })
    applyScrollTop(0)
    imageSearchVisible.value = false
  } catch (error) {
    if (version === requestVersion) {
      imageSearchError.value = error instanceof Error ? error.message : t('图片搜索失败，请重试')
    }
  } finally {
    if (version === requestVersion) imageSearchLoading.value = false
  }
}

function beginRequest() {
  resumeStructuredSearch = false
  resumeMore = false
  pendingMoreInput = undefined
  restoredPosition = undefined
  restoringPosition = false
  successfulSearchKey = ''
  moreError.value = ''
  loadingMore.value = false
  loading.value = false
  imageSearchLoading.value = false
  requestController?.abort()
  requestController = new AbortController()
  return ++requestVersion
}

function showSearchError(error: unknown) {
  if (error instanceof gallerySearchValidationError) {
    notify.warning(error.messages.join('；'))
  } else {
    notify.error(error instanceof Error ? error.message : t('搜索失败'))
  }
}

function setupObserver() {
  observer?.disconnect()
  if (!viewActive || restoringPosition) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    },
    { root: null, rootMargin: '200px', threshold: 0.1 },
  )
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value)
}

onMounted(() => {
  mobileQuery.addEventListener('change', syncViewport)
  window.addEventListener('pagehide', persistListSession)
  document.addEventListener('visibilitychange', persistListSession)
  bindScrollListener()
  setupObserver()
})
onUnmounted(() => {
  window.removeEventListener('pagehide', persistListSession)
  document.removeEventListener('visibilitychange', persistListSession)
  mobileQuery.removeEventListener('change', syncViewport)
  requestController?.abort()
  clearImagePreview()
  unbindScrollListener()
  observer?.disconnect()
})
onActivated(() => {
  viewActive = true
  syncRouteSearch()
  if (!requestController || requestController.signal.aborted)
    requestController = new AbortController()
  bindScrollListener()
  if (restoringPosition) {
    void restoreListPosition()
    return
  }
  if (resumeStructuredSearch) {
    resumeStructuredSearch = false
    void executeStructuredSearch(false)
  } else if (resumeMore) {
    resumeMore = false
    void loadMore(true)
  }
  setupObserver()
})
onBeforeRouteLeave(() => {
  persistScrollPosition()
  persistListSession()
})
onDeactivated(() => {
  resumeStructuredSearch = loading.value && !imageSearchLoading.value
  resumeMore = loadingMore.value
  viewActive = false
  requestController?.abort()
  requestVersion++
  loading.value = false
  loadingMore.value = false
  imageSearchLoading.value = false
  imageSearchVisible.value = false
  cancelFilters()
  persistScrollPosition()
  unbindScrollListener()
  observer?.disconnect()
})
</script>
<template>
  <div class="booklist-view">
    <header class="search-heading">
      <p>{{ t('寻找下一本画册') }}</p>
      <h1>{{ t('搜索画册') }}</h1>
    </header>
    <section class="search-surface">
      <form class="search-basic" role="search" @submit.prevent="submitSearch">
        <TextField
          v-model="criteria.freeText"
          :placeholder="t('标题、标签或关键词')"
          :aria-label="t('搜索画册')"
          clearable
          :disabled="showAdvanced"
          ><template #prefix><Search :size="18" /></template></TextField
        ><ActionButton
          type="submit"
          variant="default"
          :loading="loading"
          :disabled="showAdvanced"
          :icon="Search"
          >{{ t('搜索') }}</ActionButton
        ><Hint :content="t('图片搜索')"
          ><ActionButton
            size="icon"
            :icon="Picture"
            :aria-label="t('图片搜索')"
            :disabled="showAdvanced"
            @click="imageSearchVisible = true" /></Hint
        ><Hint :content="t('清空搜索')"
          ><ActionButton
            size="icon"
            :icon="RefreshLeft"
            :aria-label="t('清空搜索')"
            :disabled="!canClearSearch"
            @click="clearSearchConditions" /></Hint
        ><ActionButton
          :icon="Filter"
          :aria-expanded="showAdvanced"
          @click="showAdvanced ? cancelFilters() : openFilters()"
          >{{ t('筛选') }}</ActionButton
        >
      </form>
      <div
        v-if="
          appliedCriteria.includeTags.length ||
          appliedCriteria.excludeTags.length ||
          activeConditions.length
        "
        class="query-summary"
      >
        <SearchConditionChip
          v-if="appliedCriteria.includeTags.length"
          :label="t('包含{p0}', { p0: appliedCriteria.tagMode === 'all' ? t('全部') : t('任意') })"
        />
        <SearchConditionChip
          v-for="tag in appliedCriteria.includeTags"
          :key="'include-' + galleryTagKey(tag)"
          :label="locale === 'en' ? tag.master : tag.displayName"
          :title="t('包含 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
          removable
          @remove="removeAppliedTag('include', tag)"
        />
        <SearchConditionChip
          v-for="tag in appliedCriteria.excludeTags"
          :key="'exclude-' + galleryTagKey(tag)"
          :label="locale === 'en' ? tag.master : tag.displayName"
          :title="t('排除 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
          excluded
          removable
          @remove="removeAppliedTag('exclude', tag)"
        />
        <SearchConditionChip
          v-for="(condition, index) in activeConditions"
          :key="index"
          :label="condition"
        />
      </div>
      <Transition name="disclosure"
        ><section
          v-if="showAdvanced && !isMobile"
          class="advanced-search"
          @keydown.esc="cancelFilters"
        >
          <GalleryFilters
            v-model="filterDraft"
            :error="filterError"
            @apply="applyFilters"
            @cancel="cancelFilters"
          /></section
      ></Transition>
    </section>
    <ModalPanel
      :model-value="showAdvanced && isMobile"
      :title="t('筛选画册')"
      sheet
      width="100%"
      @update:model-value="!$event && cancelFilters()"
      ><GalleryFilters
        v-if="showAdvanced && isMobile"
        v-model="filterDraft"
        :error="filterError"
        @apply="applyFilters"
        @cancel="cancelFilters"
    /></ModalPanel>
    <ModalPanel
      v-model="imageSearchVisible"
      :title="t('图片搜索')"
      width="min(620px, calc(100vw - 32px))"
      :outside-dismissible="!imageSearchLoading"
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
          <img v-if="imagePreviewUrl" :src="imagePreviewUrl" :alt="t('待搜索图片')" />
          <IconFrame v-else><Upload /></IconFrame>
          <span>{{ imageFile?.name ?? t('选择图片') }}</span>
        </button>
        <ActionButton
          v-if="imageFile"
          class="remove-image-button"
          size="icon"
          :icon="Close"
          :title="t('移除图片')"
          @click.stop="clearImagePreview"
        />
      </div>
      <div class="image-search-options">
        <CheckField v-model="onlyCovers">{{ t('仅封面') }}</CheckField>
      </div>
      <Notice v-if="imageSearchError" tone="error" :title="t(imageSearchError)" />
      <div class="image-search-actions">
        <ActionButton
          :icon="Picture"
          :loading="imageSearchLoading"
          @click="searchByImage('exact')"
          >{{ t('精确匹配') }}</ActionButton
        >
        <ActionButton
          variant="default"
          :icon="Search"
          :loading="imageSearchLoading"
          @click="searchByImage('similar')"
          >{{ t('近似搜索') }}</ActionButton
        >
      </div>
      <ProgressMeter
        v-if="imageSearchLoading && imageUploadProgress"
        class="image-search-progress"
        :percentage="imageUploadProgress"
        :stroke-width="4"
      />
    </ModalPanel>
    <Notice v-if="searchError" tone="error" :title="t(searchError)"
      ><p v-if="resultsStale">{{ t('下方保留的是上次搜索结果。') }}</p>
      <ActionButton size="sm" @click="submitSearch">{{ t('重试') }}</ActionButton></Notice
    >
    <div v-if="hasSearched" class="result-info">
      <span>{{ resultsStale ? t('上次结果') : t('搜索结果') }}</span
      ><small>{{
        !resultsStale && bookOutputs?.totalCount !== undefined
          ? t('共 {p0} 条 · 已加载 {p1} 条', { p0: bookOutputs.totalCount, p1: allBooks.length })
          : t('已加载 {p0} 条', { p0: allBooks.length })
      }}</small>
    </div>
    <div class="book-list gallery-masonry" v-busy="loading || imageSearchLoading">
      <BookItem
        v-for="book in allBooks"
        :key="book.bookId"
        :book="book"
        :data-book-id="book.bookId"
      />
      <div ref="loadMoreTrigger" class="load-more-trigger" />
      <div v-if="loadingMore" class="loading-more">
        <IconFrame class="is-loading"><Loading /></IconFrame><span>{{ t('再翻一页…') }}</span>
      </div>
      <div v-else-if="allBooks.length && !bookOutputs?.nxtPage" class="no-more">
        {{ t('已经到底了') }}
      </div>
    </div>
    <Notice
      v-if="moreError"
      :title="t('加载失败')"
      :description="t(moreError)"
      tone="error"
    >
      <p>{{ t('已保留已加载的画册和浏览位置。') }}</p>
      <ActionButton size="sm" :loading="loadingMore" @click="loadMore(true)">{{
        t('重试加载')
      }}</ActionButton>
    </Notice>
    <EmptyState
      v-if="!hasSearched && !loading"
      :description="t('输入关键词，或用筛选缩小范围')"
    /><EmptyState
      v-else-if="hasSearched && !loading && !imageSearchLoading && !searchError && !allBooks.length"
      :description="t('没有找到匹配内容，试试减少筛选条件')"
    /><BackToTop />
  </div>
</template>
<style scoped>
.booklist-view {
  max-width: 1400px;
  margin: auto;
}
.search-heading {
  padding: 4px 0 22px;
}
.search-heading p {
  font:
    10px/1.5 Georgia,
    serif;
  letter-spacing: 2px;
  color: var(--muted-foreground);
  margin: 0 0 10px;
}
.search-heading h1 {
  font-size: 23px;
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
}
.search-surface {
  margin-bottom: 24px;
}
.search-basic {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border);
}
.search-basic :deep(.ui-input) {
  flex: 1;
  border: 0;
  background: transparent;
  padding-left: 0;
  box-shadow: none;
}
.query-summary {
  display: flex;
  gap: 16px 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 12px;
  color: var(--muted-foreground);
}
.advanced-search {
  margin: 18px 0 24px;
  padding: 22px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
}
.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 6px 0 18px;
}
.result-info small {
  color: var(--muted-foreground);
}
.book-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px 22px;
  min-height: 1px;
}
.load-more-trigger,
.loading-more,
.no-more {
  grid-column: 1/-1;
}
.loading-more,
.no-more {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 22px;
  color: var(--muted-foreground);
  font-size: 12px;
}
.native-file-input {
  display: none;
}
.image-file-picker {
  position: relative;
}
.image-drop-zone {
  width: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px dashed var(--accent-ring);
  background: var(--muted-soft);
  border-radius: 10px;
  color: var(--text);
}
.image-drop-zone img {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
}
.remove-image-button {
  position: absolute;
  top: 8px;
  right: 8px;
}
.image-search-options {
  margin-top: 14px;
}
.image-search-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.image-search-progress {
  margin-top: 16px;
}
@media (max-width: 1050px) {
  .book-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .book-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
  .search-basic {
    flex-wrap: wrap;
    gap: 8px;
  }
  .search-basic :deep(.ui-input) {
    min-width: calc(100% - 90px);
  }
  .search-basic :deep(button) {
    font-size: 12px;
  }
  .search-heading h1 {
    font-size: 23px;
  }
}
</style>
