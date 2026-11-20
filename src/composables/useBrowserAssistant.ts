import { onMounted, onUnmounted, watch } from 'vue'
import { connectorState, startConnector, stopConnector } from '@/core/connector/connectorClient'
import {
  connectionSettings,
  listenForConnectionSettings,
} from '@/core/connector/connectionSettings'
import { localSession, refreshLocalAuthState, refreshServerAuthState } from '@/core/auth/authState'

/** Discovery also runs in the guide; authentication starts only with app content. */
export function useBrowserAssistant(contentEnabled: () => boolean) {
  let stopStorage: (() => void) | undefined
  onMounted(() => {
    startConnector()
    stopStorage = listenForConnectionSettings()
  })
  watch(
    contentEnabled,
    (enabled, _, onCleanup) => {
      if (!enabled) return
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      void refreshServerAuthState(controller.signal).catch(() => {
        /* Existing account hint remains until verification succeeds. */
      })
    },
    { immediate: true },
  )
  watch(
    () =>
      [
        contentEnabled(),
        connectionSettings.mode,
        connectorState.phase,
        connectionSettings.site,
        localSession.checking,
      ] as const,
    ([enabled, mode, phase]) => {
      if (
        enabled &&
        mode === 'local' &&
        phase === 'ready' &&
        Date.now() - localSession.checkedAt > 5 * 60_000
      )
        void refreshLocalAuthState()
    },
    { immediate: true },
  )
  onUnmounted(() => {
    stopConnector()
    stopStorage?.()
  })
}
