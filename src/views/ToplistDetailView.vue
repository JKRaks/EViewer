<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t, getDisplayLocale } from '@/i18n'

import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import Notice from '@/components/primitives/Notice.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import PageNavigation from '@/components/primitives/PageNavigation.vue'
import BackToTop from '@/components/primitives/BackToTop.vue'
import { computed, ref, watch } from 'vue'
import { RefreshCw as Refresh, Trophy, TriangleAlert as Warning } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import BookItem from '@/components/BookItem.vue'
import { toplistBusi } from '@/core/books/toplistBusi'
import { toplistInput } from '@/core/model/book/toplistInput'
import {
  buildToplistCode,
  toplistCategoryOptions,
  toplistPeriodOptions,
  type contributorToplistEntry,
  type galleryToplistEntry,
  type toplistKind,
} from '@/core/model/book/toplistOutput'

defineOptions({ name: 'ToplistDetailView' })

const route = useRoute()
const router = useRouter()
const category = ref(1)
const period = ref(5)
const currentPage = ref(1)
const totalPages = ref(1)
const kind = ref<toplistKind>('gallery')
const galleryEntries = ref<galleryToplistEntry[]>([])
const contributorEntries = ref<contributorToplistEntry[]>([])
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const errorMessage = ref('')
let requestVersion = 0

const activeCategory = computed(() =>
  toplistCategoryOptions.find((item) => item.value === category.value),
)
const activePeriod = computed(() =>
  toplistPeriodOptions.find((item) => item.value === period.value),
)
const title = computed(() =>
  t('{p0} · {p1}', {
    p0: t(activeCategory.value?.label ?? '画册'),
    p1: t(activePeriod.value?.label ?? '昨日'),
  }),
)

function normalizeRoute() {
  const rawTl = Number(route.query.tl)
  const rawCategory = Math.floor(rawTl / 10)
  const rawPeriod = rawTl % 10
  category.value = toplistCategoryOptions.some((item) => item.value === rawCategory)
    ? rawCategory
    : 1
  period.value = toplistPeriodOptions.some((item) => item.value === rawPeriod) ? rawPeriod : 5
  const page = Number(route.query.p)
  currentPage.value = Number.isInteger(page) && page >= 0 ? page + 1 : 1
}

