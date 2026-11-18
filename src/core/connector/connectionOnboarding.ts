import { reactive } from 'vue'
import { setRequestMode, type RequestMode } from './connectionSettings'

const storageKey = 'eviewer:connection-onboarding'
type OnboardingStatus = 'pending' | 'completed'

function persistStatus(status: OnboardingStatus) {
  try {
    localStorage.setItem(storageKey, status)
  } catch {
    // The guide can still be completed for this session without storage.
  }
}

function initialStatus(): OnboardingStatus {
  let status: OnboardingStatus = 'pending'
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'pending' || saved === 'completed') return saved
    // Snapshot before i18n, theme initialization and query.site write preferences.
    // Default server users may never have written a request-mode preference.
    const historyKeys = [
      'eviewer-theme',
      'eviewer:theme-settings',
      'eviewer:request-mode',
      'eviewer:gallery-site',
      'eviewer:auth-state',
      'eviewer:indexed-db-settings',
      'eviewer:share-settings',
      'eviewer-locale',
    ]
    if (historyKeys.some((key) => localStorage.getItem(key) !== null)) status = 'completed'
  } catch {
    // A blocked storage getter is equivalent to a fresh session.
  }
  // Persist pending now, before this launch creates its own history keys.
  persistStatus(status)
  return status
}

export const connectionOnboarding = reactive({ status: initialStatus() })

export function completeConnectionOnboarding(mode: RequestMode, assistantReady: boolean) {
  if (mode === 'local' && !assistantReady) return false
  setRequestMode(mode)
  persistStatus('completed')
  connectionOnboarding.status = 'completed'
  return true
}
