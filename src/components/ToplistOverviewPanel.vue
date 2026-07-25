<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Refresh, Warning } from '@element-plus/icons-vue'
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
    errorMessage.value = result.msg || '获取排行总览失败'
  } catch (error) {
    if (version === requestVersion) {
      errorMessage.value = error instanceof Error ? error.message : '获取排行总览失败'
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
      <slot name="navigation" />
      <div>
        <h1>排行总览</h1>
        <p>七个榜单分区的前十名汇总。</p>
      </div>
      <el-button
        circle
        :icon="Refresh"
        :loading="loading"
        aria-label="刷新排行总览"
        @click="fetchOverview"
      />
    </header>

    <el-tabs v-model="activePeriod" class="period-tabs" stretch>
      <el-tab-pane
        v-for="period in toplistPeriodOptions"
        :key="period.value"
        :label="period.label"
        :name="period.value"
      />
    </el-tabs>

    <el-skeleton v-if="loading && sections.length === 0" :rows="12" animated />
    <el-alert v-else-if="errorMessage && sections.length === 0" type="error" :closable="false">
      <template #title
        ><el-icon><Warning /></el-icon> {{ errorMessage }}</template
      >
      <el-button size="small" :icon="Refresh" @click="fetchOverview">重新加载</el-button>
    </el-alert>
    <el-empty v-else-if="visibleSections.length === 0" description="暂无排行总览数据" />

    <div v-else class="section-grid" v-loading="loading">
      <section v-for="section in visibleSections" :key="section.tl" class="ranking-section">
        <header class="section-header">
          <div>
            <h2>{{ categoryNames.get(section.category) }}</h2>
            <span>Top 10</span>
          </div>
          <RouterLink
            class="view-more-link"
            :to="{ name: 'toplists', query: { tl: section.tl, p: 0 } }"
          >
            <span>查看更多</span>
            <el-icon><ArrowRight /></el-icon>
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
  color: var(--el-text-color-secondary);
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
  border-top: 2px solid var(--el-color-primary-light-5);
  border-bottom: 1px solid var(--el-border-color-lighter);
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
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}
.view-more-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-decoration: none;
  transition: color 0.15s ease;
}
.view-more-link:hover,
.view-more-link:focus-visible {
  color: var(--el-color-primary);
}
.ranking-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 7px 5px;
  color: var(--el-text-color-primary);
  background: transparent;
  border: 0;
  border-top: 1px solid var(--el-border-color-extra-light);
  cursor: pointer;
  text-align: left;
}
.ranking-row:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.rank {
  color: var(--el-text-color-secondary);
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
  .period-tabs :deep(.el-tabs__item) {
    padding: 0 8px;
    font-size: 13px;
  }
}
</style>
