<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import { computed, defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
import { Bookmark, ArrowUpRight } from '@lucide/vue'
import { getLayoutScrollTop, scrollLayoutTo } from '@/composables/layoutScroll'
import { listReadingHistory } from '@/core/cache/readingHistory'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import type { ReadingHistoryRecord } from '@/core/cache/indexedDb'
import HomeYesterdayPanel from '@/components/HomeYesterdayPanel.vue'
defineOptions({ name: 'HomeView' })
const activePanel = ref('yesterday')
const latest = ref<ReadingHistoryRecord>()
const historyLoading = ref(true)
useAppLaunchReadiness(() => historyLoading.value, 'history')
const settings = useIndexedDbCacheSettings()
const panels = {
  yesterday: HomeYesterdayPanel,
  popular: defineAsyncComponent(() => import('@/components/HomePopularPanel.vue')),
  overview: defineAsyncComponent(() => import('@/components/ToplistOverviewPanel.vue')),
}
const activePanelComponent = computed(() => panels[activePanel.value as keyof typeof panels])
const sections = [
  { key: 'yesterday', label: '昨日热门' },
  { key: 'popular', label: '最近流行' },
  { key: 'overview', label: '排行总览' },
]
async function selectPanel(key: string) {
  if (!(key in panels) || key === activePanel.value) return
  sessionStorage.setItem(`home-panel-scroll:${activePanel.value}`, String(getLayoutScrollTop()))
  activePanel.value = key
  await nextTick()
  requestAnimationFrame(() =>
    scrollLayoutTo(Number(sessionStorage.getItem(`home-panel-scroll:${key}`) || '0')),
  )
}
onMounted(async () => {
  try {
    if (settings.enabled && settings.cacheReadingHistory)
      latest.value = (await listReadingHistory())[0]
  } finally {
    historyLoading.value = false
  }
})
</script>
<template>
  <div class="home-view">
    <main class="home-content">
      <KeepAlive>
        <component :is="activePanelComponent">
          <template #navigation>
            <div class="home-controls">
              <div v-if="latest" class="home-intro">
                <RouterLink
                  :to="{ path: '/viewer', query: { bookId: latest.bookId, reading: 'continue' } }"
                  class="resume-note"
                  ><Bookmark :size="20" :stroke-width="1.4" /><span
                    ><small>{{ t('接着上次读') }}</small
                    ><strong>{{ latest.title }}</strong
                    ><small>{{ t('第 {p0} 张', { p0: latest.lastOrdinal }) }}</small></span
                  ><ArrowUpRight :size="16"
                /></RouterLink>
              </div>
              <nav class="home-sections" :aria-label="t('发现内容')">
                <button
                  v-for="section in sections"
                  :key="section.key"
                  type="button"
                  :class="{ active: activePanel === section.key }"
                  :aria-current="activePanel === section.key ? 'page' : undefined"
                  @click="selectPanel(section.key)"
                >
                  {{ t(section.label) }}</button
                ><RouterLink to="/booklist" class="home-search-link"
                  >{{ t('找一找') }}<ArrowUpRight :size="14"
                /></RouterLink>
              </nav>
            </div>
          </template>
        </component>
      </KeepAlive>
    </main>
  </div>
</template>
<style scoped>
.home-view {
  max-width: 1400px;
  margin: auto;
}
.home-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 0 12px;
}
.resume-note {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 2px 8px 16px;
  border-left: 2px solid var(--accent-ring);
  color: var(--text);
  max-width: 290px;
  transition: border-color var(--motion-fast);
}
.resume-note:hover {
  text-decoration: none;
  border-color: var(--accent);
}
.resume-note > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.resume-note small {
  font-size: 11px;
  color: var(--muted-foreground);
}
.resume-note strong {
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.home-sections {
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  margin-bottom: 0;
}
.home-sections button,
.home-search-link {
  font-family: var(--font-display);
  font-weight: 400;
  font-synthesis: none;
}
.home-sections button {
  position: relative;
  background: transparent;
  color: var(--muted-foreground);
  padding: 6px 0;
  min-height: 36px;
  border: 0;
  font-size: 13px;
  transition: color var(--motion-fast);
}
.home-sections button.active {
  color: var(--accent);
}
.home-sections button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  bottom: -13px;
}
.home-search-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 12px;
}
@media (max-width: 767px) {
  .home-intro {
    padding-bottom: 12px;
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .resume-note {
    width: 100%;
    max-width: 100%;
    padding: 4px 0 4px 12px;
  }
  .resume-note > span {
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .home-sections {
    gap: 18px;
  }
  .home-sections button {
    font-size: 12px;
  }
}
</style>
