<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import {
  clearReadingHistory,
  deleteReadingHistory,
  listReadingHistory,
} from '@/core/cache/readingHistory'
import type { ReadingHistoryRecord } from '@/core/cache/indexedDb'

const router = useRouter()
const settings = useIndexedDbCacheSettings()
const records = ref<ReadingHistoryRecord[]>([])
const loading = ref(true)

onMounted(() => void refresh())

async function refresh() {
  loading.value = true
  records.value = await listReadingHistory()
  loading.value = false
}

function openViewer(record: ReadingHistoryRecord, reading: 'start' | 'continue') {
  void router.push({ path: '/viewer', query: { bookId: record.bookId, reading } })
}

async function removeRecord(record: ReadingHistoryRecord) {
  try {
    await ElMessageBox.confirm(`删除「${record.title}」的浏览记录？`, '删除记录', { type: 'warning' })
    await deleteReadingHistory(record.bookId)
    await refresh()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('删除浏览记录失败')
  }
}

async function removeAll() {
  try {
    await ElMessageBox.confirm('清空全部浏览历史？', '清空浏览历史', { type: 'warning' })
    await clearReadingHistory()
    await refresh()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('清空浏览历史失败')
  }
}
</script>

<template>
  <main class="history-view">
    <header class="history-header">
      <h1>浏览历史</h1>
      <el-button v-if="records.length" :icon="Delete" @click="removeAll">清空全部</el-button>
    </header>
    <el-skeleton v-if="loading" :rows="3" animated />
    <el-empty v-else-if="!settings.enabled || !settings.cacheReadingHistory" description="请在系统设置中开启浏览历史" />
    <el-empty v-else-if="!records.length" description="暂无浏览历史" />
    <div v-else class="history-list">
      <article v-for="record in records" :key="record.bookId" class="history-item">
        <img v-if="record.coverUrl" :src="record.coverUrl" alt="" loading="lazy" />
        <div class="history-item__content">
          <h2>{{ record.title }}</h2>
          <p>已看 {{ record.viewedOrdinals.length }} 张 · 上次看到第 {{ record.lastOrdinal }} 张 · {{ new Date(record.updatedAt).toLocaleString('zh-CN') }}</p>
          <div class="history-item__actions">
            <el-button @click="openViewer(record, 'start')">从头阅读</el-button>
            <el-button type="primary" @click="openViewer(record, 'continue')">继续阅读</el-button>
            <el-button :icon="Delete" aria-label="删除这条浏览记录" @click="removeRecord(record)" />
          </div>
        </div>
      </article>
    </div>
  </main>
</template>

<style scoped>
.history-view {
  width: min(100%, 880px);
  margin: 0 auto;
  padding: 28px 20px 96px;
}
.history-header,
.history-item__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.history-header { justify-content: space-between; }
.history-header h1 { margin: 0 0 20px; font-size: 24px; }
.history-list { display: grid; gap: 12px; }
.history-item {
  display: flex;
  min-width: 0;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.history-item img { width: 82px; height: 112px; object-fit: contain; }
.history-item__content { min-width: 0; }
.history-item h2 { margin: 0; overflow-wrap: anywhere; font-size: 16px; }
.history-item p { color: var(--el-text-color-secondary); font-size: 13px; }
.history-item__actions { flex-wrap: wrap; }
@media (max-width: 480px) {
  .history-item img { width: 64px; height: 88px; }
}
</style>
