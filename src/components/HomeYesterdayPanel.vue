<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Refresh, Trophy, Warning } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'
import BookItem from '@/components/BookItem.vue'
import { toplistBusi } from '@/core/books/toplistBusi'
import { toplistInput } from '@/core/model/book/toplistInput'
import type { galleryToplistEntry } from '@/core/model/book/toplistOutput'

defineOptions({ name: 'HomeYesterdayPanel' })

const entries = ref<galleryToplistEntry[]>([])
const loading = ref(false)
const errorMessage = ref('')
let requestVersion = 0

const visibleEntries = computed(() => entries.value.slice(0, 12))

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
    errorMessage.value = result.msg || '获取昨日热门失败'
  } catch (error) {
    if (version === requestVersion) {
      errorMessage.value = error instanceof Error ? error.message : '获取昨日热门失败'
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
      <slot name="navigation" />
      <div>
        <div class="panel-kicker">
          <el-icon><Trophy /></el-icon> Daily Toplist
        </div>
        <h1>昨日热门画册</h1>
        <p>按昨日榜单积分排列。</p>
      </div>
      <RouterLink class="view-more-link" :to="{ name: 'toplists', query: { tl: 15, p: 0 } }">
        <span>查看更多</span>
        <el-icon><ArrowRight /></el-icon>
      </RouterLink>
    </header>

    <el-skeleton v-if="loading && entries.length === 0" animated>
      <template #template>
        <div class="ranking-grid">
          <el-skeleton-item v-for="index in 12" :key="index" variant="rect" class="skeleton-item" />
        </div>
      </template>
    </el-skeleton>
    <el-alert v-else-if="errorMessage && entries.length === 0" type="error" :closable="false">
      <template #title
        ><el-icon><Warning /></el-icon> {{ errorMessage }}</template
      >
      <el-button size="small" :icon="Refresh" @click="fetchYesterday">重新加载</el-button>
    </el-alert>
    <el-empty v-else-if="entries.length === 0" description="暂无昨日榜单数据" />
    <div v-else class="ranking-grid" v-loading="loading">
      <BookItem
        v-for="entry in visibleEntries"
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
.view-more-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.15s ease;
}
.view-more-link:hover,
.view-more-link:focus-visible {
  color: var(--el-color-primary);
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
</style>
