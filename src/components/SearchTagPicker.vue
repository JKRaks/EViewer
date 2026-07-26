<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, Check, Search } from '@element-plus/icons-vue'
import {
  listMasterTags,
  listTagNamespaces,
  searchMasterTags,
} from '@/core/common/tagTranslationWorkerClient'
import type { SearchableTag, TagNamespaceSummary } from '@/core/common/tagTranslationProtocol'
import type { selectedGalleryTag } from '@/core/model/book/gallerySearchCriteria'

const props = defineProps<{
  includeTags: selectedGalleryTag[]
  excludeTags: selectedGalleryTag[]
}>()
const emit = defineEmits<{
  'update:includeTags': [value: selectedGalleryTag[]]
  'update:excludeTags': [value: selectedGalleryTag[]]
}>()
const visible = defineModel<boolean>({ default: false })

const namespaces = ref<TagNamespaceSummary[]>([])
const activeNamespace = ref('')
const mobileStage = ref<'namespaces' | 'tags'>('namespaces')
const selectionMode = ref<'include' | 'exclude'>('include')
const searchScope = ref<'all' | 'current'>('all')
const keyword = ref('')
const loadingNamespaces = ref(false)
const loadingTags = ref(false)
const total = ref(0)
const loadedTags = reactive(new Map<number, SearchableTag>())
const loadedPages = new Set<number>()
const scrollTop = ref(0)
const viewportHeight = ref(420)
const isMobile = ref(false)
const listElement = ref<HTMLElement | null>(null)
const searchResults = ref<SearchableTag[]>([])
let searchTimer: ReturnType<typeof globalThis.setTimeout> | undefined
let searchVersion = 0
let mediaQuery: MediaQueryList | undefined

const rowHeight = 58
const pageSize = 160
const activeNamespaceInfo = computed(() =>
  namespaces.value.find((item) => item.namespace === activeNamespace.value),
)
const searching = computed(() => keyword.value.trim().length > 0)
const visibleRows = computed(() => {
  if (searching.value) {
    return searchResults.value.map((tag, index) => ({ index, tag }))
  }
  const start = Math.max(0, Math.floor(scrollTop.value / rowHeight) - 6)
  const count = Math.ceil(viewportHeight.value / rowHeight) + 12
  return Array.from({ length: Math.min(count, total.value - start) }, (_, offset) => {
    const index = start + offset
    return { index, tag: loadedTags.get(index) }
  })
})
const listHeight = computed(() =>
  searching.value ? searchResults.value.length * rowHeight : total.value * rowHeight,
)

watch(visible, (opened) => {
  if (!opened || namespaces.value.length) return
  void loadNamespaces()
})

watch(keyword, () => {
  globalThis.clearTimeout(searchTimer)
  const version = ++searchVersion
  searchTimer = globalThis.setTimeout(() => void runSearch(version), 250)
})

watch(searchScope, () => {
  if (!keyword.value.trim()) return
  const version = ++searchVersion
  void runSearch(version)
})

async function loadNamespaces() {
  loadingNamespaces.value = true
  try {
    namespaces.value = await listTagNamespaces()
    if (!activeNamespace.value && namespaces.value[0]) {
      await selectNamespace(namespaces.value[0].namespace)
      if (!isMobile.value) mobileStage.value = 'tags'
    }
  } finally {
    loadingNamespaces.value = false
  }
}

async function selectNamespace(namespace: string) {
  activeNamespace.value = namespace
  mobileStage.value = 'tags'
  keyword.value = ''
  total.value = namespaces.value.find((item) => item.namespace === namespace)?.count ?? 0
  loadedTags.clear()
  loadedPages.clear()
  scrollTop.value = 0
  if (listElement.value) listElement.value.scrollTop = 0
  await loadTagPage(0)
}

async function loadTagPage(index: number) {
  if (!activeNamespace.value) return
  const pageOffset = Math.floor(index / pageSize) * pageSize
  if (loadedPages.has(pageOffset)) return
  loadedPages.add(pageOffset)
  loadingTags.value = true
  try {
    const page = await listMasterTags(activeNamespace.value, pageOffset, pageSize)
    total.value = page.total
    page.items.forEach((tag, offset) => loadedTags.set(page.offset + offset, tag))
  } catch (error) {
    loadedPages.delete(pageOffset)
    throw error
  } finally {
    loadingTags.value = false
  }
}

function handleListScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  scrollTop.value = element.scrollTop
  viewportHeight.value = element.clientHeight
  const lastVisible = Math.ceil((element.scrollTop + element.clientHeight) / rowHeight) + 10
  void loadTagPage(lastVisible)
}

async function runSearch(version: number) {
  const query = keyword.value.trim()
  if (!query) {
    searchResults.value = []
    await nextTick()
    void loadTagPage(Math.floor(scrollTop.value / rowHeight))
    return
  }
  loadingTags.value = true
  try {
    const namespace = searchScope.value === 'current' ? activeNamespace.value : undefined
    const results = await searchMasterTags(query, namespace, 50)
    if (version === searchVersion) searchResults.value = results
  } finally {
    if (version === searchVersion) loadingTags.value = false
  }
}

function toggleTag(tag: SearchableTag) {
  const selected: selectedGalleryTag = {
    namespace: tag.namespace,
    master: tag.master,
    displayName: tag.displayName,
    source: tag.source,
  }
  const own = selectionMode.value === 'include' ? props.includeTags : props.excludeTags
  const other = selectionMode.value === 'include' ? props.excludeTags : props.includeTags
  const key = tagKey(selected)
  const alreadySelected = own.some((item) => tagKey(item) === key)
  const nextOwn = alreadySelected ? own.filter((item) => tagKey(item) !== key) : [...own, selected]
  const nextOther = other.filter((item) => tagKey(item) !== key)
  if (selectionMode.value === 'include') {
    emit('update:includeTags', nextOwn)
    emit('update:excludeTags', nextOther)
  } else {
    emit('update:excludeTags', nextOwn)
    emit('update:includeTags', nextOther)
  }
}

function selectedMode(tag: SearchableTag) {
  const key = tagKey(tag)
  if (props.includeTags.some((item) => tagKey(item) === key)) return 'include'
  if (props.excludeTags.some((item) => tagKey(item) === key)) return 'exclude'
  return undefined
}

function updateMobileState(event: MediaQueryListEvent | MediaQueryList) {
  isMobile.value = event.matches
  if (!event.matches && activeNamespace.value) mobileStage.value = 'tags'
}

function backToNamespaces() {
  keyword.value = ''
  mobileStage.value = 'namespaces'
}

function getSearchResultDisplayName(tag: SearchableTag) {
  if (!searching.value) return tag.displayName
  const namespace = namespaces.value.find((item) => item.namespace === tag.namespace)
  return `${namespace?.displayName ?? tag.namespace}:${tag.displayName}`
}

function tagKey(tag: Pick<SearchableTag, 'namespace' | 'master'>) {
  return `${tag.namespace.toLowerCase()}\u0000${tag.master.toLowerCase()}`
}

onMounted(() => {
  mediaQuery = globalThis.matchMedia('(max-width: 767px)')
  updateMobileState(mediaQuery)
  mediaQuery.addEventListener('change', updateMobileState)
})

