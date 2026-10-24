<script setup lang="ts">
import { t, locale, setLocale, getDisplayLocale } from '@/i18n'
import SelectField from '@/components/primitives/SelectField.vue'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'
import SettingsNavigation from '@/components/settings/SettingsNavigation.vue'
import BrowserAssistantSettings from '@/components/settings/BrowserAssistantSettings.vue'

import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import ToggleField from '@/components/primitives/ToggleField.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Notice from '@/components/primitives/Notice.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { Trash2 as Delete, RotateCw as RefreshRight } from '@lucide/vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import {
  validateIndexedDbEnvironment,
  deleteCacheDatabase,
  type IndexedDbEnvironmentStatus,
} from '@/core/cache/indexedDb'
import {
  getTagTranslationCacheStatus,
  rebuildTagTranslationCache,
  resetTagTranslationRuntime,
} from '@/core/common/tagTranslationWorkerClient'
import type { TagTranslationCacheStatus } from '@/core/common/tagTranslationProtocol'
import { clearGalleryDetailsCache, clearGalleryImageCache } from '@/core/cache/galleryCache'
import { clearReadingHistory } from '@/core/cache/readingHistory'
import { useShareSettings } from '@/core/share/shareSettings'
import { useAuthState } from '@/core/auth/authState'
import {
  getUserConfigCacheStatus,
  rebuildUserConfigCache,
  type UserConfigCacheStatus,
} from '@/core/auth/userConfigCache'

const settings = useIndexedDbCacheSettings()
const shareSettings = useShareSettings()
const authState = useAuthState()
const environmentStatus = ref<IndexedDbEnvironmentStatus>()
const tagCacheStatus = ref<TagTranslationCacheStatus>({ available: false, count: 0 })
const userConfigCacheStatus = ref<UserConfigCacheStatus>({
  available: false,
  memberId: '',
  favoriteCategoryCount: 0,
})
const validationRunning = ref(false)
const fullClearRunning = ref(false)
const userConfigRebuildRunning = ref(false)
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

let indexedDbRefreshPromise: Promise<IndexedDbEnvironmentStatus> | undefined

onMounted(() => {
  refreshUserConfigCacheStatus()
  window.setTimeout(() => void refreshIndexedDbInformation(), 0)
})

function refreshUserConfigCacheStatus() {
  userConfigCacheStatus.value = getUserConfigCacheStatus(authState.memberId)
}

async function rebuildUserConfiguration() {
  if (!authState.loggedIn || !authState.memberId) {
    notify.warning(t('请先维护认证信息'))
    return
  }

  userConfigRebuildRunning.value = true
  try {
    const result = await rebuildUserConfigCache(authState.memberId)
    if (!result.isSuccess || !result.data) {
      throw new Error(result.msg || t('用户配置缓存重建失败'))
    }
    refreshUserConfigCacheStatus()
    notify.success(t('用户配置缓存已重建'))
  } catch (error) {
    console.error(t('重建用户配置缓存失败:'), error)
    notify.error(error instanceof Error ? error.message : t('用户配置缓存重建失败'))
  } finally {
    userConfigRebuildRunning.value = false
  }
}

async function handleIndexedDbToggle() {
  if (!settings.enabled) {
    return
  }

  const status = await refreshIndexedDbInformation()
  if (!status.usable) {
    settings.enabled = false
    notify.error(t('当前环境无法使用 IndexedDB，已关闭缓存'))
  }
}

async function runIndexedDbValidation() {
  validationRunning.value = true
  try {
    const status = await validateIndexedDbEnvironment()
    environmentStatus.value = status
    return status
  } finally {
    validationRunning.value = false
  }
}

async function refreshTagCacheStatus() {
  tagCacheStatus.value = await getTagTranslationCacheStatus()
}

async function refreshIndexedDbInformation(showResult = false) {
  if (!indexedDbRefreshPromise) {
    indexedDbRefreshPromise = Promise.all([runIndexedDbValidation(), refreshTagCacheStatus()])
      .then(([status]) => status)
      .finally(() => {
        indexedDbRefreshPromise = undefined
      })
  }

  const status = await indexedDbRefreshPromise
  if (showResult) {
    notify[status.usable ? 'success' : 'error'](status.message)
  }
  return status
}

