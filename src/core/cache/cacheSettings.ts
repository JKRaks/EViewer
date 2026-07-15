import { reactive, watch } from 'vue'

const storageKey = 'eviewer:indexed-db-settings'

export interface IndexedDbCacheSettings {
  enabled: boolean
  cacheTagTranslations: boolean
  cacheBookDetails: boolean
  cacheBookImageInfo: boolean
}

const defaultSettings: IndexedDbCacheSettings = {
  enabled: false,
  cacheTagTranslations: true,
  cacheBookDetails: true,
  cacheBookImageInfo: true,
}

function loadSettings(): IndexedDbCacheSettings {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : { ...defaultSettings }
  } catch {
    return { ...defaultSettings }
  }
}

export const indexedDbCacheSettings = reactive(loadSettings())

watch(
  indexedDbCacheSettings,
  (settings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings))
    } catch (error) {
      console.warn('保存 IndexedDB 缓存设置失败:', error)
    }
  },
  { deep: true },
)

export function useIndexedDbCacheSettings() {
  return indexedDbCacheSettings
}
