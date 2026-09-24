<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, MoreFilled, Star } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
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
const openMenuId = ref('')
const draggingId = ref('')
const dragOffset = ref(0)
const menuWidth = 164
let touchStartX = 0
let touchStartY = 0
let touchBaseOffset = 0
let swipeMoved = false

onMounted(() => void refresh())

async function refresh() {
  loading.value = true
  records.value = await listReadingHistory()
  loading.value = false
}

function openDetail(record: ReadingHistoryRecord) {
  if (swipeMoved) return
  openMenuId.value = ''
  void router.push({ path: '/bookinfo', query: { bookId: record.bookId } })
}

function openFavorite(record: ReadingHistoryRecord) {
  openMenuId.value = ''
  void router.push({ path: '/bookinfo', query: { bookId: record.bookId, favorite: '1' } })
}

function beginSwipe(event: TouchEvent, bookId: string) {
  const touch = event.touches[0]
  if (!touch) return
  draggingId.value = bookId
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchBaseOffset = openMenuId.value === bookId ? -menuWidth : 0
  dragOffset.value = touchBaseOffset
  swipeMoved = false
}

function moveSwipe(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch || !draggingId.value) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return
  swipeMoved = true
  dragOffset.value = Math.max(-menuWidth, Math.min(0, touchBaseOffset + dx))
}

function endSwipe() {
  if (!draggingId.value) return
  if (swipeMoved) {
    openMenuId.value = dragOffset.value < -menuWidth / 2 ? draggingId.value : ''
    window.setTimeout(() => { swipeMoved = false }, 300)
  }
  draggingId.value = ''
}

function surfaceOffset(bookId: string) {
  return draggingId.value === bookId
    ? dragOffset.value
    : openMenuId.value === bookId ? -menuWidth : 0
}

async function removeRecord(record: ReadingHistoryRecord) {
  try {
    await ElMessageBox.confirm(`删除「${record.title}」的浏览记录？`, '删除记录', { type: 'warning' })
    await deleteReadingHistory(record.bookId)
    if (openMenuId.value === record.bookId) openMenuId.value = ''
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
        <div class="history-item__menu">
          <button type="button" class="history-item__favorite" :tabindex="openMenuId === record.bookId ? 0 : -1" :aria-label="`收藏《${record.title}》`" @click="openFavorite(record)"><el-icon><Star /></el-icon><span>收藏</span></button>
          <button type="button" class="history-item__delete" :tabindex="openMenuId === record.bookId ? 0 : -1" :aria-label="`删除《${record.title}》的浏览记录`" @click="removeRecord(record)"><el-icon><Delete /></el-icon><span>删除</span></button>
        </div>
        <div
          class="history-item__surface"
          :class="{ 'is-dragging': draggingId === record.bookId }"
          :style="{ transform: `translateX(${surfaceOffset(record.bookId)}px)` }"
          role="link"
          tabindex="0"
          :aria-label="`查看《${record.title}》详情`"
          @click="openDetail(record)"
          @keydown.enter.prevent="openDetail(record)"
          @keydown.space.prevent="openDetail(record)"
          @touchstart.passive="beginSwipe($event, record.bookId)"
          @touchmove.passive="moveSwipe"
          @touchend="endSwipe"
          @touchcancel="endSwipe"
        >
          <img v-if="record.coverUrl" :src="record.coverUrl" alt="" loading="lazy" />
          <div class="history-item__content">
            <h2>{{ record.title }}</h2>
            <p>已看 {{ record.viewedOrdinals.length }} 张 · 上次看到第 {{ record.lastOrdinal }} 张 · {{ new Date(record.updatedAt).toLocaleString('zh-CN') }}</p>
          </div>
          <button type="button" class="history-item__more" :aria-label="`显示《${record.title}》的操作`" @click.stop="openMenuId = openMenuId === record.bookId ? '' : record.bookId"><el-icon><MoreFilled /></el-icon></button>
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
.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.history-header { justify-content: space-between; }
.history-header h1 { margin: 0 0 20px; font-size: 24px; }
.history-list { display: grid; gap: 12px; }
.history-item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: 8px;
}
.history-item__surface {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  min-height: 112px;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color);
  cursor: pointer;
  transition: transform 0.22s ease;
  touch-action: pan-y;
}
.history-item__surface.is-dragging { transition: none; }
.history-item__surface:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.history-item img { width: 82px; height: 112px; flex: none; object-fit: contain; }
.history-item__content { min-width: 0; flex: 1; }
.history-item h2 { margin: 0; overflow-wrap: anywhere; font-size: 16px; }
.history-item p { color: var(--el-text-color-secondary); font-size: 13px; }
.history-item__menu {
  position: absolute;
  inset: 0 0 0 auto;
  display: flex;
  width: 164px;
}
.history-item__menu button {
  display: flex;
  width: 82px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  border: 0;
  color: #fff;
  cursor: pointer;
}
.history-item__favorite { background: var(--el-color-primary); }
.history-item__delete { background: var(--el-color-danger); }
.history-item__more {
  flex: none;
  align-self: stretch;
  padding: 0 4px;
  border: 0;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: pointer;
}
@media (max-width: 480px) {
  .history-item img { width: 64px; height: 88px; }
  .history-item__surface { min-height: 104px; gap: 10px; }
}
</style>
