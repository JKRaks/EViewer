import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { getDisplayLocale, t } from '@/i18n'
import type { AuthResponse } from './authState'

export type BridgePhase = 'idle' | 'waiting' | 'ready' | 'claimed' | 'expired'
export interface BridgeStatus {
  success: boolean
  available?: boolean
  state: BridgePhase
  expiresAt?: number
  authorizationUrl?: string
}

export function bridgeUrl(path: string) {
  return new URL(`/auth/bridge/${path}`, new URL(eurlEnum.EH, window.location.origin).origin).href
}

export async function requestBridge<T = BridgeStatus>(
  action: 'start' | 'status' | 'claim' | 'cancel',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(bridgeUrl(action), {
    method: action === 'status' ? 'GET' : 'POST',
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: {
      'Accept-Language': getDisplayLocale(),
      ...(action === 'status' ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(action === 'status' ? {} : { body: '{}' }),
  })
  const result = (await response.json().catch(() => ({}))) as T & {
    success?: boolean
    message?: string
  }
  if (!response.ok || !result.success)
    throw new Error(t(result.message || '授权交接失败，请重新开始'))
  return result
}

export async function claimBridge(signal?: AbortSignal) {
  return requestBridge<AuthResponse>('claim', signal)
}

export async function readBridgeScript(signal?: AbortSignal) {
  const response = await fetch(bridgeUrl('script.user.js'), { cache: 'no-store', signal })
  if (!response.ok) throw new Error(t('读取授权脚本失败'))
  return response.text()
}
