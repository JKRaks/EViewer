import { formatSystemMessage } from '@/i18n'
import { reactive } from 'vue'
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

export const authState = reactive(loadAuthState())

export async function saveAuthCookies(memberId: string, passHash: string) {
  const response = await requestAuth('/auth/cookies', { memberId, passHash })
  applyAuthState({ ...response, memberId: response.memberId ?? memberId }, true)
}

/** Shared by manual import, browser authorization and cookie-state restoration. */
function applyAuthState(response: Pick<AuthResponse, 'memberId' | 'expiresAt'>, updated = false) {
  const previousMemberId = authState.memberId
  const nextMemberId = response.memberId || ''
  if (previousMemberId && previousMemberId !== nextMemberId) {
    clearUserConfigCache()
    void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) => {
      clearHentaiVerseState()
    })
  }
  Object.assign(authState, {
    loggedIn: true,
    memberId: nextMemberId,
    expiresAt:
      response.expiresAt ?? (previousMemberId === nextMemberId ? authState.expiresAt : undefined),
    lastLoginAt:
      updated || !authState.lastLoginAt || previousMemberId !== nextMemberId
        ? Date.now()
        : authState.lastLoginAt,
  })
  persistAuthState()
}

/** Reads only presence/identity metadata; never exports credential values. */
export async function refreshAuthState(signal?: AbortSignal, saved?: AuthResponse) {
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
  } else if (authState.loggedIn) {
    clearUserConfigCache()
    void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) =>
      clearHentaiVerseState(),
    )
    Object.assign(authState, defaultState, { expiresAt: undefined, lastLoginAt: undefined })
    localStorage.removeItem(storageKey)
  }
  return result
}

export async function clearAuthCookies() {
  await requestAuth('/auth/logout')
  clearUserConfigCache()
  void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) => {
    clearHentaiVerseState()
  })
  Object.assign(authState, defaultState, { expiresAt: undefined, lastLoginAt: undefined })
  localStorage.removeItem(storageKey)
}

export function useAuthState() {
  return authState
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
    localStorage.setItem(storageKey, JSON.stringify(authState))
  } catch (error) {
    console.warn('保存本地登录提示失败:', error)
  }
}
