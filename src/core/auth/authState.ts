import { formatSystemMessage } from '@/i18n'
import { reactive, watch } from 'vue'
import {
  connectionSettings,
  currentTransportSignal,
  invalidateTransport,
} from '@/core/connector/connectionSettings'
import { requestConnector } from '@/core/connector/connectorClient'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { clearUserConfigCache } from './userConfigCache'

interface AuthState {
  loggedIn: boolean
  memberId: string
  expiresAt?: number
  lastLoginAt?: number
}

export interface AuthResponse {
  success: boolean
  message?: string
  memberId?: string
  expiresAt?: number
}

const storageKey = 'eviewer:auth-state'
const defaultState: AuthState = {
  loggedIn: false,
  memberId: '',
  expiresAt: undefined,
  lastLoginAt: undefined,
}

function loadAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return { ...defaultState }

    const parsed = JSON.parse(stored) as Partial<AuthState>
    if (
      !parsed.loggedIn ||
      !parsed.memberId ||
      (parsed.expiresAt !== undefined && parsed.expiresAt <= Date.now())
    ) {
      localStorage.removeItem(storageKey)
      return { ...defaultState }
    }
    return {
      loggedIn: true,
      memberId: String(parsed.memberId),
      expiresAt: parsed.expiresAt,
      lastLoginAt: parsed.lastLoginAt,
    }
  } catch {
    return { ...defaultState }
  }
}

export const serverAuthState = reactive(loadAuthState())
const localAuthState = reactive<AuthState>({ ...defaultState })
export const localSession = reactive({ checking: false, paused: false, error: '', checkedAt: 0 })
export const authState = reactive({ ...defaultState, source: connectionSettings.mode })
watch(
  () => [connectionSettings.mode, { ...serverAuthState }, { ...localAuthState }] as const,
  () => {
    Object.assign(
      authState,
      connectionSettings.mode === 'local' ? localAuthState : serverAuthState,
      {
        source: connectionSettings.mode,
      },
    )
  },
  { immediate: true, flush: 'sync' },
)
watch(
  () => connectionSettings.mode,
  () => {
    clearUserConfigCache()
    Object.assign(localAuthState, defaultState, { expiresAt: undefined, lastLoginAt: undefined })
    localSession.checkedAt = 0
  },
  { flush: 'sync' },
)

/** Presence is proven by the account page; credentials never leave the extension. */
export async function refreshLocalAuthState(explicit = false, signal?: AbortSignal) {
  if (explicit) localSession.paused = false
  if (localSession.paused || localSession.checking || connectionSettings.mode !== 'local') return
  localSession.checking = true
  localSession.error = ''
  const transportSignal = currentTransportSignal()
  try {
    const result = await requestConnector(
      { url: 'https://e-hentai.org/home.php', method: 'GET' },
      { signal },
    )
    transportSignal.throwIfAborted()
    if (result.status !== 200)
      throw new Error(formatSystemMessage('源站登录检查失败，请打开源站确认访问状态'))
    const doc = new DOMParser().parseFromString(result.text, 'text/html')
    const loggedIn =
      doc.querySelectorAll('.stuffbox .homebox').length >= 3 &&
      /Image Limits/i.test(doc.body.textContent || '')
    if (!loggedIn)
      throw new Error(formatSystemMessage('未识别到源站登录会话，请在同一浏览器登录后重新检测'))
    // home.php does not reliably expose the account ID. Never borrow the server account ID.
    Object.assign(localAuthState, { loggedIn: true, memberId: '', lastLoginAt: Date.now() })
    clearUserConfigCache()
    return { success: true, credentialReady: true }
  } catch (error) {
    if (!transportSignal.aborted && !signal?.aborted) {
      Object.assign(localAuthState, defaultState, { lastLoginAt: undefined })
      localSession.error =
        error instanceof Error
          ? error.message
          : formatSystemMessage('源站登录检查失败，请打开源站确认访问状态')
    }
  } finally {
    localSession.checking = false
    localSession.checkedAt = transportSignal.aborted ? 0 : Date.now()
  }
}