async function fetchToplist() {
  const version = ++requestVersion
  const tl = buildToplistCode(category.value, period.value)
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await new toplistBusi().getDetail(new toplistInput(tl, currentPage.value - 1))
    if (version !== requestVersion) return

    kind.value = result.kind
    totalPages.value = result.totalPages
    galleryEntries.value = (result.data ?? []).filter(
      (entry): entry is galleryToplistEntry => entry.kind === 'gallery',
    )
    contributorEntries.value = (result.data ?? []).filter(
      (entry): entry is contributorToplistEntry => entry.kind === 'contributor',
    )
    if (!result.isSuccess) errorMessage.value = result.msg || t('获取排行榜失败')
  } catch (error) {
    if (version === requestVersion) {
      galleryEntries.value = []
      contributorEntries.value = []
      errorMessage.value = error instanceof Error ? error.message : t('获取排行榜失败')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function updateToplist(nextCategory = category.value, nextPeriod = period.value, page = 1) {
  const tl = buildToplistCode(nextCategory, nextPeriod)
  void router.push({ name: 'toplists', query: { tl, p: page - 1 } })
}

function handleCategoryChange(value: number) {
  updateToplist(value, period.value)
}

function handlePeriodChange(value: number) {
  updateToplist(category.value, value)
}

function handlePageChange(page: number) {
  updateToplist(category.value, period.value, page)
}

function openContributor(entry: contributorToplistEntry) {
  void router.push({ name: 'booklist', query: { uploader: entry.username } })
}

watch(
  () => route.fullPath,
  () => {
    if (route.name !== 'toplists') return
    normalizeRoute()
    void fetchToplist()
  },
  { immediate: true },
)
</script>

<template>
  <div class="toplist-view">
    <header class="page-header">
      <div class="title-block">
        <div class="title-kicker">
          <IconFrame><Trophy /></IconFrame> {{ t('EHG 排行榜') }}
        </div>
        <h1>{{ t(title) }}</h1>
        <p>{{ kind === 'gallery' ? t('画册榜单每页 50 项') : t('贡献者榜单每页 100 项') }}</p>
      </div>
      <div class="header-actions">
        <ActionButton
          size="icon"
          :icon="Refresh"
          :loading="loading"
          :aria-label="t('刷新排行榜')"
          @click="fetchToplist"
        />
      </div>
    </header>

    <section class="ranking-controls">
      <label>
        <span>{{ t('排行分区') }}</span>
        <SelectField :model-value="category" @change="handleCategoryChange">
          <option
            v-for="item in toplistCategoryOptions"
            :key="item.value"
            :label="t(item.label)"
            :value="item.value"
          ></option>
        </SelectField>
      </label>
      <label>
        <span>{{ t('统计周期') }}</span>
        <SelectField :model-value="period" @change="handlePeriodChange">
          <option
            v-for="item in toplistPeriodOptions"
            :key="item.value"
            :label="t(item.label)"
            :value="item.value"
          ></option>
        </SelectField>
      </label>
    </section>

    <Notice v-if="errorMessage && !loading" tone="error" :closable="false" class="state-alert">
      <template #title
        ><IconFrame><Warning /></IconFrame> {{ t(errorMessage) }}</template
      >
      <ActionButton size="sm" :icon="Refresh" @click="fetchToplist">{{
        t('重新加载')
      }}</ActionButton>
    </Notice>

    <div class="ranking-content" v-busy="loading">
      <div v-if="kind === 'gallery' && galleryEntries.length" class="gallery-grid gallery-masonry">
        <BookItem
          v-for="entry in galleryEntries"
          :key="entry.book.bookId"
          :book="entry.book"
          :rank="entry.rank"
          :score="entry.score"
        />
      </div>

      <div v-else-if="kind === 'contributor' && contributorEntries.length" class="contributor-grid">
        <button
          v-for="entry in contributorEntries"
          :key="entry.rank"
          type="button"
          class="contributor-row"
          @click="openContributor(entry)"
        >
          <span class="contributor-rank">#{{ entry.rank }}</span>
          <span class="contributor-name">{{ entry.username }}</span>
          <span class="contributor-score">{{
            entry.score?.toLocaleString(getDisplayLocale())
          }}</span>
        </button>
      </div>

      <EmptyState v-else-if="!loading && !errorMessage" :description="t('当前榜单暂无数据')" />
    </div>

    <PageNavigation
      v-if="totalPages > 1"
      class="ranking-pagination"
      layout="prev, pager, next"
      :current-page="currentPage"
      :page-count="totalPages"
      :pager-count="5"
      @current-change="handlePageChange"
    />
    <BackToTop :bottom="100" />
  </div>
</template>

<style scoped>
.toplist-view {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 2px;
  border-bottom: 1px solid var(--border-soft);
}
.title-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}
.page-header h1 {
  margin: 5px 0 0;
  font-size: 26px;
}
.page-header p {
  margin: 5px 0 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.ranking-controls {
  display: flex;
  gap: 16px;
  padding: 16px 2px;
}
.ranking-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
}
.ranking-controls .ui-select {
  width: 170px;
}
.state-alert {
  margin-bottom: 14px;
}
.ranking-content {
  min-height: 240px;
}
.gallery-grid {
  columns: 360px;
  column-gap: 12px;
}
.gallery-grid :deep(.book-item) {
  display: flex;
  width: 100%;
  margin-bottom: 12px;
  break-inside: avoid;
}
.contributor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px 24px;
  border-top: 1px solid var(--border-soft);
}
.contributor-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 8px 6px;
  color: var(--foreground);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-soft);
  cursor: pointer;
  text-align: left;
}
.contributor-row:hover {
  color: var(--accent);
  background-color: var(--muted);
}
.contributor-rank {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 700;
}
.contributor-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.contributor-score {
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
.ranking-pagination {
  justify-content: center;
  margin-top: 22px;
}
@media (max-width: 768px) {
  .page-header {
    padding-top: 10px;
  }
  .page-header h1 {
    font-size: 22px;
  }
  .page-header p {
    display: none;
  }
  .ranking-controls {
    gap: 10px;
  }
  .ranking-controls label {
    flex: 1;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
  }
  .ranking-controls .ui-select {
    width: 100%;
  }
  .gallery-grid {
    columns: 1;
  }
  .contributor-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .contributor-row {
    grid-template-columns: 48px minmax(0, 1fr) auto;
  }
}
.gallery-grid {
  display: grid;
  columns: auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 26px 22px;
}
.gallery-grid > :deep(.book-item) {
  margin: 0;
}
.gallery-grid > .ui-empty,
.gallery-grid > .load-more-trigger,
.gallery-grid > .loading-more,
.gallery-grid > .no-more {
  grid-column: 1/-1;
}
@media (max-width: 1050px) {
  .gallery-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .gallery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
}
</style>
