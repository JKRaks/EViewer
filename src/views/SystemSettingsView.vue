<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import {
  validateIndexedDbEnvironment,
  type IndexedDbEnvironmentStatus,
} from '@/core/cache/indexedDb'
import {
  getTagTranslationCacheStatus,
  rebuildTagTranslationCache,
  type TagTranslationCacheStatus,
} from '@/core/common/tagTranslations'
import {
  clearGalleryDetailsCache,
  clearGalleryImageCache,
} from '@/core/cache/galleryCache'

const settings = useIndexedDbCacheSettings()
const environmentStatus = ref<IndexedDbEnvironmentStatus>()
const tagCacheStatus = ref<TagTranslationCacheStatus>({ available: false, count: 0 })
const validationRunning = ref(false)
const rebuildState = reactive({
  running: false,
  completed: 0,
  total: 0,
})

const environmentStatusType = computed(() => {
  if (!environmentStatus.value) return 'info'
  return environmentStatus.value.usable ? 'success' : 'danger'
})

const rebuildPercentage = computed(() => {
  if (!rebuildState.total) return 0
  return Math.round((rebuildState.completed / rebuildState.total) * 100)
})

onMounted(() => {
  void Promise.all([runIndexedDbValidation(), refreshTagCacheStatus()])
})

async function handleIndexedDbToggle() {
  if (!settings.enabled) {
    return
  }

  const status = await runIndexedDbValidation()
  if (!status.usable) {
    settings.enabled = false
    ElMessage.error('当前环境无法使用 IndexedDB，已关闭缓存')
  }
}

async function runIndexedDbValidation(showResult = false) {
  validationRunning.value = true
  try {
    const status = await validateIndexedDbEnvironment()
    environmentStatus.value = status
    if (showResult) {
      ElMessage[status.usable ? 'success' : 'error'](status.message)
    }
    return status
  } finally {
    validationRunning.value = false
  }
}

async function refreshTagCacheStatus() {
  tagCacheStatus.value = await getTagTranslationCacheStatus()
}

async function rebuildTranslations() {
  const environment = await runIndexedDbValidation()
  if (!environment.usable) {
    ElMessage.error(environment.message)
    return
  }

  rebuildState.running = true
  rebuildState.completed = 0
  rebuildState.total = 0
  try {
    const count = await rebuildTagTranslationCache((completed, total) => {
      rebuildState.completed = completed
      rebuildState.total = total
    })
    await refreshTagCacheStatus()
    ElMessage.success(`标签翻译缓存已重建，共 ${count.toLocaleString()} 条索引`)
  } catch (error) {
    console.error('重建标签翻译缓存失败:', error)
    ElMessage.error('重建失败，请先重新校验 IndexedDB')
  } finally {
    rebuildState.running = false
  }
}

async function clearCache(kind: 'details' | 'images') {
  const label = kind === 'details' ? '画册详情' : '画册图片信息'
  try {
    await ElMessageBox.confirm(`确定清除全部${label}缓存吗？`, '清除缓存', {
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (kind === 'details') {
      await clearGalleryDetailsCache()
    } else {
      await clearGalleryImageCache()
    }
    ElMessage.success(`${label}缓存已清除`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error(`清除${label}缓存失败:`, error)
      ElMessage.error(`清除${label}缓存失败`)
    }
  }
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '尚未重建'
}
</script>

<template>
  <main class="settings-view">
    <header class="settings-header">
      <h1>系统设置</h1>
    </header>

    <section class="settings-section">
      <h2>IndexedDB 缓存</h2>
      <div class="setting-row setting-row--primary">
        <div>
          <div class="setting-name">开启 IndexedDB</div>
          <div class="setting-value">关闭后直接使用 JSON 文件和网络数据</div>
        </div>
        <el-switch v-model="settings.enabled" @change="handleIndexedDbToggle" />
      </div>

      <div class="setting-row">
        <span class="setting-name">缓存标签翻译</span>
        <el-switch v-model="settings.cacheTagTranslations" :disabled="!settings.enabled" />
      </div>
      <div class="setting-row">
        <span class="setting-name">缓存画册详情</span>
        <el-switch v-model="settings.cacheBookDetails" :disabled="!settings.enabled" />
      </div>
      <div class="setting-row">
        <span class="setting-name">缓存画册图片信息</span>
        <el-switch v-model="settings.cacheBookImageInfo" :disabled="!settings.enabled" />
      </div>
    </section>

    <section class="settings-section">
      <h2>环境校验</h2>
      <div class="setting-row">
        <div class="status-content">
          <el-tag :type="environmentStatusType" effect="plain">
            {{ environmentStatus?.usable ? '可用' : environmentStatus ? '不可用' : '未检测' }}
          </el-tag>
          <span class="setting-value">{{ environmentStatus?.message ?? '等待检测' }}</span>
        </div>
        <el-button
          :icon="Search"
          :loading="validationRunning"
          @click="runIndexedDbValidation(true)"
        >
          检测
        </el-button>
      </div>
      <div v-if="environmentStatus?.usable" class="storage-summary">
        已使用 {{ formatBytes(environmentStatus.usage) }} / 配额
        {{ formatBytes(environmentStatus.quota) }}
      </div>
      <div class="setting-tip">
        无痕模式、浏览器存储限制或空间不足可能导致 IndexedDB 不可用；检测会执行一次临时读写并立即清理。
      </div>
    </section>

    <section class="settings-section">
      <h2>标签翻译缓存</h2>
      <div class="setting-row">
        <div>
          <div class="setting-name">
            {{ tagCacheStatus.available ? `${tagCacheStatus.count.toLocaleString()} 条索引` : '尚未建立' }}
          </div>
          <div class="setting-value">{{ formatDate(tagCacheStatus.updatedAt) }}</div>
        </div>
        <el-button
          type="primary"
          :icon="RefreshRight"
          :loading="rebuildState.running"
          :disabled="!settings.enabled || !settings.cacheTagTranslations"
          @click="rebuildTranslations"
        >
          重建
        </el-button>
      </div>
      <el-progress
        v-if="rebuildState.running"
        :percentage="rebuildPercentage"
        :stroke-width="8"
      />
    </section>

    <section class="settings-section">
      <h2>缓存管理</h2>
      <div class="setting-row">
        <span class="setting-name">画册详情</span>
        <el-button :icon="Delete" @click="clearCache('details')">清除</el-button>
      </div>
      <div class="setting-row">
        <span class="setting-name">画册图片信息</span>
        <el-button :icon="Delete" @click="clearCache('images')">清除</el-button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.settings-view {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 28px 20px 96px;
  color: var(--el-text-color-primary);
}

.settings-header {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.settings-section {
  padding: 24px 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.settings-section h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.setting-row {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.setting-row--primary {
  min-height: 68px;
}

.setting-name {
  font-size: 15px;
  line-height: 1.5;
}

.setting-value,
.setting-tip,
.storage-summary {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.status-content {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-content .setting-value {
  overflow-wrap: anywhere;
}

.storage-summary {
  padding-bottom: 6px;
}

.setting-tip {
  margin: 4px 0 12px;
  padding-left: 10px;
  border-left: 2px solid var(--el-border-color);
}

@media (max-width: 560px) {
  .settings-view {
    padding: 20px 68px 88px 14px;
  }

  .setting-row {
    gap: 12px;
  }

  .status-content {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
