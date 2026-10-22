import { reactive, watch } from 'vue'

export type RequestMode = 'server' | 'local'
const storageKey = 'eviewer:request-mode'
function storedMode(): RequestMode {
  try {
    return localStorage.getItem(storageKey) === 'local' ? 'local' : 'server'
  } catch {
    return 'server'
  }
}

export const connectionSettings = reactive({ mode: storedMode() })
let controller = new AbortController()
export function currentTransportSignal() {
  return controller.signal
}
export function invalidateTransport() {
  controller.abort()
  controller = new AbortController()
}
watch(
  () => connectionSettings.mode,
  (mode) => {
    invalidateTransport()
    try {
      localStorage.setItem(storageKey, mode)
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
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}
