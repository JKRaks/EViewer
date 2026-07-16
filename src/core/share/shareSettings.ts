import { reactive, watch } from 'vue'

export type ShareQrSource = 'site' | 'source'

export interface ShareSettings {
  preferredLinkType: ShareQrSource
}

const storageKey = 'eviewer:share-settings'
const defaultSettings: ShareSettings = {
  preferredLinkType: 'site',
}

function loadShareSettings(): ShareSettings {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return { ...defaultSettings }

    const parsed = JSON.parse(stored) as Partial<ShareSettings>
    return {
      preferredLinkType: parsed.preferredLinkType === 'source' ? 'source' : 'site',
    }
  } catch {
    return { ...defaultSettings }
  }
}

export const shareSettings = reactive(loadShareSettings())

watch(
  shareSettings,
  (settings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings))
    } catch (error) {
      console.warn('保存分享设置失败:', error)
    }
  },
  { deep: true },
)

export function useShareSettings() {
  return shareSettings
}
