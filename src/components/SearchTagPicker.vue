<script setup lang="ts">
import { t, locale } from '@/i18n'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { Search, Plus, Minus, Check } from '@lucide/vue'
import TextField from './primitives/TextField.vue'
import SegmentedControl from './primitives/SegmentedControl.vue'
import SearchConditionChip from './SearchConditionChip.vue'
import EmptyState from './primitives/EmptyState.vue'
import ActionButton from './primitives/ActionButton.vue'
import {
  listMasterTags,
  listTagNamespaces,
  searchMasterTags,
} from '@/core/common/tagTranslationWorkerClient'
import type { SearchableTag, TagNamespaceSummary } from '@/core/common/tagTranslationProtocol'
import type { selectedGalleryTag } from '@/core/model/book/gallerySearchCriteria'
import { galleryTagKey, selectGalleryTag } from '@/core/books/gallerySearchState'
const props = defineProps<{
  includeTags: selectedGalleryTag[]
  excludeTags: selectedGalleryTag[]
}>()
const emit = defineEmits<{
  'update:includeTags': [value: selectedGalleryTag[]]
  'update:excludeTags': [value: selectedGalleryTag[]]
}>()
const namespaces = ref<TagNamespaceSummary[]>([])
const activeNamespace = ref('')
const searchScope = ref('all')
const keyword = ref('')
const searchId = useId()
const loadingNamespaces = ref(false)
const loadingSearch = ref(false)
const pendingPages = ref(0)
const error = ref('')
const total = ref(0)
const loadedTags = ref(new Map<number, SearchableTag>())
const loadedPages = new Set<number>()
const scrollTop = ref(0)
const viewportHeight = ref(320)
const listElement = ref<HTMLElement>()
const searchResults = ref<SearchableTag[]>([])
const rowHeight = 80
const pageSize = 160
let searchVersion = 0
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
const searching = computed(() => !!keyword.value.trim())
const activeNamespaceInfo = computed(() =>
  namespaces.value.find((item) => item.namespace === activeNamespace.value),
)
const activeNamespaceLabel = computed(() =>
  locale.value === 'en'
    ? activeNamespaceInfo.value?.namespace
    : activeNamespaceInfo.value?.displayName,
)
const visibleRows = computed(() => {
  if (searching.value) return searchResults.value.map((tag, index) => ({ index, tag }))
  const start = Math.max(0, Math.floor(scrollTop.value / rowHeight) - 4)
  const count = Math.max(
    0,
    Math.min(Math.ceil(viewportHeight.value / rowHeight) + 8, total.value - start),
  )
  return Array.from({ length: count }, (_, offset) => ({
    index: start + offset,
    tag: loadedTags.value.get(start + offset),
  }))
})
const listHeight = computed(
  () => (searching.value ? searchResults.value.length : total.value) * rowHeight,
)
watch([keyword, searchScope, activeNamespace], () => {
  clearTimeout(timer)
  if (keyword.value.trim()) loadingSearch.value = true
  const version = ++searchVersion
  scrollTop.value = 0
  if (listElement.value) listElement.value.scrollTop = 0
  timer = setTimeout(() => void runSearch(version), 250)
})
async function loadNamespaces() {
  loadingNamespaces.value = true
  error.value = ''
  try {
    const result = await listTagNamespaces()
    if (disposed) return
    namespaces.value = result
    if (!activeNamespace.value && result[0]) await selectNamespace(result[0].namespace)
  } catch (cause) {
    if (!disposed) error.value = cause instanceof Error ? cause.message : t('标签索引加载失败')
  } finally {
    loadingNamespaces.value = false
  }
}
async function selectNamespace(namespace: string) {
  activeNamespace.value = namespace
  total.value = namespaces.value.find((item) => item.namespace === namespace)?.count ?? 0
  loadedTags.value.clear()
  loadedPages.clear()
  scrollTop.value = 0
  if (listElement.value) listElement.value.scrollTop = 0
  if (!searching.value) await loadTagPage(0)
}
async function loadTagPage(index: number) {
  const namespace = activeNamespace.value
  if (!namespace || searching.value || index >= total.value) return
  const offset = Math.floor(index / pageSize) * pageSize
  if (loadedPages.has(offset)) return
  loadedPages.add(offset)
  pendingPages.value++
  try {
    const page = await listMasterTags(namespace, offset, pageSize)
    if (disposed || namespace !== activeNamespace.value) return
    total.value = page.total
    page.items.forEach((tag, index) => loadedTags.value.set(page.offset + index, tag))
  } catch (cause) {
    if (namespace === activeNamespace.value && !disposed) {
      loadedPages.delete(offset)
      error.value = cause instanceof Error ? cause.message : t('标签加载失败，请重试')
    }
  } finally {
    pendingPages.value--
  }
}
function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  scrollTop.value = element.scrollTop
  viewportHeight.value = element.clientHeight
  const first = Math.max(0, Math.floor(scrollTop.value / rowHeight) - 4)
  void loadTagPage(first)
  void loadTagPage(Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight) + 4)
}
async function runSearch(version: number) {
  const query = keyword.value.trim()
  error.value = ''
  if (!query) {
    searchResults.value = []
    loadingSearch.value = false
    await nextTick()
    if (!disposed) await loadTagPage(0)
    return
  }
  loadingSearch.value = true
  try {
    const results = await searchMasterTags(
      query,
      searchScope.value === 'current' ? activeNamespace.value : undefined,
      50,
    )
    if (!disposed && version === searchVersion) searchResults.value = results
  } catch (cause) {
    if (!disposed && version === searchVersion)
      error.value = cause instanceof Error ? cause.message : t('查找失败，请重试')
  } finally {
    if (version === searchVersion) loadingSearch.value = false
  }
}
function toggleTag(tag: SearchableTag, mode: 'include' | 'exclude') {
  const next = selectGalleryTag(props.includeTags, props.excludeTags, tag, mode)
  emit('update:includeTags', next.includeTags)
  emit('update:excludeTags', next.excludeTags)
}
function remove(tag: selectedGalleryTag, mode: 'include' | 'exclude') {
  const key = galleryTagKey(tag)
  if (mode === 'include')
    emit(
      'update:includeTags',
      props.includeTags.filter((item) => galleryTagKey(item) !== key),
    )
  else
    emit(
      'update:excludeTags',
      props.excludeTags.filter((item) => galleryTagKey(item) !== key),
    )
}
function selectedMode(tag: SearchableTag) {
  const key = galleryTagKey(tag)
  return props.includeTags.some((item) => galleryTagKey(item) === key)
    ? 'include'
    : props.excludeTags.some((item) => galleryTagKey(item) === key)
      ? 'exclude'
      : ''
}
onMounted(() => void loadNamespaces())
onBeforeUnmount(() => {
  disposed = true
  searchVersion++
  clearTimeout(timer)
})
</script>
<template>
  <div class="tag-picker">
    <div class="tag-search">
      <label :for="searchId">{{ t('搜索标签') }}</label>
      <TextField
        :id="searchId"
        v-model="keyword"
        clearable
        :placeholder="t('搜索中文、原名或别名')"
        :aria-label="t('搜索标签')"
      >
        <template #prefix><Search :size="16" /></template>
      </TextField>
      <div v-if="searching" class="tag-search-scope">
        <span>{{ t('查找范围') }}</span>
        <SegmentedControl
          v-model="searchScope"
          :aria-label="t('标签查找范围')"
          :options="[
            { label: t('所有标签分组'), value: 'all' },
            {
              label: t('仅 {p0}', { p0: activeNamespaceLabel || t('当前分组') }),
              value: 'current',
              disabled: !activeNamespace,
            },
          ]"
        />
      </div>
    </div>
    <div class="selected-trays">
      <details open>
        <summary>
          {{ t('包含') }}<span>{{ includeTags.length }}</span>
        </summary>
        <div class="selected-tray">
          <SearchConditionChip
            v-for="tag in includeTags"
            :key="galleryTagKey(tag)"
            :label="locale === 'en' ? tag.master : tag.displayName"
            :title="t('包含 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
            removable
            @remove="remove(tag, 'include')"
          />
          <span v-if="!includeTags.length" class="tray-placeholder">{{ t('想看到的标签') }}</span>
        </div>
      </details>
      <details open>
        <summary>
          {{ t('排除') }}<span>{{ excludeTags.length }}</span>
        </summary>
        <div class="selected-tray">
          <SearchConditionChip
            v-for="tag in excludeTags"
            :key="galleryTagKey(tag)"
            :label="locale === 'en' ? tag.master : tag.displayName"
            :title="t('排除 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
            excluded
            removable
            @remove="remove(tag, 'exclude')"
          />
          <span v-if="!excludeTags.length" class="tray-placeholder">{{ t('不想看到的标签') }}</span>
        </div>
      </details>
    </div>
    <p v-if="error" class="field-error" role="alert">
      {{ t(error) }}
      <ActionButton
        size="sm"
        @click="namespaces.length ? runSearch(++searchVersion) : loadNamespaces()"
        >{{ t('重试') }}</ActionButton
      >
    </p>
    <div class="picker-body">
      <nav class="namespace-list" :aria-label="t('标签命名空间')" :aria-busy="loadingNamespaces">
        <button
          v-for="item in namespaces"
          :key="item.namespace"
          type="button"
          :aria-pressed="item.namespace === activeNamespace"
          @click="selectNamespace(item.namespace)"
        >
          <span>{{ locale === 'en' ? item.namespace : item.displayName }}</span
          ><small>{{ item.count }}</small>
        </button>
      </nav>
      <section class="tag-results">
        <header>
          <span>{{ searching ? t('查找结果') : activeNamespaceLabel || t('加载标签索引…') }}</span
          ><small>{{
            searching ? t('最多显示 50 条，可继续输入缩小范围') : t('{p0} 个主标签', { p0: total })
          }}</small
          ><span v-if="loadingSearch || pendingPages" class="tag-loading" role="status">{{
            t('加载中…')
          }}</span>
        </header>
        <div
          ref="listElement"
          class="virtual-tag-list"
          :aria-busy="loadingSearch"
          @scroll="handleScroll"
        >
          <div :style="{ height: `${listHeight}px`, position: 'relative' }">
            <div
              v-for="row in visibleRows"
              :key="`${searching ? 'search' : activeNamespace}-${row.index}`"
              class="tag-option"
              :data-selected="row.tag && selectedMode(row.tag)"
              :style="{ transform: `translateY(${row.index * rowHeight}px)` }"
            >
              <template v-if="row.tag"
                ><div class="tag-name">
                  <strong>{{
                    locale === 'en' ? row.tag.master : row.tag.displayName || row.tag.master
                  }}</strong
                  ><small :title="t(`${row.tag.namespace}:${row.tag.master}`)"
                    >{{ row.tag.namespace }}:{{ row.tag.master }}</small
                  >
                </div>
                <div class="tag-actions">
                  <button
                    type="button"
                    :aria-label="
                      t('包含 {p0}', { p0: locale === 'en' ? row.tag.master : row.tag.displayName })
                    "
                    :aria-pressed="selectedMode(row.tag) === 'include'"
                    @click="toggleTag(row.tag, 'include')"
                  >
                    <component
                      :is="selectedMode(row.tag) === 'include' ? Check : Plus"
                      :size="13"
                    />{{ t('包含') }}</button
                  ><button
                    type="button"
                    class="exclude"
                    :aria-label="
                      t('排除 {p0}', { p0: locale === 'en' ? row.tag.master : row.tag.displayName })
                    "
                    :aria-pressed="selectedMode(row.tag) === 'exclude'"
                    @click="toggleTag(row.tag, 'exclude')"
                  >
                    <Minus :size="13" />{{ t('排除') }}
                  </button>
                </div></template
              ><span v-else class="tag-loading">{{ t('加载中…') }}</span>
            </div>
          </div>
          <EmptyState
            v-if="searching && !loadingSearch && !searchResults.length"
            :description="t('没有匹配的标签，试试原名或其他关键词')"
          />
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.selected-trays {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 14px 0 20px;
}
.selected-trays details {
  min-width: 0;
}
.selected-trays summary {
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}
.selected-trays summary > span {
  color: var(--muted-foreground);
  margin-left: 6px;
}
.selected-tray {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 8px;
  min-height: 40px;
  padding-top: 8px;
}
.tray-placeholder {
  font-size: 12px;
  color: var(--muted-foreground);
}
.tag-search {
  display: grid;
  gap: 8px;
}
.tag-search > label {
  color: var(--text);
  font-size: 13px;
}
.tag-search-scope {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.tag-search-scope > span {
  color: var(--muted-foreground);
  font-size: 12px;
}
.picker-body {
  display: grid;
  grid-template-columns: 155px minmax(0, 1fr);
  border-top: 1px solid var(--border-soft);
}
.namespace-list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow-y: auto;
  padding: 8px 12px 8px 0;
  border-right: 1px solid var(--border-soft);
}
.namespace-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  padding: 9px;
  font-size: 12px;
  text-align: left;
  transition:
    background-color var(--motion-fast),
    color var(--motion-fast);
}
.namespace-list button[aria-pressed='true'] {
  background: var(--accent-soft);
  color: var(--accent);
}
.namespace-list small {
  color: var(--muted-foreground);
  font-size: 10px;
}
.tag-results {
  min-width: 0;
}
.tag-results header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-height: 40px;
  padding: 8px 12px;
  gap: 8px;
  font-size: 12px;
}
.tag-results header small,
.tag-loading {
  color: var(--muted-foreground);
  font-size: 11px;
}
.virtual-tag-list {
  height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tag-option {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-soft);
}
.tag-name {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.tag-name strong,
.tag-name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-name strong {
  font-size: 13px;
  font-weight: 500;
}
.tag-name small {
  font-size: 11px;
  color: var(--muted-foreground);
}
.tag-actions {
  display: flex;
  gap: 5px;
  flex: none;
}
.tag-actions button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 36px;
  padding: 5px 8px;
  font-size: 11px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  transition:
    background-color var(--motion-fast),
    color var(--motion-fast);
}
.tag-actions button[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent-ring);
  color: var(--accent);
}
.tag-actions button.exclude[aria-pressed='true'] {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}
@media (max-width: 767px) {
  .selected-trays {
    gap: 12px;
  }
  .picker-body {
    display: block;
  }
  .namespace-list {
    flex-direction: row;
    padding: 8px 0;
    gap: 6px;
    border-right: 0;
    border-bottom: 1px solid var(--border-soft);
    overflow-x: auto;
  }
  .namespace-list button {
    flex: none;
    min-height: 44px;
  }
  .namespace-list small {
    display: none;
  }
  .tag-option {
    padding: 8px 0;
    gap: 6px;
  }
  .tag-actions {
    gap: 4px;
  }
  .tag-actions button {
    min-height: 44px;
    padding: 5px 7px;
  }
  .tag-actions svg {
    display: none;
  }
  .virtual-tag-list {
    height: min(320px, 40dvh);
  }
  .tag-results header {
    padding-inline: 0;
  }
}
</style>
