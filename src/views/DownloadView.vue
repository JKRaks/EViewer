<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, RefreshRight } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { bookFileBusi } from '@/core/books/bookFileBusi'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { galleryTorrentsInput } from '@/core/model/file/galleryTorrentsInput'
import type { galleryTorrentItem } from '@/core/model/file/galleryTorrentsOutput'

defineOptions({
  name: 'DownloadView',
})

const route = useRoute()
const activeDownloadType = ref('torrent')
const loading = ref(false)
const errorMessage = ref('')
const bookName = ref('')
const torrentItems = ref<galleryTorrentItem[]>([])
const fileBusi = new bookFileBusi()
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
  const [gallery, token] = bookId.replace('-', '/').replace(/^\/+|\/+$/g, '').split('/')

  torrentItems.value = []
  bookName.value = ''
  errorMessage.value = ''
  if (!gallery || !token) {
    errorMessage.value = '画册参数不完整，无法获取下载列表'
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
      throw new Error(result.msg || '下载列表获取失败')
    }
    bookName.value = result.bookName
    torrentItems.value = result.data ?? []
  } catch (error) {
    if (currentRequest !== requestVersion) return
    console.error('获取画册下载列表失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '下载列表获取失败'
  } finally {
    if (currentRequest === requestVersion) loading.value = false
  }
}

function formatDate(date?: Date) {
  if (!date) return '未知时间'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '未知时间' : parsed.toLocaleString('zh-CN')
}

function resolveDownloadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url

  const proxyBase = new URL(eurlEnum.EH, window.location.origin)
  const proxyPath = proxyBase.pathname.replace(/\/$/, '')
  const relativePath = url.startsWith('/') ? url : `/${url}`
  return new URL(`${proxyPath}${relativePath}`, proxyBase.origin).toString()
}
</script>

<template>
  <main class="download-view">
    <header class="download-header">
      <h1>画册下载</h1>
      <p v-if="bookName">{{ bookName }}</p>
    </header>

    <el-tabs v-model="activeDownloadType" class="download-tabs">
      <el-tab-pane label="磁力链接下载" name="torrent">
        <div v-if="loading" class="download-loading">
          <el-skeleton :rows="7" animated />
        </div>

        <el-result
          v-else-if="errorMessage"
          icon="error"
          title="下载列表获取失败"
          :sub-title="errorMessage"
        >
          <template #extra>
            <el-button type="primary" :icon="RefreshRight" @click="loadTorrentList">
              重新获取
            </el-button>
          </template>
        </el-result>

        <el-empty v-else-if="torrentItems.length === 0" description="暂无可用的下载资源" />

        <div v-else class="torrent-list">
          <article v-for="item in torrentItems" :key="item.gtid" class="torrent-item">
            <div class="torrent-main">
              <h2>{{ item.fileName || '未命名种子文件' }}</h2>
              <dl class="torrent-meta">
                <div>
                  <dt>文件大小</dt>
                  <dd>{{ item.size || '--' }}</dd>
                </div>
                <div>
                  <dt>发布时间</dt>
                  <dd>{{ formatDate(item.posted) }}</dd>
                </div>
                <div>
                  <dt>上传者</dt>
                  <dd>{{ item.uploader || '--' }}</dd>
                </div>
                <div>
                  <dt>做种 / 下载</dt>
                  <dd>{{ item.seeds }} / {{ item.downloads }}</dd>
                </div>
              </dl>
            </div>
            <el-button
              class="torrent-download"
              type="primary"
              :icon="Download"
              tag="a"
              :href="resolveDownloadUrl(item.downloadUrl)"
              target="_blank"
              rel="noopener noreferrer"
            >
              下载
            </el-button>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane label="源站下载" name="source">
        <el-empty description="源站下载暂不支持" />
      </el-tab-pane>
    </el-tabs>
  </main>
</template>

<style scoped>
.download-view {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 28px 20px 96px;
  color: var(--el-text-color-primary);
}

.download-header {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.download-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.download-header p {
  margin: 8px 0 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
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
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
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
  color: var(--el-text-color-secondary);
}

.torrent-meta dd {
  margin: 0;
  color: var(--el-text-color-regular);
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