onBeforeUnmount(() => {
  globalThis.clearTimeout(searchTimer)
  mediaQuery?.removeEventListener('change', updateMobileState)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="选择标签"
    width="min(920px, 94vw)"
    :fullscreen="isMobile"
    append-to-body
    destroy-on-close
    class="tag-picker-dialog"
  >
    <div class="picker-toolbar">
      <el-segmented
        v-model="selectionMode"
        :options="[
          { label: '包含', value: 'include' },
          { label: '排除', value: 'exclude' },
        ]"
      />
      <el-input v-model="keyword" clearable placeholder="搜索中文、英文或别名">
        <template #prefix
          ><el-icon><Search /></el-icon
        ></template>
      </el-input>
      <el-segmented
        v-model="searchScope"
        :options="[
          { label: '全部分类', value: 'all' },
          { label: '当前分类', value: 'current' },
        ]"
      />
    </div>

    <div
      class="picker-body"
      :class="{ 'show-tags': mobileStage === 'tags' || searching }"
    >
      <aside v-loading="loadingNamespaces" class="namespace-list">
        <button
          v-for="item in namespaces"
          :key="item.namespace"
          type="button"
          :class="{ active: item.namespace === activeNamespace }"
          @click="selectNamespace(item.namespace)"
        >
          <span>{{ item.displayName }}</span>
          <small>{{ item.count }}</small>
        </button>
      </aside>

      <section class="tag-list-panel">
        <header class="tag-list-header">
          <el-button
            v-if="isMobile"
            circle
            text
            :icon="ArrowLeft"
            @click="backToNamespaces"
          />
          <div>
            <strong>{{ searching ? '搜索结果' : activeNamespaceInfo?.displayName }}</strong>
            <span>{{ searching ? searchResults.length : total }} 个主标签</span>
          </div>
        </header>
        <div
          ref="listElement"
          v-loading="loadingTags && !visibleRows.length"
          class="virtual-tag-list"
          @scroll="handleListScroll"
        >
          <div class="virtual-tag-space" :style="{ height: `${listHeight}px` }">
            <button
              v-for="row in visibleRows"
              :key="`${searching ? 'search' : 'list'}-${row.index}`"
              type="button"
              class="tag-option"
              :class="row.tag ? `is-${selectedMode(row.tag) ?? 'idle'}` : 'is-loading'"
              :style="{ transform: `translateY(${row.index * rowHeight}px)` }"
              :disabled="!row.tag"
              @click="row.tag && toggleTag(row.tag)"
            >
              <template v-if="row.tag">
                <span class="tag-option-name">{{ getSearchResultDisplayName(row.tag) }}</span>
                <span class="tag-option-original"
                  >{{ row.tag.namespace }}:{{ row.tag.master }}</span
                >
                <el-icon v-if="selectedMode(row.tag)"><Check /></el-icon>
              </template>
            </button>
          </div>
          <el-empty
            v-if="searching && !loadingTags && !searchResults.length"
            description="没有匹配的标签"
            :image-size="72"
          />
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.picker-toolbar {
  display: grid;
  grid-template-columns: auto minmax(240px, 1fr) auto;
  gap: 12px;
  margin-bottom: 14px;
}

.picker-body {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  min-height: 480px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  overflow: hidden;
}

.namespace-list {
  padding: 8px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}

.namespace-list button {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  color: var(--el-text-color-regular);
  background: transparent;
  cursor: pointer;
}

.namespace-list button.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.namespace-list small {
  color: var(--el-text-color-secondary);
}
.tag-list-panel {
  min-width: 0;
}
.tag-list-header {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.tag-list-header div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.tag-list-header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.virtual-tag-list {
  position: relative;
  height: 426px;
  overflow: auto;
}
.virtual-tag-space {
  position: relative;
  min-width: 100%;
}
.tag-option {
  position: absolute;
  inset: 0 0 auto 0;
  width: 100%;
  height: 58px;
  display: grid;
  grid-template-columns: minmax(130px, 0.8fr) minmax(180px, 1.2fr) 24px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  text-align: left;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  cursor: pointer;
}
.tag-option:hover {
  background: var(--el-fill-color-light);
}
.tag-option.is-include {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.tag-option.is-exclude {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger-dark-2);
}
.tag-option.is-loading {
  background: var(--el-fill-color-lighter);
}
.tag-option-name,
.tag-option-original {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-option-original {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 767px) {
  .picker-toolbar {
    grid-template-columns: 1fr 1fr;
  }
  .picker-toolbar .el-input {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .picker-body {
    display: block;
    min-height: calc(100dvh - 190px);
    border: 0;
  }
  .namespace-list {
    height: calc(100dvh - 190px);
    border-right: 0;
  }
  .tag-list-panel {
    display: none;
  }
  .picker-body.show-tags .namespace-list {
    display: none;
  }
  .picker-body.show-tags .tag-list-panel {
    display: block;
  }
  .virtual-tag-list {
    height: calc(100dvh - 242px);
  }
  .tag-option {
    grid-template-columns: minmax(90px, 0.8fr) minmax(120px, 1.2fr) 20px;
    padding: 0 10px;
    gap: 8px;
  }
}
</style>
