<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, TrendCharts, Warning } from '@element-plus/icons-vue'
import BookItem from '@/components/BookItem.vue'
import { bookListBusi } from '@/core/busi/bookListBusi'
import type { bookItem } from '@/core/model/book/bookOutput'
import { popularInput } from '@/core/model/book/popularInput'

const books = ref<bookItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

const featuredBooks = computed(() => books.value.slice(0, 3))
const regularBooks = computed(() => books.value.slice(3))

async function fetchPopularBooks() {
  loading.value = true
  errorMessage.value = ''

  try {
    const busi = new bookListBusi()
    const result = await busi.getPopularList(new popularInput())

    if (result.isSuccess) {
      books.value = result.data ?? []
      return
    }

    books.value = []
    errorMessage.value = result.msg || '获取最近流行画册失败'
  } catch (error) {
    books.value = []
    errorMessage.value = error instanceof Error ? error.message : '获取最近流行画册失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchPopularBooks()
})
</script>

<template>
  <div class="home-view">
    <section class="home-hero">
      <div class="hero-copy">
        <div class="hero-kicker">
          <el-icon><TrendCharts /></el-icon>
          <span>Popular Now</span>
        </div>
        <h1>
          <span>最近流行画册</span>
        </h1>
        <p>看看当前热度最高的一批画册，进入详情继续阅读。</p>
      </div>

      <div class="hero-actions">
        <button
          class="hero-count-button"
          :class="{ 'is-loading': loading }"
          type="button"
          :disabled="loading"
          aria-label="刷新最近流行画册"
          @click="fetchPopularBooks"
        >
          <el-icon v-if="loading" class="hero-count-loading"><Refresh /></el-icon>
          <span v-else class="hero-count">{{ books.length }}</span>
        </button>
      </div>
    </section>

    <el-skeleton v-if="loading && books.length === 0" animated>
      <template #template>
        <div class="home-skeleton">
          <div v-for="index in 9" :key="index" class="skeleton-card">
            <el-skeleton-item variant="image" class="skeleton-cover" />
            <div class="skeleton-lines">
              <el-skeleton-item variant="h3" />
              <el-skeleton-item variant="text" />
              <el-skeleton-item variant="text" />
            </div>
          </div>
        </div>
      </template>
    </el-skeleton>

    <el-alert v-else-if="errorMessage" class="state-alert" type="error" :closable="false" show-icon>
      <template #title>
        <span class="alert-title">
          <el-icon><Warning /></el-icon>
          {{ errorMessage }}
        </span>
      </template>
      <el-button size="small" :icon="Refresh" :loading="loading" @click="fetchPopularBooks">
        重新加载
      </el-button>
    </el-alert>

    <el-empty v-else-if="!loading && books.length === 0" description="暂无流行画册">
      <el-button type="primary" :icon="Refresh" @click="fetchPopularBooks">重新加载</el-button>
    </el-empty>

    <div v-else class="home-content" v-loading="loading">
      <section v-if="featuredBooks.length > 0" class="featured-section">
        <BookItem
          v-for="book in featuredBooks"
          :key="book.bookId"
          :book="book"
          class="featured-book"
        />
      </section>

      <section v-if="regularBooks.length > 0" class="popular-section">
        <div class="section-heading">
          <h2>更多流行</h2>
          <span>{{ regularBooks.length }} 本</span>
        </div>

        <div class="popular-grid">
          <BookItem
            v-for="book in regularBooks"
            :key="book.bookId"
            :book="book"
            class="popular-book"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

.home-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgba(64, 158, 255, 0.14), transparent 42%),
    linear-gradient(315deg, rgba(103, 194, 58, 0.12), transparent 46%), var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.hero-kicker .el-icon {
  font-size: 16px;
}

.home-hero h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  align-self: stretch;
  min-width: 150px;
  flex-shrink: 0;
}

.hero-count-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 124px;
  min-height: 86px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  outline: none;
}

.hero-count-button:disabled {
  cursor: default;
}

.hero-count {
  display: inline-block;
  color: transparent;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
  background-clip: text;
  -webkit-background-clip: text;
  font-size: 68px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 10px 30px rgba(64, 158, 255, 0.32);
  transition:
    filter 0.18s ease,
    transform 0.18s ease;
}

.hero-count-button:hover .hero-count,
.hero-count-button:focus-visible .hero-count {
  filter: drop-shadow(0 0 14px rgba(103, 194, 58, 0.34));
  transform: translateY(-2px) scale(1.04);
}

.hero-count-button:focus-visible {
  border-radius: 8px;
  box-shadow: 0 0 0 3px var(--el-color-primary-light-7);
}

.hero-count-loading {
  color: var(--el-color-primary);
  font-size: 54px;
  filter: drop-shadow(0 10px 26px rgba(64, 158, 255, 0.32));
  animation: hero-count-spin 0.9s linear infinite;
}

@keyframes hero-count-spin {
  to {
    transform: rotate(360deg);
  }
}

.home-hero p {
  margin: 10px 0 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.6;
}

.home-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 180px;
}

.featured-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.featured-book {
  background-color: var(--el-bg-color);
  border-color: var(--el-color-primary-light-7);
}

.popular-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.section-heading h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
}

.section-heading span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.popular-grid,
.home-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 12px;
}

.popular-book {
  background-color: var(--el-bg-color);
}

.skeleton-card {
  display: flex;
  gap: 12px;
  height: 160px;
  padding: 12px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.skeleton-cover {
  width: 100px;
  height: 136px;
  flex-shrink: 0;
  border-radius: 6px;
}

.skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding-top: 6px;
}

.state-alert {
  align-items: flex-start;
}

.alert-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

html.dark .home-hero {
  background:
    linear-gradient(135deg, rgba(64, 158, 255, 0.18), transparent 42%),
    linear-gradient(315deg, rgba(103, 194, 58, 0.1), transparent 46%), var(--el-bg-color);
}

@media (max-width: 1024px) {
  .featured-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home-hero {
    align-items: center;
    padding: 18px;
    margin-bottom: 14px;
  }

  .home-hero h1 {
    font-size: 24px;
  }

  .hero-count {
    font-size: 56px;
  }

  .hero-actions {
    justify-content: flex-end;
    min-width: 0;
  }

  .hero-count-button {
    width: 104px;
    min-height: 70px;
  }

  .hero-count-loading {
    font-size: 44px;
  }

  .popular-grid,
  .home-skeleton {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .home-hero {
    padding: 14px;
    border-radius: 6px;
  }

  .home-hero h1 {
    font-size: 21px;
  }

  .hero-count {
    font-size: 48px;
  }

  .hero-count-button {
    width: 92px;
    min-height: 62px;
  }

  .hero-count-loading {
    font-size: 38px;
  }

  .home-hero p {
    font-size: 13px;
  }

  .hero-copy {
    max-width: calc(100% - 100px);
  }

  .home-content {
    gap: 14px;
  }

  .skeleton-card {
    height: auto;
    min-height: 120px;
    padding: 8px;
  }

  .skeleton-cover {
    width: 70px;
    height: 104px;
  }
}
</style>
