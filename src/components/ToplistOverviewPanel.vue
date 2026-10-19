<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import ActionButton from '@/components/primitives/ActionButton.vue'
import SectionTabs from '@/components/primitives/SectionTabs'
import SectionTab from '@/components/primitives/SectionTab.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import Notice from '@/components/primitives/Notice.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, RefreshCw as Refresh, TriangleAlert as Warning } from '@lucide/vue'
import { RouterLink, useRouter } from 'vue-router'
import { toplistBusi } from '@/core/books/toplistBusi'
import {
  toplistCategoryOptions,
  toplistPeriodOptions,
  type toplistEntry,
  type toplistOverviewSection,
} from '@/core/model/book/toplistOutput'

defineOptions({ name: 'ToplistOverviewPanel' })

const router = useRouter()
const sections = ref<toplistOverviewSection[]>([])
const activePeriod = ref(5)
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const errorMessage = ref('')
let requestVersion = 0

const categoryNames = new Map(toplistCategoryOptions.map((item) => [item.value, item.label]))
const visibleSections = computed(() =>
  toplistCategoryOptions
    .map((category) =>
      sections.value.find(
        (section) => section.category === category.value && section.period === activePeriod.value,
      ),
    )
    .filter((section): section is toplistOverviewSection => Boolean(section)),
)

async function fetchOverview() {
  if (loading.value) return
  const version = ++requestVersion
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await new toplistBusi().getOverview()
    if (version !== requestVersion) return
    if (result.isSuccess) {
      sections.value = result.data ?? []
      return
    }
    errorMessage.value = result.msg || t('获取排行总览失败')
  } catch (error) {
    if (version === requestVersion) {
      errorMessage.value = error instanceof Error ? error.message : t('获取排行总览失败')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function openEntry(entry: toplistEntry) {
  if (entry.kind === 'gallery') {
    void router.push({ name: 'bookinfo', query: { bookId: entry.book.bookId } })
    return
  }
  void router.push({ name: 'booklist', query: { uploader: entry.username } })
}

onMounted(() => void fetchOverview())
</script>

<template>
  <div class="overview-panel">
    <header class="overview-header">
      <div>
        <h1>{{ t('排行总览') }}</h1>
        <p>{{ t('七个榜单分区的前十名汇总。') }}</p>
      </div>
      <ActionButton
        size="icon"
        :icon="Refresh"
        :loading="loading"
        :aria-label="t('刷新排行总览')"
        @click="fetchOverview"
      />
    </header>

    <slot name="navigation" />

    <SectionTabs v-model="activePeriod" class="period-tabs">
      <SectionTab
        v-for="period in toplistPeriodOptions"
        :key="period.value"
        :label="t(period.label)"
        :name="period.value"
      />
    </SectionTabs>

    <SkeletonBlock v-if="loading && sections.length === 0" :rows="12" />
    <Notice v-else-if="errorMessage && sections.length === 0" tone="error" :closable="false">
      <template #title
        ><IconFrame><Warning /></IconFrame> {{ t(errorMessage) }}</template
      >
      <ActionButton size="sm" :icon="Refresh" @click="fetchOverview">{{
        t('重新加载')
      }}</ActionButton>
    </Notice>
    <EmptyState v-else-if="visibleSections.length === 0" :description="t('暂无排行总览数据')" />

    <div v-else class="section-grid" v-busy="loading">
      <section v-for="section in visibleSections" :key="section.tl" class="ranking-section">
        <header class="section-header">
          <div>
            <h2>{{ t(categoryNames.get(section.category)) }}</h2>
            <span>{{ t('前十名') }}</span>
          </div>
          <RouterLink
            class="view-more-link"
            :to="{ name: 'toplists', query: { tl: section.tl, p: 0 } }"
          >
            <span>{{ t('查看更多') }}</span>
            <IconFrame><ArrowRight /></IconFrame>
          </RouterLink>
        </header>
        <button
          v-for="entry in section.entries"
          :key="`${section.tl}-${entry.rank}`"
          type="button"
          class="ranking-row"
          @click="openEntry(entry)"
        >
          <span class="rank">#{{ entry.rank }}</span>
          <span class="entry-name">{{
            entry.kind === 'gallery' ? entry.book.bookTitle : entry.username
          }}</span>
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 2px 10px;
}
.overview-header > div {
  min-width: 0;
  flex: 1;
}
.overview-header h1 {
  margin: 0;
  font-size: 26px;
}
.overview-header p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}
.period-tabs {
  margin-bottom: 2px;
}
.section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 30px;
}
.ranking-section {
  min-width: 0;
  border-top: 2px solid var(--accent-ring);
  border-bottom: 1px solid var(--border-soft);
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 4px 8px;
}
.section-header > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.section-header h2 {
  margin: 0;
  font-size: 17px;
}
.section-header span {
  color: var(--placeholder);
  font-size: 11px;
}
.view-more-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  text-decoration: none;
  transition: color 0.15s ease;
}
.view-more-link:hover,
.view-more-link:focus-visible {
  color: var(--accent);
}
.ranking-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 7px 5px;
  color: var(--foreground);
  background: transparent;
  border: 0;
  border-top: 1px solid var(--border-soft);
  cursor: pointer;
  text-align: left;
}
.ranking-row:hover {
  background-color: var(--muted);
  color: var(--accent);
}
.rank {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 700;
}
.entry-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .overview-header {
    padding-top: 14px;
  }
  .overview-header h1 {
    font-size: 22px;
  }
  .overview-header p {
    display: none;
  }
  .section-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .period-tabs :deep(.ui-tabs__item) {
    padding: 0 8px;
    font-size: 13px;
  }
}
</style>
