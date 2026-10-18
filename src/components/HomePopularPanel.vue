<script setup lang="ts">
import { t } from '@/i18n'

import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import SkeletonLine from '@/components/primitives/SkeletonLine.vue'
import Notice from '@/components/primitives/Notice.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, onMounted, ref } from 'vue'
import {
  RefreshCw as Refresh,
  TrendingUp as TrendCharts,
  TriangleAlert as Warning,
} from '@lucide/vue'
import BookItem from '@/components/BookItem.vue'
import { bookListBusi } from '@/core/books/bookListBusi'
import type { bookItem } from '@/core/model/book/bookOutput'
import { popularInput } from '@/core/model/book/popularInput'

defineOptions({ name: 'HomePopularPanel' })

const books = ref<bookItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const featuredBooks = computed(() => books.value.slice(0, 3))
const regularBooks = computed(() => books.value.slice(3))

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
        <div class="skeleton-grid">
          <div v-for="index in 9" :key="index" class="skeleton-item">
            <SkeletonLine variant="image" class="skeleton-cover" />
            <SkeletonLine variant="text" />
          </div>
        </div>
      </template>
    </SkeletonBlock>

    <Notice v-else-if="errorMessage && books.length === 0" tone="error" :closable="false">
      <template #title
        ><IconFrame><Warning /></IconFrame> {{ t(errorMessage) }}</template
      >
      <ActionButton size="sm" :icon="Refresh" @click="fetchPopularBooks">{{
        t('重新加载')
      }}</ActionButton>
    </Notice>

    <EmptyState v-else-if="books.length === 0" :description="t('暂无流行画册')" />

    <div v-else class="popular-content" v-busy="loading">
      <section class="featured-grid gallery-masonry">
        <BookItem v-for="book in featuredBooks" :key="book.bookId" :book="book" />
      </section>
      <section v-if="regularBooks.length" class="regular-section">
        <div class="section-title">
          <h2>{{ t('更多流行') }}</h2>
          <span>{{ t('{p0} 本', { p0: regularBooks.length }) }}</span>
        </div>
        <div class="regular-grid gallery-masonry">
          <BookItem v-for="book in regularBooks" :key="book.bookId" :book="book" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.popular-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
.popular-content,
.regular-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.featured-grid {
  columns: 3 360px;
  column-gap: 14px;
}
.featured-grid :deep(.book-item),
.regular-grid :deep(.book-item) {
  display: flex;
  width: 100%;
  margin-bottom: 12px;
  break-inside: avoid;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-title h2 {
  margin: 0;
  font-size: 18px;
}
.section-title span {
  color: var(--muted-foreground);
  font-size: 13px;
}
.regular-grid {
  columns: 360px;
  column-gap: 12px;
}
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}
.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 148px;
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
}
.skeleton-cover {
  width: 92px;
  height: 126px;
  flex-shrink: 0;
}
@media (max-width: 1024px) {
  .featured-grid {
    columns: 1;
  }
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
  .regular-grid,
  .featured-grid {
    columns: 1;
  }
}
.featured-grid,
.regular-grid {
  display: grid;
  columns: auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 26px 22px;
}
.featured-grid > :deep(.book-item),
.regular-grid > :deep(.book-item) {
  margin: 0;
}
.featured-grid > .ui-empty,
.featured-grid > .load-more-trigger,
.featured-grid > .loading-more,
.featured-grid > .no-more,
.regular-grid > .ui-empty,
.regular-grid > .load-more-trigger,
.regular-grid > .loading-more,
.regular-grid > .no-more {
  grid-column: 1/-1;
}
@media (max-width: 1050px) {
  .featured-grid,
  .regular-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .featured-grid,
  .regular-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
}
</style>