async function rebuildTranslations() {
  const environment = await runIndexedDbValidation()
  if (!environment.usable) {
    notify.error(environment.message)
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
    notify.success(t('标签翻译缓存已重建，共 {p0} 条索引', { p0: count.toLocaleString() }))
    window.setTimeout(() => void refreshIndexedDbInformation(), 0)
  } catch (error) {
    console.error(t('重建标签翻译缓存失败:'), error)
    notify.error(t('重建失败，请先重新校验 IndexedDB'))
  } finally {
    rebuildState.running = false
  }
}

async function clearCache(kind: 'details' | 'images') {
  const label = kind === 'details' ? t('画册详情') : t('画册图片信息')
  try {
    await dialogs.confirm(t('确定清除全部{p0}缓存吗？', { p0: label }), t('清除缓存'), {
      confirmButtonText: t('清除'),
      cancelButtonText: t('取消'),
      type: 'warning',
    })
    if (kind === 'details') {
      await clearGalleryDetailsCache()
    } else {
      await clearGalleryImageCache()
    }
    notify.success(t('{p0}缓存已清除', { p0: label }))
    window.setTimeout(() => void refreshIndexedDbInformation(), 0)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error(t('清除{p0}缓存失败:', { p0: label }), error)
      notify.error(t('清除{p0}缓存失败', { p0: label }))
    }
  }
}

async function clearReadingHistoryFromSettings() {
  try {
    await dialogs.confirm(t('确定清除全部浏览历史吗？'), t('清除浏览历史'), {
      confirmButtonText: t('清除'),
      cancelButtonText: t('取消'),
      type: 'warning',
    })
    await clearReadingHistory()
    notify.success(t('浏览历史已清除'))
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') notify.error(t('清除浏览历史失败'))
  }
}

async function clearAllIndexedDb() {
  try {
    await dialogs.confirm(
      t('确定完全清理 IndexedDB 中的标签翻译、画册详情、图片信息和浏览历史吗？'),
      t('完全清理 IndexedDB'),
      {
        confirmButtonText: t('完全清理'),
        cancelButtonText: t('取消'),
        type: 'warning',
      },
    )
    fullClearRunning.value = true
    resetTagTranslationRuntime()
    await deleteCacheDatabase()
    tagCacheStatus.value = { available: false, count: 0 }
    notify.success(t('IndexedDB 已完全清理'))
    window.setTimeout(() => void refreshIndexedDbInformation(), 0)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error(t('完全清理 IndexedDB 失败:'), error)
      notify.error(t('完全清理 IndexedDB 失败'))
    }
  } finally {
    fullClearRunning.value = false
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
  return timestamp ? new Date(timestamp).toLocaleString(getDisplayLocale()) : t('尚未重建')
}
</script>

