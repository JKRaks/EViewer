<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t, getDisplayLocale } from '@/i18n'

import SectionTabs from '@/components/primitives/SectionTabs'
import SectionTab from '@/components/primitives/SectionTab.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import StatusPanel from '@/components/primitives/StatusPanel.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, RotateCw as RefreshRight } from '@lucide/vue'
import { notify } from '@/components/primitives/feedback'
import { useRoute } from 'vue-router'
import { bookFileBusi } from '@/core/books/bookFileBusi'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { galleryDownloadUrl } from '@/core/connector/connectionSettings'
import { galleryTorrentsInput } from '@/core/model/file/galleryTorrentsInput'
import type { galleryTorrentItem } from '@/core/model/file/galleryTorrentsOutput'

defineOptions({
  name: 'DownloadView',
})

const route = useRoute()
const activeDownloadType = ref('torrent')
const loading = ref(false)
useAppLaunchReadiness(() => loading.value)
const errorMessage = ref('')
const bookName = ref('')
const torrentItems = ref<galleryTorrentItem[]>([])
const fileBusi = new bookFileBusi()
const useAppleWebAppDownload = isAppleStandaloneWebApp()
let requestVersion = 0

onMounted(() => {
  void loadTorrentList()
})

watch(
  () => route.query.bookId,
  () => void loadTorrentList(),
)

onBeforeUnmount(() => {
  requestVersion++
})

async function loadTorrentList() {
  const currentRequest = ++requestVersion
  const bookId = typeof route.query.bookId === 'string' ? route.query.bookId : ''
  const [gallery, token] = bookId
    .replace('-', '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')

  torrentItems.value = []
  bookName.value = ''
  errorMessage.value = ''
  if (!gallery || !token) {
    errorMessage.value = t('画册参数不完整，无法获取下载列表')
    return
  }

  loading.value = true
  try {
    const input = new galleryTorrentsInput()
    input.gallery = gallery
    input.tid = token
    const result = await fileBusi.getBookImage(input)
    if (currentRequest !== requestVersion) return

    if (!result.isSuccess) {
      throw new Error(result.msg || t('下载列表获取失败'))
    }
    bookName.value = result.bookName
    torrentItems.value = result.data ?? []
  } catch (error) {
    if (currentRequest !== requestVersion) return
    console.error(t('获取画册下载列表失败:'), error)
    errorMessage.value = error instanceof Error ? error.message : t('下载列表获取失败')
  } finally {
    if (currentRequest === requestVersion) loading.value = false
  }
}

function formatDate(date?: Date) {
  if (!date) return t('未知时间')
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? t('未知时间') : parsed.toLocaleString(getDisplayLocale())
}

function resolveDownloadUrl(url: string) {
  return galleryDownloadUrl(url, eurlEnum.EH)
}

async function handleTorrentDownload(event: MouseEvent, item: galleryTorrentItem) {
  if (!useAppleWebAppDownload) return

  event.preventDefault()
  const url = resolveDownloadUrl(item.downloadUrl)
  if (navigator.share) {
    try {
      await navigator.share({
        title: item.fileName || t('画册种子下载'),
        url,
      })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn(t('iOS 系统分享调起失败，改为复制下载链接:'), error)
    }
  }

  try {
    await copyDownloadUrl(url)
    notify.success(t('下载链接已复制，请在 Safari 中打开'))
  } catch (error) {
    console.error(t('复制下载链接失败:'), error)
    notify.error(t('无法打开下载链接，请长按下载按钮复制链接'))
  }
}

async function copyDownloadUrl(url: string) {
  try {
    await navigator.clipboard?.writeText(url)
    if (navigator.clipboard) return
  } catch {
    // Older iOS Web Apps can expose Clipboard API but reject writes.
  }

  const textarea = document.createElement('textarea')
  textarea.value = url
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, url.length)
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error(t('浏览器拒绝复制下载链接'))
}

function isAppleStandaloneWebApp() {
  const appleNavigator = navigator as Navigator & { standalone?: boolean }
  const isAppleMobile =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || appleNavigator.standalone === true
  return isAppleMobile && isStandalone
}
</script>

<template>
  <main class="download-view">
    <header class="download-header">
      <h1>{{ t('画册下载') }}</h1>
      <p v-if="bookName">{{ bookName }}</p>
    </header>

    <SectionTabs v-model="activeDownloadType" class="download-tabs">
      <SectionTab :label="t('磁力链接下载')" name="torrent">
        <div v-if="loading" class="download-loading">
          <SkeletonBlock :rows="7" />
        </div>

        <StatusPanel
          v-else-if="errorMessage"
          icon="error"
          :title="t('下载列表获取失败')"
          :sub-title="t(errorMessage)"
        >
          <template #extra>
            <ActionButton variant="default" :icon="RefreshRight" @click="loadTorrentList">{{
              t('重新获取')
            }}</ActionButton>
          </template>
        </StatusPanel>

        <EmptyState v-else-if="torrentItems.length === 0" :description="t('暂无可用的下载资源')" />

        <div v-else class="torrent-list">
          <article v-for="item in torrentItems" :key="item.gtid" class="torrent-item">
            <div class="torrent-main">
              <h2>{{ item.fileName || t('未命名种子文件') }}</h2>
              <dl class="torrent-meta">
                <div>
                  <dt>{{ t('文件大小') }}</dt>
                  <dd>{{ item.size || '--' }}</dd>
                </div>
                <div>
                  <dt>{{ t('发布时间') }}</dt>
                  <dd>{{ formatDate(item.posted) }}</dd>
                </div>
                <div>
                  <dt>{{ t('上传者') }}</dt>
                  <dd>{{ item.uploader || '--' }}</dd>
                </div>
                <div>
                  <dt>{{ t('做种 / 下载') }}</dt>
                  <dd>{{ item.seeds }} / {{ item.downloads }}</dd>
                </div>
              </dl>
            </div>
            <Button class="ui-button torrent-download" variant="default" as-child>
              <a
                :href="resolveDownloadUrl(item.downloadUrl)"
                :target="useAppleWebAppDownload ? '_self' : '_blank'"
                rel="noopener noreferrer"
                @click="handleTorrentDownload($event, item)"
              >
                <Download :size="16" />{{ t('下载') }}</a
              >
            </Button>
          </article>
        </div>
      </SectionTab>

      <SectionTab :label="t('源站下载')" name="source">
        <EmptyState :description="t('源站下载暂不支持')" />
      </SectionTab>
    </SectionTabs>
  </main>
</template>

<style scoped>
.download-view {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 28px 20px 96px;
  color: var(--foreground);
}

.download-header {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-soft);
}

.download-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.download-header p {
  margin: 8px 0 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-tabs {
  margin-top: 18px;
}

.download-loading {
  padding: 24px 4px;
}

.torrent-list {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.torrent-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--surface);
}

.torrent-main {
  min-width: 0;
}

.torrent-main h2 {
  margin: 0 0 12px;
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.torrent-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  margin: 0;
}

.torrent-meta div {
  display: flex;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.torrent-meta dt {
  color: var(--muted-foreground);
}

.torrent-meta dd {
  margin: 0;
  color: var(--text);
}

.torrent-download {
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .download-view {
    padding: 20px 68px 88px 14px;
  }

  .torrent-item {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
    padding: 14px;
  }

  .torrent-download {
    width: 100%;
  }
}
</style>
