<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import IconFrame from '@/components/primitives/IconFrame.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import SkeletonLine from '@/components/primitives/SkeletonLine.vue'
import Notice from '@/components/primitives/Notice.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { onMounted, ref } from 'vue'
import { ArrowRight, RefreshCw as Refresh, Trophy } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import BookItem from '@/components/BookItem.vue'
import { toplistBusi } from '@/core/books/toplistBusi'
import { toplistInput } from '@/core/model/book/toplistInput'
import type { galleryToplistEntry } from '@/core/model/book/toplistOutput'

defineOptions({ name: 'HomeYesterdayPanel' })

const entries = ref<galleryToplistEntry[]>([])
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const errorMessage = ref('')
let requestVersion = 0

async function fetchYesterday() {
  if (loading.value) return
  const version = ++requestVersion
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await new toplistBusi().getDetail(new toplistInput(15, 0))
    if (version !== requestVersion) return
    if (result.isSuccess) {
      entries.value = (result.data ?? []).filter(
        (entry): entry is galleryToplistEntry => entry.kind === 'gallery',
      )
      return
    }
    errorMessage.value = result.msg || t('获取昨日热门失败')
  } catch (error) {
    if (version === requestVersion) {
      errorMessage.value = error instanceof Error ? error.message : t('获取昨日热门失败')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

onMounted(() => void fetchYesterday())
</script>

<template>
  <div class="yesterday-panel">
    <header class="panel-header">
      <div>
        <div class="panel-kicker">
          <IconFrame><Trophy /></IconFrame> {{ t('每日榜单') }}
        </div>
        <h1>{{ t('昨日热门画册') }}</h1>
        <p>{{ t('按昨日榜单积分排列。') }}</p>
      </div>
      <RouterLink class="view-more-link" :to="{ name: 'toplists', query: { tl: 15, p: 0 } }">
        <span>{{ t('查看更多') }}</span>
        <IconFrame><ArrowRight /></IconFrame>
      </RouterLink>
    </header>

    <slot name="navigation" />

    <SkeletonBlock v-if="loading && entries.length === 0">
      <template #template>
        <div class="ranking-grid gallery-masonry">
          <SkeletonLine v-for="index in 12" :key="index" variant="rect" class="skeleton-item" />
        </div>
      </template>
    </SkeletonBlock>
    <Notice
      v-else-if="errorMessage && entries.length === 0"
      class="load-error"
      tone="error"
      :title="t('暂时无法加载')"
      :description="t(errorMessage)"
    >
      <ActionButton class="retry-button" size="sm" :icon="Refresh" @click="fetchYesterday">{{
        t('重新加载')
      }}</ActionButton>
    </Notice>
    <EmptyState v-else-if="entries.length === 0" :description="t('暂无昨日榜单数据')" />
    <div v-else class="ranking-grid gallery-masonry" v-busy="loading">
      <BookItem
        v-for="entry in entries"
        :key="entry.book.bookId"
        :book="entry.book"
        :rank="entry.rank"
        :score="entry.score"
      />
    </div>
  </div>
</template>

<style scoped>
.yesterday-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.load-error :deep(> div) {
  min-width: 0;
}
.load-error :deep(p) {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.load-error .retry-button {
  min-height: 44px;
  margin: 8px 0 0;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 2px;
  border-bottom: 1px solid var(--border-soft);
}
.panel-header > div {
  min-width: 0;
  flex: 1;
}
.panel-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}
.panel-header h1 {
  margin: 5px 0 0;
  color: var(--foreground);
  font-size: 26px;
  line-height: 1.3;
}
.panel-header p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}
.view-more-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--muted-foreground);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.15s ease;
}
.view-more-link:hover,
.view-more-link:focus-visible {
  color: var(--accent);
}
.ranking-grid {
  columns: 360px;
  column-gap: 12px;
}
.ranking-grid :deep(.book-item),
.skeleton-item {
  display: flex;
  width: 100%;
  margin-bottom: 12px;
  break-inside: avoid;
}
.skeleton-item {
  height: 160px;
  border-radius: 8px;
}
@media (max-width: 768px) {
  .panel-header {
    padding: 14px 2px;
  }
  .panel-header h1 {
    font-size: 22px;
  }
  .panel-header p {
    display: none;
  }
  .ranking-grid {
    columns: 1;
  }
}
.ranking-grid {
  display: grid;
  columns: auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 26px 22px;
}
.ranking-grid > :deep(.book-item) {
  margin: 0;
}
.ranking-grid > .ui-empty,
.ranking-grid > .load-more-trigger,
.ranking-grid > .loading-more,
.ranking-grid > .no-more {
  grid-column: 1/-1;
}
@media (max-width: 1050px) {
  .ranking-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .ranking-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
}
</style>
