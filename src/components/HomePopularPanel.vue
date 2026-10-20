<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import SkeletonLine from '@/components/primitives/SkeletonLine.vue'
import Notice from '@/components/primitives/Notice.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { onMounted, ref } from 'vue'
import { RefreshCw as Refresh, TrendingUp as TrendCharts } from '@lucide/vue'
import BookItem from '@/components/BookItem.vue'
import { bookListBusi } from '@/core/books/bookListBusi'
import type { bookItem } from '@/core/model/book/bookOutput'
import { popularInput } from '@/core/model/book/popularInput'

defineOptions({ name: 'HomePopularPanel' })

const books = ref<bookItem[]>([])
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const errorMessage = ref('')

async function fetchPopularBooks() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await new bookListBusi().getPopularList(new popularInput())
    if (result.isSuccess) {
      books.value = result.data ?? []
      return
    }
    errorMessage.value = result.msg || t('获取最近流行画册失败')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('获取最近流行画册失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => void fetchPopularBooks())
</script>

<template>
  <div class="popular-panel">
    <header class="panel-header">
      <div>
        <div class="panel-kicker">
          <IconFrame><TrendCharts /></IconFrame> {{ t('当前流行') }}
        </div>
        <h1>{{ t('最近流行画册') }}</h1>
        <p>{{ t('当前热度较高的画册。') }}</p>
      </div>
      <ActionButton
        size="icon"
        :icon="Refresh"
        :loading="loading"
        :aria-label="t('刷新最近流行')"
        @click="fetchPopularBooks"
      />
    </header>

    <slot name="navigation" />

    <SkeletonBlock v-if="loading && books.length === 0">
      <template #template>
        <div class="popular-grid skeleton-grid" aria-hidden="true">
          <div v-for="index in 12" :key="index" class="skeleton-item">
            <SkeletonLine variant="image" class="skeleton-cover" />
            <div class="skeleton-info">
              <div class="skeleton-title">
                <SkeletonLine />
                <SkeletonLine class="skeleton-title-short" />
              </div>
              <div class="skeleton-meta"><SkeletonLine /><SkeletonLine /></div>
              <div class="skeleton-tags"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>
              <SkeletonLine class="skeleton-date" />
            </div>
          </div>
        </div>
      </template>
    </SkeletonBlock>

    <Notice
      v-else-if="errorMessage && books.length === 0"
      class="load-error"
      tone="error"
      :title="t('暂时无法加载')"
      :description="t(errorMessage)"
    >
      <ActionButton class="retry-button" size="sm" :icon="Refresh" @click="fetchPopularBooks">{{
        t('重新加载')
      }}</ActionButton>
    </Notice>

    <EmptyState v-else-if="books.length === 0" :description="t('暂无流行画册')" />

    <div v-else class="popular-grid gallery-masonry" v-busy="loading">
      <BookItem v-for="book in books" :key="book.bookId" :book="book" />
    </div>
  </div>
</template>

<style scoped>
.popular-panel {
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
.popular-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 26px 22px;
}
.popular-grid :deep(.book-item) {
  display: flex;
  width: 100%;
  margin: 0;
}
.skeleton-item {
  min-width: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-soft);
}
.skeleton-item :deep(.ui-skeleton__item) {
  margin-bottom: 0;
}
.skeleton-cover {
  width: 100%;
  height: auto;
  min-height: 0;
  aspect-ratio: 3 / 4;
  border-radius: 3px 7px 7px 3px;
}
.skeleton-info {
  display: grid;
  gap: 8px;
  padding-top: 13px;
}
.skeleton-title {
  display: grid;
  align-content: space-around;
  min-height: 42px;
}
.skeleton-title-short {
  width: 72%;
}
.skeleton-meta,
.skeleton-tags {
  display: flex;
  gap: 6px;
}
.skeleton-meta > div {
  width: 44px;
}
.skeleton-tags > div {
  width: 22%;
  height: 22px;
}
.skeleton-date {
  width: 34%;
  height: 12px;
}
@media (max-width: 1050px) {
  .popular-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .panel-header {
    padding: 14px 2px;
  }
  .panel-header h1 {
    font-size: 22px;
  }
  .panel-header p {
    display: none;
  }
  .popular-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
  .skeleton-info {
    gap: 7px;
    padding-top: 10px;
  }
  .skeleton-title {
    min-height: 39px;
  }
}
</style>
