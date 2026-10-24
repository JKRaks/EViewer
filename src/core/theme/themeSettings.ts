import { computed, reactive, ref, watch } from 'vue'
import {
  defaultTheme,
  normalizeCustomTheme,
  paletteCssVariables,
  themePresets,
  type ThemeColors,
  type ThemeMode,
  type ThemePreset,
  type ThemePresetId,
  type ThemeScheme,
} from './themePalette'

interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePresetId
  custom: ThemeColors | null
}

const storageKey = 'eviewer:theme-settings'

function loadThemeSettings(): ThemeSettings {
  const result: ThemeSettings = { mode: 'auto', preset: 'mist', custom: null }
  try {
    const mode = localStorage.getItem('eviewer-theme')
    if (mode === 'light' || mode === 'dark') result.mode = mode
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null')
    result.custom = normalizeCustomTheme(stored?.custom)
    if (themePresets.some((preset) => preset.id === stored?.preset)) result.preset = stored.preset
    else if (stored?.preset === 'custom' && result.custom) result.preset = 'custom'
  } catch {
    // Appearance still works when storage is unavailable or an old setting is invalid.
  }
  return result
}

export const themeSettings = reactive(loadThemeSettings())
export const activeTheme = computed<ThemePreset>(() => {
  if (themeSettings.preset === 'custom' && themeSettings.custom) {
    return { id: 'custom', name: '自定义', ...themeSettings.custom }
  }
  return themePresets.find((preset) => preset.id === themeSettings.preset) || defaultTheme
})
export const effectiveThemeScheme = ref<ThemeScheme>('light')

export function initializeThemeSettings() {
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  function applyTheme() {
    const scheme =
      themeSettings.mode === 'auto' ? (systemTheme.matches ? 'dark' : 'light') : themeSettings.mode
    effectiveThemeScheme.value = scheme
    const root = document.documentElement
    root.classList.toggle('dark', scheme === 'dark')
    root.style.colorScheme = scheme
    root.dataset.themePreset = activeTheme.value.id
    for (const [name, color] of Object.entries(paletteCssVariables(activeTheme.value[scheme]))) {
      root.style.setProperty(name, color)
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', activeTheme.value[scheme].background)
    try {
      localStorage.setItem('eviewer-theme', themeSettings.mode)
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          preset: themeSettings.preset,
          custom: themeSettings.custom,
          // The inline launch screen restores these colors before downloading the app.
          tokens: {
            light: paletteCssVariables(activeTheme.value.light),
            dark: paletteCssVariables(activeTheme.value.dark),
          },
        }),
      )
    } catch {
      // The current session can keep its theme without persistent storage.
    }
  }
  const stop = watch(themeSettings, applyTheme, { deep: true, immediate: true, flush: 'sync' })
  systemTheme.addEventListener('change', applyTheme)
  return () => {
    stop()
    systemTheme.removeEventListener('change', applyTheme)
  }
}
