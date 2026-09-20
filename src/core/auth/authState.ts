import { reactive } from 'vue'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { clearUserConfigCache } from './userConfigCache'

interface AuthState {
  loggedIn: boolean
  memberId: string
  expiresAt?: number
  lastLoginAt?: number
}

interface AuthResponse {
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
    if (!parsed.loggedIn || !parsed.memberId || (parsed.expiresAt ?? 0) <= Date.now()) {
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
  const previousMemberId = authState.memberId
  const response = await requestAuth('/auth/cookies', { memberId, passHash })
  const now = Date.now()
  const nextMemberId = response.memberId ?? memberId
  if (previousMemberId && previousMemberId !== nextMemberId) {
    clearUserConfigCache()
    void import('@/core/hentaiverse/hentaiVerseStore').then(({ clearHentaiVerseState }) => {
      clearHentaiVerseState()
    })
  }
  Object.assign(authState, {
    loggedIn: true,
    memberId: nextMemberId,
    expiresAt: response.expiresAt,
    lastLoginAt: now,
  })
  persistAuthState()
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
    throw new Error(result.message || `认证请求失败 (${response.status})`)
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
