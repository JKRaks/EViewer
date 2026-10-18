<script setup lang="ts">
import { t, getDisplayLocale } from '@/i18n'

import ActionButton from '@/components/primitives/ActionButton.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Trash2 as Delete, Ellipsis as MoreFilled, Star } from '@lucide/vue'
import { notify, dialogs } from '@/components/primitives/feedback'
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
    window.setTimeout(() => {
      swipeMoved = false
    }, 300)
  }
  draggingId.value = ''
}

function surfaceOffset(bookId: string) {
  return draggingId.value === bookId
    ? dragOffset.value
    : openMenuId.value === bookId
      ? -menuWidth
      : 0
}

async function removeRecord(record: ReadingHistoryRecord) {
  try {
    await dialogs.confirm(t('删除「{p0}」的浏览记录？', { p0: record.title }), t('删除记录'), {
      type: 'warning',
    })
    await deleteReadingHistory(record.bookId)
    if (openMenuId.value === record.bookId) openMenuId.value = ''
    await refresh()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') notify.error(t('删除浏览记录失败'))
  }
}

async function removeAll() {
  try {
    await dialogs.confirm(t('清空全部浏览历史？'), t('清空浏览历史'), { type: 'warning' })
    await clearReadingHistory()
    await refresh()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') notify.error(t('清空浏览历史失败'))
  }
}
</script>

<template>
  <main class="history-view">
    <header class="history-header">
      <h1>{{ t('浏览历史') }}</h1>
      <ActionButton v-if="records.length" :icon="Delete" @click="removeAll">{{
        t('清空全部')
      }}</ActionButton>
    </header>
    <SkeletonBlock v-if="loading" :rows="3" />
    <EmptyState
      v-else-if="!settings.enabled || !settings.cacheReadingHistory"
      :description="t('请在系统设置中开启浏览历史')"
    />
    <EmptyState v-else-if="!records.length" :description="t('暂无浏览历史')" />
    <div v-else class="history-list">
      <article v-for="record in records" :key="record.bookId" class="history-item">
        <div class="history-item__menu">
          <button
            type="button"
            class="history-item__favorite"
            :tabindex="openMenuId === record.bookId ? 0 : -1"
            :aria-label="t('收藏《{p0}》', { p0: record.title })"
            @click="openFavorite(record)"
          >
            <IconFrame><Star /></IconFrame><span>{{ t('收藏') }}</span>
          </button>
          <button
            type="button"
            class="history-item__delete"
            :tabindex="openMenuId === record.bookId ? 0 : -1"
            :aria-label="t('删除《{p0}》的浏览记录', { p0: record.title })"
            @click="removeRecord(record)"
          >
            <IconFrame><Delete /></IconFrame><span>{{ t('删除') }}</span>
          </button>
        </div>
        <div
          class="history-item__surface"
          :class="{ 'is-dragging': draggingId === record.bookId }"
          :style="{ transform: `translateX(${surfaceOffset(record.bookId)}px)` }"
          role="link"
          tabindex="0"
          :aria-label="t('查看《{p0}》详情', { p0: record.title })"
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
            <p>
              {{
                t('已看 {p0} 张 · 上次看到第 {p1} 张 · {p2}', {
                  p0: record.viewedOrdinals.length,
                  p1: record.lastOrdinal,
                  p2: new Date(record.updatedAt).toLocaleString(getDisplayLocale()),
                })
              }}
            </p>
          </div>
          <button
            type="button"
            class="history-item__more"
            :aria-label="t('显示《{p0}》的操作', { p0: record.title })"
            @click.stop="openMenuId = openMenuId === record.bookId ? '' : record.bookId"
          >
            <IconFrame><MoreFilled /></IconFrame>
          </button>
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
.history-header {
  justify-content: space-between;
}
.history-header h1 {
  margin: 0 0 20px;
  font-size: 24px;
}
.history-list {
  display: grid;
  gap: 12px;
}
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
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--foreground);
  cursor: pointer;
  transition:
    transform 0.22s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  touch-action: pan-y;
}
.history-item__surface.is-dragging {
  transition: none;
}
.history-item__surface:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-ring) inset;
}
.history-item__surface:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.history-item img {
  width: 82px;
  height: 112px;
  flex: none;
  object-fit: contain;
}
.history-item__content {
  min-width: 0;
  flex: 1;
}
.history-item h2 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 16px;
}
.history-item p {
  color: var(--muted-foreground);
  font-size: 13px;
}
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
.history-item__favorite {
  background: var(--accent);
  color: var(--accent-foreground);
}
.history-item__delete {
  background: var(--danger);
  color: var(--background);
}
.history-item__more {
  flex: none;
  align-self: stretch;
  padding: 0 4px;
  border: 0;
  color: var(--muted-foreground);
  background: transparent;
  cursor: pointer;
}
@media (max-width: 480px) {
  .history-item img {
    width: 64px;
    height: 88px;
  }
  .history-item__surface {
    min-height: 104px;
    gap: 10px;
  }
}
</style>
