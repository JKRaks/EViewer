import { reactive, watch } from 'vue'

export type RequestMode = 'server' | 'local'
export type GallerySite = 'eh' | 'ex'
const storageKey = 'eviewer:request-mode'
function storedMode(): RequestMode {
  try {
    return localStorage.getItem(storageKey) === 'local' ? 'local' : 'server'
  } catch {
    return 'server'
  }
}

function storedSite(): GallerySite {
  try {
    return localStorage.getItem('eviewer:gallery-site') === 'ex' ? 'ex' : 'eh'
  } catch {
    return 'eh'
  }
}
export const connectionSettings = reactive({ mode: storedMode(), site: storedSite() })
/** Persist explicit choices even when the default value did not change. */
export function setRequestMode(mode: RequestMode) {
  connectionSettings.mode = mode
  try {
    localStorage.setItem(storageKey, mode)
  } catch {
    /* Optional preference storage. */
  }
}
/** Account billing and overview live on E-Hentai for both gallery sites. */
export function galleryOrigin(path = '') {
  return connectionSettings.site === 'ex' &&
    !/^\/(home|bitcoin|hathperks|toplist)\.php(?:\?|$)/.test(path)
    ? 'https://exhentai.org'
    : 'https://e-hentai.org'
}
export function galleryProxyBase(base: string, path = '') {
  return galleryOrigin(path) === 'https://exhentai.org'
    ? base.replace(/\/ehentai\/?$/, '/exhentai')
    : base
}
export function galleryDownloadUrl(value: string, proxyBase: string) {
  if (/^https?:\/\//i.test(value)) return value
  const origin = galleryOrigin()
  if (connectionSettings.mode === 'local') return new URL(value, origin).href
  const base = new URL(galleryProxyBase(proxyBase), location.origin)
  return new URL(`${base.pathname.replace(/\/$/, '')}/${value.replace(/^\//, '')}`, base.origin)
    .href
}
let controller = new AbortController()
export function currentTransportSignal() {
  return controller.signal
}
export function invalidateTransport() {
  controller.abort()
  controller = new AbortController()
}
watch(
  () => [connectionSettings.mode, connectionSettings.site] as const,
  ([mode, site]) => {
    invalidateTransport()
    try {
      localStorage.setItem(storageKey, mode)
      localStorage.setItem('eviewer:gallery-site', site)
    } catch {
      /* Optional preference storage. */
    }
  },
  { flush: 'sync' },
)

export function listenForConnectionSettings() {
  const changed = (event: StorageEvent) => {
    if (event.key === storageKey)
      connectionSettings.mode = event.newValue === 'local' ? 'local' : 'server'
    if (event.key === 'eviewer:gallery-site')
      connectionSettings.site = event.newValue === 'ex' ? 'ex' : 'eh'
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}