<template>
  <div class="settings-layout">
    <SettingsNavigation />
    <main class="settings-view">
      <header class="settings-header">
        <h1>{{ t('系统设置') }}</h1>
      </header>
      <section id="appearance" class="settings-section">
        <h2>{{ t('外观与语言') }}</h2>
        <AppearanceSettings />
        <div class="setting-row">
          <span class="setting-name">{{ t('界面语言') }}</span>
          <SelectField
            :model-value="locale"
            :aria-label="t('界面语言')"
            @update:model-value="setLocale(String($event))"
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </SelectField>
        </div>
      </section>

      <BrowserAssistantSettings />

      <section id="sharing" class="settings-section">
        <h2>{{ t('分享设置') }}</h2>
        <div class="setting-row setting-row--primary">
          <div>
            <div class="setting-name">{{ t('默认链接类型') }}</div>
            <div class="setting-value">{{ t('用于分享图片中的二维码链接') }}</div>
          </div>
          <ChoiceGroup
            v-model="shareSettings.preferredLinkType"
            :aria-label="t('默认分享链接类型')"
          >
            <RadioChoice value="site">{{ t('本站') }}</RadioChoice>
            <RadioChoice value="source">{{ t('源站') }}</RadioChoice>
          </ChoiceGroup>
        </div>
      </section>

      <section id="cache-preferences" class="settings-section">
        <h2>{{ t('缓存偏好') }}</h2>
        <div class="setting-row setting-row--primary">
          <div>
            <div class="setting-name">{{ t('开启 IndexedDB') }}</div>
            <div class="setting-value">{{ t('关闭后直接使用 JSON 文件和网络数据') }}</div>
          </div>
          <ToggleField
            :aria-label="t('开启 IndexedDB')"
            v-model="settings.enabled"
            @change="handleIndexedDbToggle"
          />
        </div>

        <div class="setting-row">
          <span class="setting-name">{{ t('缓存标签翻译') }}</span>
          <ToggleField
            :aria-label="t('缓存标签翻译')"
            v-model="settings.cacheTagTranslations"
            :disabled="!settings.enabled"
          />
        </div>
        <div class="setting-row">
          <span class="setting-name">{{ t('缓存画册详情') }}</span>
          <ToggleField
            :aria-label="t('缓存画册详情')"
            v-model="settings.cacheBookDetails"
            :disabled="!settings.enabled"
          />
        </div>
        <div class="setting-row">
          <span class="setting-name">{{ t('缓存画册图片信息') }}</span>
          <ToggleField
            :aria-label="t('缓存画册图片信息')"
            v-model="settings.cacheBookImageInfo"
            :disabled="!settings.enabled"
          />
        </div>
        <div class="setting-row">
          <div>
            <span class="setting-name">{{ t('记录浏览历史') }}</span>
            <div class="setting-value">
              {{ t('记录看过的图片和继续阅读的位置；关闭后隐藏历史入口') }}
            </div>
          </div>
          <ToggleField
            :aria-label="t('记录浏览历史')"
            v-model="settings.cacheReadingHistory"
            :disabled="!settings.enabled"
          />
        </div>
      </section>

      <section id="cache-maintenance" class="settings-section">
        <h2>{{ t('缓存维护') }}</h2>
        <div v-if="authState.source === 'server'" class="maintenance-group">
          <h3>{{ t('用户配置缓存') }}</h3>
          <div class="setting-row setting-row--primary">
            <div>
              <div class="setting-name">
                {{
                  userConfigCacheStatus.available
                    ? t('{p0} 个收藏分类', { p0: userConfigCacheStatus.favoriteCategoryCount })
                    : t('尚未建立')
                }}
              </div>
              <div class="setting-value">
                {{
                  authState.loggedIn
                    ? t('用户 {p0} · {p1}', {
                        p0: authState.memberId,
                        p1: formatDate(userConfigCacheStatus.updatedAt),
                      })
                    : t('登录后可缓存当前用户配置和收藏分类')
                }}
              </div>
            </div>
            <ActionButton
              variant="default"
              :icon="RefreshRight"
              :loading="userConfigRebuildRunning"
              :disabled="!authState.loggedIn"
              @click="rebuildUserConfiguration"
              >{{ t('重建') }}</ActionButton
            >
          </div>
          <Notice
            class="setting-tip"
            :title="t('收藏分类优先读取当前用户缓存；切换账号或退出登录时会自动清理。')"
            tone="info"
            :closable="false"
          />
        </div>
        <div class="maintenance-group">
          <h3>{{ t('标签翻译缓存') }}</h3>
          <div class="setting-row">
            <div>
              <div class="setting-name">
                {{
                  tagCacheStatus.available
                    ? t('{p0} 条索引', { p0: tagCacheStatus.count.toLocaleString() })
                    : t('尚未建立')
                }}
              </div>
              <div class="setting-value">{{ formatDate(tagCacheStatus.updatedAt) }}</div>
            </div>
            <ActionButton
              variant="default"
              :icon="RefreshRight"
              :loading="rebuildState.running"
              :disabled="!settings.enabled || !settings.cacheTagTranslations || fullClearRunning"
              @click="rebuildTranslations"
              >{{ t('重建') }}</ActionButton
            >
          </div>
          <ProgressMeter
            v-if="rebuildState.running"
            :percentage="rebuildPercentage"
            :stroke-width="8"
          />
        </div>
      </section>

      <section id="storage-environment" class="settings-section">
        <h2>{{ t('环境校验') }}</h2>
        <div class="setting-row">
          <div class="status-content">
            <TagChip :tone="environmentStatusType" effect="plain">
              {{
                environmentStatus?.usable
                  ? t('可用')
                  : environmentStatus
                    ? t('不可用')
                    : t('未检测')
              }}
            </TagChip>
            <span class="setting-value">{{ t(environmentStatus?.message ?? '等待检测') }}</span>
          </div>
          <ActionButton
            :icon="RefreshRight"
            :loading="validationRunning"
            @click="refreshIndexedDbInformation(true)"
            >{{ t('刷新') }}</ActionButton
          >
        </div>
        <div v-if="environmentStatus?.usable" class="storage-summary">
          {{
            t('已使用 {p0} / 配额 {p1}', {
              p0: formatBytes(environmentStatus.usage),
              p1: formatBytes(environmentStatus.quota),
            })
          }}
        </div>
        <Notice
          class="setting-tip"
          :title="
            t(
              '无痕模式、浏览器存储限制或空间不足可能导致 IndexedDB 不可用；检测会执行一次临时读写并立即清理。',
            )
          "
          tone="info"
          :closable="false"
        />
      </section>

      <section id="data-cleanup" class="settings-section">
        <h2>{{ t('数据清理') }}</h2>
        <div class="setting-row">
          <span class="setting-name">{{ t('画册详情') }}</span>
          <ActionButton
            :icon="Delete"
            :disabled="rebuildState.running || fullClearRunning"
            @click="clearCache('details')"
            >{{ t('清除') }}</ActionButton
          >
        </div>
        <div class="setting-row">
          <span class="setting-name">{{ t('画册图片信息') }}</span>
          <ActionButton
            :icon="Delete"
            :disabled="rebuildState.running || fullClearRunning"
            @click="clearCache('images')"
            >{{ t('清除') }}</ActionButton
          >
        </div>
        <div class="setting-row">
          <span class="setting-name">{{ t('浏览历史') }}</span>
          <ActionButton
            :icon="Delete"
            :disabled="fullClearRunning"
            @click="clearReadingHistoryFromSettings"
            >{{ t('清除') }}</ActionButton
          >
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-name">{{ t('全部 IndexedDB 数据') }}</div>
            <div class="setting-value">{{ t('标签翻译、画册详情、图片信息和浏览历史') }}</div>
          </div>
          <ActionButton
            variant="destructive"
            :icon="Delete"
            :loading="fullClearRunning"
            :disabled="rebuildState.running"
            @click="clearAllIndexedDb"
            >{{ t('完全清理') }}</ActionButton
          >
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 760px);
  gap: 24px;
  max-width: 1040px;
  margin: 0 auto;
  padding: 28px 24px 0;
  align-items: start;
}
.settings-section {
  scroll-margin-top: 24px;
}
.maintenance-group + .maintenance-group {
  margin-top: 24px;
}
.maintenance-group h3 {
  font-size: 14px;
  font-weight: 500;
  margin: 14px 0 4px;
}
@media (max-width: 767px) {
  .settings-layout {
    display: block;
    padding: 0;
  }
}
.settings-view {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 0 20px 96px;
  min-width: 0;
  color: var(--foreground);
}

.settings-header {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-soft);
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.settings-section {
  padding: 24px 0 8px;
  border-bottom: 1px solid var(--border-soft);
}

.settings-section h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--muted-foreground);
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
.storage-summary {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted-foreground);
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
  margin: 6px 0 12px;
}

@media (min-width: 561px) and (max-width: 767px) {
  .settings-view {
    padding-top: 28px;
  }
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