export async function saveAuthCookies(memberId: string, passHash: string) {
  const response = await requestAuth('/auth/cookies', { memberId, passHash })
  applyAuthState({ ...response, memberId: response.memberId ?? memberId }, true)
}

/** Shared by manual import, browser authorization and cookie-state restoration. */
function applyAuthState(response: Pick<AuthResponse, 'memberId' | 'expiresAt'>, updated = false) {
  const previousMemberId = serverAuthState.memberId
  const nextMemberId = response.memberId || ''
  if (previousMemberId && previousMemberId !== nextMemberId) {
    clearUserConfigCache()
    void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) => {
      clearHentaiVerseState()
    })
  }
  Object.assign(serverAuthState, {
    loggedIn: true,
    memberId: nextMemberId,
    expiresAt:
      response.expiresAt ??
      (previousMemberId === nextMemberId ? serverAuthState.expiresAt : undefined),
    lastLoginAt:
      updated || !serverAuthState.lastLoginAt || previousMemberId !== nextMemberId
        ? Date.now()
        : serverAuthState.lastLoginAt,
  })
  persistAuthState()
}

/** Reads only presence/identity metadata; never exports credential values. */
export async function refreshAuthState(signal?: AbortSignal, saved?: AuthResponse) {
  if (connectionSettings.mode === 'local' && !saved) return refreshLocalAuthState(true, signal)
  return refreshServerAuthState(signal, saved)
}

export async function refreshServerAuthState(signal?: AbortSignal, saved?: AuthResponse) {
  const proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin
  const response = await fetch(new URL('/ehentai/auth/status', proxyOrigin), {
    credentials: 'include',
    cache: 'no-store',
    signal,
  })
  const result = (await response.json()) as AuthResponse & { credentialReady: boolean }
  if (!response.ok || !result.success) throw new Error(result.message || '检查登录凭据失败')
  if (result.credentialReady && result.memberId) {
    if (saved && saved.memberId !== result.memberId)
      throw new Error(formatSystemMessage('浏览器未保存登录凭据，请检查 Cookie 权限后重试'))
    applyAuthState({ ...result, expiresAt: saved?.expiresAt }, Boolean(saved))
  } else if (serverAuthState.loggedIn) {
    clearUserConfigCache()
    void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) =>
      clearHentaiVerseState(),
    )
    Object.assign(serverAuthState, defaultState, { expiresAt: undefined, lastLoginAt: undefined })
    localStorage.removeItem(storageKey)
  }
  return result
}

export async function clearAuthCookies() {
  if (connectionSettings.mode === 'local') {
    localSession.paused = true
    invalidateTransport()
    Object.assign(localAuthState, defaultState, { lastLoginAt: undefined })
    clearUserConfigCache()
    return
  }
  await requestAuth('/auth/logout')
  clearUserConfigCache()
  void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) => {
    clearHentaiVerseState()
  })
  Object.assign(serverAuthState, defaultState, { expiresAt: undefined, lastLoginAt: undefined })
  localStorage.removeItem(storageKey)
}

export function useAuthState() {
  return authState
}

export function useServerAuthState() {
  return serverAuthState
}

/** 仅在用户主动提取时读取代理当前使用的认证 Cookie。 */
export async function extractAuthCookies(signal?: AbortSignal): Promise<string> {
  const proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin
  const response = await fetch(new URL('/ehentai/auth/export', proxyOrigin), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const result = (await response.json().catch(() => ({}))) as {
    success?: boolean
    cookie?: string
    message?: string
  }
  if (!response.ok || !result.success || !result.cookie) {
    throw new Error(result.message || '提取认证 Cookie 失败')
  }
  return result.cookie
}

async function requestAuth(path: string, body?: Record<string, string>): Promise<AuthResponse> {
  const proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin
  const response = await fetch(new URL(path, proxyOrigin), {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = (await response.json().catch(() => ({}))) as Partial<AuthResponse>
  if (!response.ok || !result.success) {
    throw new Error(
      result.message || formatSystemMessage('认证请求失败 ({p0})', { p0: response.status }),
    )
  }
  return result as AuthResponse
}

function persistAuthState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(serverAuthState))
  } catch (error) {
    console.warn('保存本地登录提示失败:', error)
  }
}
