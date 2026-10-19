import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import en from './en.json'

export type AppLocale = 'zh-CN' | 'en'
function initialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'zh-CN'
  try {
    const saved = localStorage.getItem('eviewer-locale')
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* Storage is optional. */
  }
  return typeof navigator === 'undefined' || navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
}
const literal = (message: string) => message.replace(/[@|]/g, (value) => `{'${value}'}`)
export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messageResolver: (messages, key) => (messages as Record<string, string>)[key] ?? null,
  messages: {
    'zh-CN': Object.fromEntries(Object.keys(en).map((key) => [key, literal(key)])),
    en: Object.fromEntries(Object.entries(en).map(([key, value]) => [key, literal(value)])),
  },
})
export const locale = i18n.global.locale
export const getDisplayLocale = () => locale.value
const sourceTexts = new Map<string, string>()
/** Preserve source English for already-parsed HV models without changing protocol/state values. */
export function rememberSourceText(translated: string, original: string) {
  if (translated !== original) sourceTexts.set(translated, original)
  return translated
}
/** Canonical model/error text with an English rendering; parameters are system labels or values. */
export function formatSystemMessage(message: string, params: Record<string, unknown> = {}): string {
  const source = i18n.global.t(message, params, { locale: 'zh-CN' })
  const englishParams = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? i18n.global.te(value, 'en')
          ? i18n.global.t(value, {}, { locale: 'en' })
          : (sourceTexts.get(value) ?? value)
        : value,
    ]),
  )
  return rememberSourceText(source, i18n.global.t(message, englishParams, { locale: 'en' }))
}
export function setLocale(value: string) {
  if (value === 'zh-CN' || value === 'en') locale.value = value
}
export function registerMessages(messages: Record<string, string>) {
  const additional = Object.entries(messages).filter(([key]) => !i18n.global.te(key, 'en'))
  i18n.global.mergeLocaleMessage(
    'en',
    Object.fromEntries(additional.map(([key, value]) => [key, literal(value)])),
  )
  i18n.global.mergeLocaleMessage(
    'zh-CN',
    Object.fromEntries(additional.map(([key]) => [key, literal(key)])),
  )
}
/** Source-language keys keep copy changes reviewable; source data is never DOM-translated. */
export function t(message: unknown, params: Record<string, unknown> = {}): string {
  const key = String(message ?? '')
  void locale.value
  if (i18n.global.te(key, locale.value)) return i18n.global.t(key, params)
  return locale.value === 'en' ? (sourceTexts.get(key) ?? key) : key
}
watch(
  locale,
  (value) => {
    if (typeof document !== 'undefined') document.documentElement.lang = value
    if (typeof window !== 'undefined') window.__eviewerLaunch?.localize(t)
    try {
      localStorage.setItem('eviewer-locale', value)
    } catch {
      /* Storage is optional. */
    }
  },
  { immediate: true },
)
