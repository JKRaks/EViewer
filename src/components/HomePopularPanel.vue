<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, TrendCharts, Warning } from '@element-plus/icons-vue'
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
    errorMessage.value = result.msg || '获取最近流行画册失败'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '获取最近流行画册失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => void fetchPopularBooks())
</script>

<template>
  <div class="popular-panel">
    <header class="panel-header">
      <slot name="navigation" />
      <div>
        <div class="panel-kicker">
          <el-icon><TrendCharts /></el-icon> Popular Now
        </div>
        <h1>最近流行画册</h1>
        <p>当前热度较高的画册。</p>
      </div>
      <el-button
        circle
        :icon="Refresh"
        :loading="loading"
        aria-label="刷新最近流行"
        @click="fetchPopularBooks"
      />
    </header>

    <el-skeleton v-if="loading && books.length === 0" animated>
      <template #template>
        <div class="skeleton-grid">
          <div v-for="index in 9" :key="index" class="skeleton-item">
            <el-skeleton-item variant="image" class="skeleton-cover" />
            <el-skeleton-item variant="text" />
          </div>
        </div>
      </template>
    </el-skeleton>

    <el-alert v-else-if="errorMessage && books.length === 0" type="error" :closable="false">
      <template #title
        ><el-icon><Warning /></el-icon> {{ errorMessage }}</template
      >
      <el-button size="small" :icon="Refresh" @click="fetchPopularBooks">重新加载</el-button>
    </el-alert>

    <el-empty v-else-if="books.length === 0" description="暂无流行画册" />

    <div v-else class="popular-content" v-loading="loading">
      <section class="featured-grid">
        <BookItem v-for="book in featuredBooks" :key="book.bookId" :book="book" />
      </section>
      <section v-if="regularBooks.length" class="regular-section">
        <div class="section-title">
          <h2>更多流行</h2>
          <span>{{ regularBooks.length }} 本</span>
        </div>
        <div class="regular-grid">
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
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.panel-header > div {
  min-width: 0;
  flex: 1;
}
.panel-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 600;
}
.panel-header h1 {
  margin: 5px 0 0;
  color: var(--el-text-color-primary);
  font-size: 26px;
  line-height: 1.3;
}
.panel-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
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
  color: var(--el-text-color-secondary);
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
  border: 1px solid var(--el-border-color-lighter);
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
</style>
