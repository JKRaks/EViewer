/**
 * Cloudflare Worker - 配置化代理脚本
 * 支持多个代理目标的灵活配置
 */

/**
 * 代理配置映射
 * 可以在 wrangler.toml 或环境变量中配置
 */
import { handleAuthBridge, cancelAuthBridge, clearBridgeCookie } from './worker/auth-bridge.js'
import { assistantAssetResponse, isAssistantAsset } from './worker/browser-assistant.js'

const ORIGIN_MAP = [
  {
    path: '/ehentai',
    host: 'e-hentai.org',
    schema: 'https',
  },
  {
    path: '/exhentai',
    host: 'exhentai.org',
    schema: 'https',
  },
]

const IMAGE_PROXY_MAX_BYTES = 15 * 1024 * 1024
const IMAGE_LOOKUP_MAX_BYTES = IMAGE_PROXY_MAX_BYTES + 1024 * 1024
const AUTH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const AUTH_COOKIE_NAMES = ['ipb_member_id', 'ipb_pass_hash']
const AUTH_COOKIE_PATHS = ['/ehentai', '/hentaiverse', '/exhentai']
const HENTAIVERSE_ORIGIN = 'https://hentaiverse.org'
const REQUEST_LOGS = new WeakMap()
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

function sanitizeLogPath(pathname) {
  return pathname
    .replace(
      /\/dynjs\/[^/]+\/[^/]+\/equip-[^/]+\.js/g,
      '/dynjs/[redacted]/[redacted]/equip-[redacted].js',
    )
    .replace(/\/(g|s|equip)\/[^\s"'<>]+/g, '/$1/[redacted]')
}

function sanitizeLogText(value, request) {
  let text = String(value || '')
  // Exceptions can embed URLs or credentials. Keep their diagnostic text,
  // without copying query values, authorization headers or authentication cookies.
  const cookie = request.headers.get('cookie') || ''
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=')
    const secret = separator >= 0 ? part.slice(separator + 1).trim() : ''
    if (secret) text = text.replaceAll(secret, '[redacted]')
  }
  const authorization = request.headers.get('authorization')
  if (authorization) text = text.replaceAll(authorization, '[redacted]')
  return text
    .replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
      try {
        const url = new URL(value)
        return sanitizeLogPath(url.pathname)
      } catch {
        return '[url]'
      }
    })
    .replace(
      /((?:ipb_pass_hash|ipb_member_id|token|authorization)\s*[=:]\s*)[^\s,;&]+/gi,
      '$1[redacted]',
    )
    .replace(/\/dynjs\/[^\s"'<>]+/g, '/dynjs/[redacted]')
    .slice(0, 4096)
}

function recordRequestError(request, event, error) {
  const context = REQUEST_LOGS.get(request)
  if (!context) return
  context.failure = event
  context.error = {
    name: error?.name || 'Error',
    message: sanitizeLogText(error?.message || error, request),
    ...(error?.stack ? { stack: sanitizeLogText(error.stack, request) } : {}),
  }
}

function writeRequestLog(request, level, event, details = {}) {
  const context = REQUEST_LOGS.get(request)
  if (!context || LOG_LEVELS[level] < LOG_LEVELS[context.logLevel]) return
  console[level]({
    level,
    event,
    message: event,
    requestId: context.requestId,
    method: request.method,
    path: context.path,
    environment: context.environment,
    revision: context.revision,
    ...details,
  })
}

async function fetchUpstream(request, target, options) {
  const url = new URL(typeof target === 'string' || target instanceof URL ? target : target.url)
  const startedAt = performance.now()
  const context = REQUEST_LOGS.get(request)
  if (context) context.upstreamRequests++
  try {
    const response = await fetch(target, { ...options, cache: 'no-store' })
    const upstream = {
      host: url.hostname,
      path: sanitizeLogPath(url.pathname),
      method: options?.method || target.method || 'GET',
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    }
    if (context) context.upstream = upstream
    const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'debug'
    writeRequestLog(request, level, 'upstream.response', { upstream })
    return response
  } catch (error) {
    if (context)
      context.upstream = {
        host: url.hostname,
        path: sanitizeLogPath(url.pathname),
        method: options?.method || target.method || 'GET',
        durationMs: Math.round(performance.now() - startedAt),
      }
    recordRequestError(request, 'upstream.fetch_failed', error)
    throw error
  }
}
const HENTAIVERSE_PAGE_ROUTES = new Set([
  'Character:ch',
  'Character:eq',
  'Character:ab',
  'Character:tr',
  'Character:it',
  'Character:se',
  'Battle:ba',
  'Battle:ar',
  'Battle:rb',
  'Battle:gr',
  'Battle:iw',
])

/**
 * 解析 Worker binding 中逗号分隔的完整 HTTP(S) origin。
 * 敏感认证导出不接受通配符、路径或无效 URL。
 */
export function parseAllowedAuthExportOrigins(value = '') {
  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => {
      if (!origin || origin === '*') return false
      try {
        const url = new URL(origin)
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin
      } catch {
        return false
      }
    })
}

/**
 * 凭据接口只信任同源或明确配置的完整来源，包括本地开发来源。
 */
export function isTrustedAuthExportOrigin(origin, requestOrigin, configuredOrigins = []) {
  if (!origin) return false
  return origin === requestOrigin || configuredOrigins.includes(origin)
}

function parseAllowedImageUrl(value, allowEx = false) {
  if (!value) {
    throw new Error('缺少图片 URL')
  }

  const targetUrl = new URL(value)
  const allowedHost =
    targetUrl.hostname === 'ehgt.org' ||
    targetUrl.hostname.endsWith('.ehgt.org') ||
    (allowEx && targetUrl.hostname === 'exhentai.org' && targetUrl.pathname.startsWith('/t/'))
  if (
    targetUrl.protocol !== 'https:' ||
    !allowedHost ||
    targetUrl.port ||
    targetUrl.username ||
    targetUrl.password
  ) {
    throw new Error('不允许代理该图片地址')
  }
  return targetUrl
}

function isAllowedRequesterOrigin(request) {
  const origin = getRequesterOrigin(request)
  if (!origin) {
    // Same-origin fetches may omit Origin. Never authorize an unsafe request
    // from Fetch Metadata alone; CLI reads remain usable without browser headers.
    return (
      ['GET', 'HEAD'].includes(request.method) &&
      !['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))
    )
  }
  return isTrustedAuthExportOrigin(
    origin,
    new URL(request.url).origin,
    REQUEST_LOGS.get(request)?.allowedOrigins || [],
  )
}

function buildUpstreamHeaders(request) {
  const headers = new Headers()
  for (const name of ['accept', 'accept-language', 'content-type']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const cookie = getAllowedAuthCookieHeader(
    request.headers.get('cookie') || '',
    new URL(request.url).pathname.startsWith('/exhentai/'),
  )
  // EH redirects inline_set=dm_e after setting sl=dm_2. Keep the Extended
  // layout required by gallery parsers without persisting upstream cookies.
  headers.set('Cookie', [cookie, 'sl=dm_2'].filter(Boolean).join('; '))
  return headers
}

function appendOriginVary(headers) {
  const vary = headers.get('Vary') || ''
  if (vary === '*' || vary.split(',').some((value) => value.trim().toLowerCase() === 'origin'))
    return
  headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
}

// Clear every scope produced by older proxy versions before installing a new
// host-only credential. A leading dot and no dot identify the same Domain scope.
function clearLegacyAuthCookies(requestUrl) {
  return ['/', ...AUTH_COOKIE_PATHS].flatMap((path) =>
    [...AUTH_COOKIE_NAMES, 'igneous'].flatMap((name) => {
      const cookie = buildAuthCookie(name, '', requestUrl, path, true)
      return [cookie, `${cookie}; Domain=${requestUrl.hostname}`]
    }),
  )
}

function normalizeAuthInput(value, cookieName) {
  if (typeof value !== 'string') return ''
  const input = value.trim()
  const cookiePart = input
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  return (cookiePart ? cookiePart.slice(cookieName.length + 1) : input).trim()
}

function isValidPassHash(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 256 &&
    !/[;\r\n\0]/.test(value)
  )
}

function buildAuthCookie(name, value, requestUrl, path, clear = false) {
  const secure = requestUrl.protocol === 'https:'
  const attributes = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    `Path=${path}`,
    clear ? 'Max-Age=0' : `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

function jsonResponse(request, payload, status = 200, cookies = []) {
  if (status >= 400) {
    const context = REQUEST_LOGS.get(request)
    if (context) context.reason = sanitizeLogText(payload.error || payload.message, request)
  }
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  })
  const requesterOrigin = getRequesterOrigin(request)
  if (requesterOrigin && isAllowedRequesterOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    appendOriginVary(headers)
  }
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie))
  return new Response(JSON.stringify(payload), { status, headers })
}

function installAuthCookies(request, requestUrl, body) {
  const memberId = normalizeAuthInput(body?.memberId, 'ipb_member_id')
  const passHash = normalizeAuthInput(body?.passHash, 'ipb_pass_hash')
  const igneous = normalizeAuthInput(body?.igneous, 'igneous')
  if (igneous && !/^[A-Za-z0-9_-]{1,256}$/.test(igneous))
    return jsonResponse(request, { success: false, message: 'igneous 格式不正确' }, 400)
  if (!/^[1-9]\d{0,19}$/.test(memberId)) {
    return jsonResponse(request, { success: false, message: 'ipb_member_id 格式不正确' }, 400)
  }
  if (!isValidPassHash(passHash)) {
    return jsonResponse(request, { success: false, message: 'ipb_pass_hash 格式不正确' }, 400)
  }
  return jsonResponse(
    request,
    {
      success: true,
      credentialReady: true,
      memberId,
      expiresAt: Date.now() + AUTH_COOKIE_MAX_AGE * 1000,
    },
    200,
    [
      ...clearLegacyAuthCookies(requestUrl),
      ...(igneous ? [buildAuthCookie('igneous', igneous, requestUrl, '/exhentai')] : []),
      ...AUTH_COOKIE_PATHS.flatMap((path) => [
        buildAuthCookie('ipb_member_id', memberId, requestUrl, path),
        buildAuthCookie('ipb_pass_hash', passHash, requestUrl, path),
      ]),
    ],
  )
}

async function handleAuthRequest(request, requestUrl, env) {
  if (!isAllowedRequesterOrigin(request)) {
    return jsonResponse(request, { success: false, message: '不允许的请求来源' }, 403)
  }

  if (requestUrl.pathname === '/auth/logout') {
    await cancelAuthBridge(request, env).catch(() => {})
    return jsonResponse(request, { success: true }, 200, [
      ...clearLegacyAuthCookies(requestUrl),
      clearBridgeCookie(requestUrl, buildAuthCookie),
    ])
  }

  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 4096) {
    return jsonResponse(request, { success: false, message: '请求内容过大' }, 413)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, { success: false, message: '请求格式不正确' }, 400)
  }
  const response = installAuthCookies(request, requestUrl, body)
  if (response.ok) {
    await cancelAuthBridge(request, env).catch(() => {})
    response.headers.append('Set-Cookie', clearBridgeCookie(requestUrl, buildAuthCookie))
  }
  return response
}

function authExportJsonResponse(request, payload, status, trustedOrigin) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  })
  const origin = request.headers.get('Origin')
  if (trustedOrigin && origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    appendOriginVary(headers)
  }
  return new Response(JSON.stringify(payload), { status, headers })
}

function handleAuthExport(request, requestUrl, allowedAuthExportOrigins) {
  const origin = request.headers.get('Origin')
  const trustedOrigin = isTrustedAuthExportOrigin(
    origin,
    requestUrl.origin,
    allowedAuthExportOrigins,
  )
  if (
    !trustedOrigin ||
    !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')
  ) {
    return authExportJsonResponse(
      request,
      { success: false, message: '不允许提取认证信息，请配置可信的前端来源' },
      403,
      trustedOrigin,
    )
  }
  const cookie = getAllowedAuthCookieHeader(
    request.headers.get('Cookie') || '',
    requestUrl.pathname === '/exhentai/auth/export',
  )
  const values = new Map(
    cookie.split('; ').map((part) => {
      const separator = part.indexOf('=')
      return [part.slice(0, separator), part.slice(separator + 1)]
    }),
  )
  if (!AUTH_COOKIE_NAMES.every((name) => values.get(name))) {
    return authExportJsonResponse(
      request,
      { success: false, message: '当前没有完整的认证 Cookie，请重新登录' },
      401,
      trustedOrigin,
    )
  }
  return authExportJsonResponse(request, { success: true, cookie }, 200, trustedOrigin)
}

function getAllowedAuthCookieHeader(cookieHeader = '', includeIgneous = false) {
  const allowed = new Map()
  cookieHeader.split(';').forEach((part) => {
    const separator = part.indexOf('=')
    if (separator <= 0) return
    const name = part.slice(0, separator).trim()
    if (!AUTH_COOKIE_NAMES.includes(name) && !(includeIgneous && name === 'igneous')) return
    const value = part.slice(separator + 1).trim()
    if (allowed.has(name) && allowed.get(name) !== value) {
      throw new Error('认证 Cookie 冲突，请退出后重新登录')
    }
    allowed.set(name, value)
  })
  return Array.from(allowed, ([name, value]) => `${name}=${value}`).join('; ')
}

function parseHentaiVersePageTarget(query) {
  const section = query.get('s') || ''
  const subsection = query.get('ss') || ''
  if (!section && !subsection) return new URL('/', HENTAIVERSE_ORIGIN)
  if (!HENTAIVERSE_PAGE_ROUTES.has(`${section}:${subsection}`)) {
    throw new Error('不允许访问该 HentaiVerse 页面')
  }
  const target = new URL('/', HENTAIVERSE_ORIGIN)
  target.searchParams.set('s', section)
  target.searchParams.set('ss', subsection)
  const encounter = query.get('encounter')
  if (section === 'Battle' && subsection === 'ba' && encounter) {
    if (!/^[A-Za-z0-9+/=_-]{20,512}$/.test(encounter)) throw new Error('遭遇令牌格式不正确')
    target.searchParams.set('encounter', encounter)
  }
  const equipSlot = query.get('equip_slot')
  if (section === 'Character' && subsection === 'eq' && equipSlot) {
    if (!/^\d{1,4}$/.test(equipSlot)) throw new Error('装备槽位格式不正确')
    target.searchParams.set('equip_slot', equipSlot)
  }
  const tree = query.get('tree')
  if (section === 'Character' && subsection === 'ab' && tree) {
    if (!/^[a-z0-9]{1,32}$/.test(tree)) throw new Error('能力树格式不正确')
    target.searchParams.set('tree', tree)
  }
  const filter = query.get('filter')
  if (section === 'Battle' && subsection === 'iw' && filter) {
    if (
      !/^(weapon_1handed|weapon_2handed|weapon_staff|shield|armor_cloth|armor_light|armor_heavy)$/.test(
        filter,
      )
    )
      throw new Error('装备分类格式不正确')
    target.searchParams.set('filter', filter)
  }
  return target
}

const HENTAIVERSE_FORM_ROUTES = {
  character: { s: 'Character', ss: 'ch' },
  persona: { s: 'Character', ss: 'ch' },
  equipment: { s: 'Character', ss: 'eq' },
  abilities: { s: 'Character', ss: 'ab' },
  training: { s: 'Character', ss: 'tr' },
  inventory: { s: 'Character', ss: 'it' },
  settings: { s: 'Character', ss: 'se' },
  arena: { s: 'Battle', ss: 'ar' },
  ringOfBlood: { s: 'Battle', ss: 'rb' },
  grindfest: { s: 'Battle', ss: 'gr' },
  itemWorld: { s: 'Battle', ss: 'iw' },
}

function parseHentaiVerseEquipmentSource(path, cookieHeader) {
  const match =
    typeof path === 'string' &&
    path.match(/^\/dynjs\/\d{1,20}\/[a-zA-Z0-9_-]{1,64}\/equip-([1-9]\d{0,19})\.js$/)
  if (!match) throw new Error('不允许访问该装备数据资源')
  const cookie = getAllowedAuthCookieHeader(cookieHeader)
  const memberId = cookie.match(/(?:^|; )ipb_member_id=(\d+)(?:;|$)/)?.[1]
  if (!memberId || memberId !== match[1] || !cookie.includes('ipb_pass_hash='))
    throw new Error('装备数据与当前账号不匹配，请重新登录')
  return new URL(path, HENTAIVERSE_ORIGIN)
}

function isAllowedHentaiVerseFormField(section, name, value) {
  if (name === 'eqids[]') {
    return (
      ['equipment', 'itemWorld'].includes(section) &&
      Array.isArray(value) &&
      value.length === 1 &&
      value.every((id) => typeof id === 'string' && /^\d{1,12}$/.test(id))
    )
  }
  const scalar =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  if (!scalar || String(value).length > 4096 || /[\0\r\n]/.test(String(value))) return false
  const fields = {
    character: /^(attr_apply|str_delta|dex_delta|agi_delta|end_delta|int_delta|wis_delta)$/,
    persona: /^(persona_set|persona_rename|persona_create)$/,
    equipment: /^(postoken|equip_set|equip_slot|action)$/,
    abilities: /^(unlock_ability|reset_ability|reset_all|unlock_slot|equip_slot|equip_ability)$/,
    training: /^(start_train|cancel_train)$/,
    inventory: /^(slot|item)$/,
    settings:
      /^(?:[1-9]|1[0-6]|difflevel|title_override|font(?:local|face|size|wght|style|off)|eqs_(?:ability|item|skillbar)|vitalstyle|trophyupgrade|ac_[0-4]|as_[cs]_\d{1,3}|submit)$/,
    arena: /^[a-z][a-z0-9_[\]-]{0,63}$/i,
    ringOfBlood: /^[a-z][a-z0-9_[\]-]{0,63}$/i,
    grindfest: /^[a-z][a-z0-9_[\]-]{0,63}$/i,
    itemWorld: /^[a-z][a-z0-9_[\]-]{0,63}$/i,
  }
  return fields[section]?.test(name) === true
}

async function requestHentaiVerse(request, target, method, body, contentType) {
  const headers = new Headers({
    Accept:
      method === 'POST' && contentType === 'application/json'
        ? 'application/json'
        : 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    Referer: `${HENTAIVERSE_ORIGIN}/`,
    'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
  })
  if (contentType) headers.set('Content-Type', contentType)
  const cookie = getAllowedAuthCookieHeader(request.headers.get('cookie') || '')
  if (cookie) headers.set('Cookie', cookie)
  const response = await fetchUpstream(request, target, {
    method,
    headers,
    body,
    redirect: 'manual',
  })
  if (
    method === 'POST' &&
    contentType?.startsWith('application/x-www-form-urlencoded') &&
    [302, 303].includes(response.status) &&
    response.headers.get('location')
  ) {
    const location = new URL(response.headers.get('location'), target)
    if (location.origin === HENTAIVERSE_ORIGIN && location.pathname === '/') {
      const next = parseHentaiVersePageTarget(location.searchParams)
      await response.body?.cancel()
      headers.delete('Content-Type')
      return fetchUpstream(request, next, { method: 'GET', headers, redirect: 'manual' })
    }
  }
  return response
}

async function sendHentaiVerseResponse(request, upstream) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=UTF-8',
  })
  const requesterOrigin = getRequesterOrigin(request)
  if (requesterOrigin && isAllowedRequesterOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    appendOriginVary(headers)
  }
  const location = upstream.headers.get('location')
  if (location) headers.set('X-HentaiVerse-Location', location)
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers })
}

async function handleHentaiVerseRequest(request, requestUrl) {
  if (!isAllowedRequesterOrigin(request)) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }
  try {
    if (request.method === 'GET' && requestUrl.pathname === '/hentaiverse/equipment-data') {
      let target
      try {
        target = parseHentaiVerseEquipmentSource(
          requestUrl.searchParams.get('path'),
          request.headers.get('cookie') || '',
        )
      } catch (error) {
        return jsonResponse(request, { error: error.message }, 400)
      }
      const response = await sendHentaiVerseResponse(
        request,
        await requestHentaiVerse(request, target, 'GET'),
      )
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('Content-Type', 'text/plain; charset=UTF-8')
      return response
    }
    if (request.method === 'GET' && requestUrl.pathname === '/hentaiverse/page') {
      const target = parseHentaiVersePageTarget(requestUrl.searchParams)
      return sendHentaiVerseResponse(request, await requestHentaiVerse(request, target, 'GET'))
    }
    if (request.method !== 'POST') return jsonResponse(request, { error: '请求方法不正确' }, 405)
    const contentLength = Number(request.headers.get('content-length') || '0')
    if (contentLength > 131072) return jsonResponse(request, { error: '请求内容过大' }, 413)
    const body = await request.json()
    if (requestUrl.pathname === '/hentaiverse/action') {
      const { token, mode, target = 0, skill = 0 } = body || {}
      const modes = new Set(['attack', 'magic', 'items', 'spirit', 'defend', 'focus'])
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(token) || !modes.has(mode)) {
        return jsonResponse(request, { error: 'HentaiVerse 战斗动作格式不正确' }, 400)
      }
      if (
        !Number.isInteger(target) ||
        target < 0 ||
        target > 100 ||
        !Number.isInteger(skill) ||
        skill < 0 ||
        skill > 1000000
      ) {
        return jsonResponse(request, { error: 'HentaiVerse 战斗目标格式不正确' }, 400)
      }
      const payload = JSON.stringify({
        type: 'battle',
        method: 'action',
        token,
        mode,
        target,
        skill,
      })
      return sendHentaiVerseResponse(
        request,
        await requestHentaiVerse(
          request,
          new URL('/json', HENTAIVERSE_ORIGIN),
          'POST',
          payload,
          'application/json',
        ),
      )
    }
    if (requestUrl.pathname === '/hentaiverse/form') {
      const section = String(body?.section || '')
      const route = HENTAIVERSE_FORM_ROUTES[section]
      const data = body?.data
      if (!route || !data || typeof data !== 'object' || Array.isArray(data)) {
        return jsonResponse(request, { error: 'HentaiVerse 表单格式不正确' }, 400)
      }
      const entries = Object.entries(data)
      if (
        !entries.length ||
        entries.length > 400 ||
        entries.some(([name, value]) => !isAllowedHentaiVerseFormField(section, name, value))
      ) {
        return jsonResponse(request, { error: 'HentaiVerse 表单包含不允许的字段' }, 400)
      }
      const target = new URL('/', HENTAIVERSE_ORIGIN)
      target.searchParams.set('s', route.s)
      target.searchParams.set('ss', route.ss)
      if (section === 'itemWorld' && body?.target?.filter) {
        const pageTarget = parseHentaiVersePageTarget(
          new URLSearchParams({ ...route, filter: body.target.filter }),
        )
        target.search = pageTarget.search
      }
      const form = new URLSearchParams(
        entries.flatMap(([name, value]) =>
          (Array.isArray(value) ? value : [value]).map((item) => [name, String(item)]),
        ),
      )
      return sendHentaiVerseResponse(
        request,
        await requestHentaiVerse(
          request,
          target,
          'POST',
          form,
          'application/x-www-form-urlencoded; charset=UTF-8',
        ),
      )
    }
    return jsonResponse(request, { error: 'Not found' }, 404)
  } catch (error) {
    recordRequestError(request, 'hentaiverse.request_failed', error)
    return jsonResponse(request, { error: error.message || 'HentaiVerse 请求失败' }, 502)
  }
}

/**
 * 根据路径找到对应的配置
 */
function findOriginConfig(pathname) {
  return ORIGIN_MAP.find(
    (config) => pathname === config.path || pathname.startsWith(`${config.path}/`),
  )
}

/**
 * 获取请求方来源（优先 Origin，其次 Referer）
 */
function getRequesterOrigin(request) {
  const origin = request.headers.get('origin')
  if (origin) {
    return origin
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      return null
    }
  }

  return null
}

/**
 * 修改重定向位置
 */
function modifyLocation(location, config, serverUrl) {
  const targetUrl = `${config.schema}://${config.host}`

  if (location.startsWith('/')) {
    return `${config.path}${location}`
  } else if (location.startsWith(targetUrl)) {
    return location.replace(targetUrl, `${serverUrl}${config.path}`)
  } else if (
    location.startsWith(`http://${config.host}`) ||
    location.startsWith(`https://${config.host}`)
  ) {
    return location.replace(
      new RegExp(`https?://${escapeRegExp(config.host)}`),
      `${serverUrl}${config.path}`,
    )
  }
  return location
}

/**
 * 转义正则表达式中的特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 处理健康检查
 */
function handleHealthCheck(env) {
  const routes = ORIGIN_MAP.map((config) => ({
    path: config.path,
    target: `${config.schema}://${config.host}`,
  }))

  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Proxy server is running',
      routes,
      revision: env.EVIEWER_PROXY_REVISION || null,
      environment: env.EVIEWER_PROXY_ENVIRONMENT || null,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  )
}

/**
 * 处理封面图片代理请求
 */
async function handleImageProxy(request, requestUrl) {
  const ex = requestUrl.pathname === '/exhentai/image-proxy'
  if (ex && !isAllowedRequesterOrigin(request))
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let targetUrl
  try {
    targetUrl = parseAllowedImageUrl(requestUrl.searchParams.get('url'), ex)
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response = await fetchUpstream(request, targetUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(ex && targetUrl.hostname === 'exhentai.org'
        ? { Cookie: getAllowedAuthCookieHeader(request.headers.get('cookie') || '', true) }
        : {}),
      'Accept-Language': 'en-US,en;q=0.5',
      Referer: ex ? 'https://exhentai.org/' : 'https://e-hentai.org/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'manual',
  })
  if (!response.ok) {
    return new Response(JSON.stringify({ error: '图片源站请求失败', status: response.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const contentType = response.headers.get('content-type') || ''
  const contentLength = Number(response.headers.get('content-length') || '0')
  if (!contentType.toLowerCase().startsWith('image/')) {
    return new Response(JSON.stringify({ error: '上游返回内容不是图片' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (contentLength > IMAGE_PROXY_MAX_BYTES) {
    return new Response(JSON.stringify({ error: '图片体积超过限制' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await readLimitedBody(response, IMAGE_PROXY_MAX_BYTES)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return jsonResponse(request, { error: '图片体积超过限制' }, 413)
  }

  const headers = new Headers({
    'Cache-Control': ex
      ? 'private, no-store'
      : 'public, max-age=86400, stale-while-revalidate=604800',
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
  })
  const requesterOrigin = getRequesterOrigin(request)
  if (requesterOrigin) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    appendOriginVary(headers)
  }

  if (ex && requesterOrigin) headers.set('Access-Control-Allow-Credentials', 'true')
  return new Response(body, { status: 200, headers })
}

/** Stop chunked responses at the limit instead of allocating an unbounded arrayBuffer. */
export async function readLimitedBody(response, maximumBytes) {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximumBytes) {
        await reader.cancel()
        throw new RangeError('Response body exceeds size limit')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** 仅将受限 multipart 图片请求转发到源站图片检索入口。 */
async function handleImageLookup(request) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(request)) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405)
  }
  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (!contentType.startsWith('multipart/form-data;') || !contentType.includes('boundary=')) {
    return jsonResponse(request, { error: '仅支持 multipart 图片上传' }, 415)
  }
  if (contentLength > IMAGE_LOOKUP_MAX_BYTES) {
    return jsonResponse(request, { error: '上传图片体积超过限制' }, 413)
  }

  const ex = new URL(request.url).pathname.startsWith('/exhentai/')
  const allowedHosts = new Set(['upload.e-hentai.org', 'e-hentai.org', 'exhentai.org'])
  let targetUrl = new URL('https://upload.e-hentai.org/image_lookup.php')
  let method = 'POST'
  let body = request.body
  let response

  for (let redirectCount = 0; redirectCount <= 6; redirectCount++) {
    const headers = buildUpstreamHeaders(request)
    if (targetUrl.hostname !== 'exhentai.org')
      headers.set(
        'Cookie',
        [getAllowedAuthCookieHeader(request.headers.get('cookie') || ''), 'sl=dm_2']
          .filter(Boolean)
          .join('; '),
      )
    headers.delete('origin')
    headers.set('Host', targetUrl.host)
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    headers.set('Referer', method === 'POST' ? 'https://e-hentai.org/' : `${targetUrl.origin}/`)
    if (method === 'GET') {
      headers.delete('content-type')
      headers.delete('content-length')
    }
    response = await fetchUpstream(request, targetUrl, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
    })
    if (response.status < 300 || response.status >= 400) break

    const location = response.headers.get('location')
    if (!location) break
    targetUrl = new URL(location, targetUrl)
    if (
      !allowedHosts.has(targetUrl.hostname) ||
      targetUrl.protocol !== 'https:' ||
      targetUrl.port ||
      targetUrl.username ||
      targetUrl.password
    ) {
      return jsonResponse(request, { error: '图片搜索返回了不允许的重定向地址' }, 502)
    }
    method = 'GET'
    if (ex && targetUrl.hostname === 'e-hentai.org' && targetUrl.pathname === '/')
      targetUrl.hostname = 'exhentai.org'
    body = undefined
  }

  if (!response || (response.status >= 300 && response.status < 400)) {
    return jsonResponse(request, { error: '图片搜索重定向次数过多' }, 502)
  }
  const responseHeaders = new Headers(response.headers)
  for (const name of [...responseHeaders.keys()]) {
    if (name.startsWith('access-control-')) responseHeaders.delete(name)
  }
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.delete('CDN-Cache-Control')
  responseHeaders.delete('Cloudflare-CDN-Cache-Control')
  responseHeaders.delete('set-cookie')
  responseHeaders.delete('content-security-policy')
  responseHeaders.delete('x-frame-options')
  if (requesterOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', requesterOrigin)
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    appendOriginVary(responseHeaders)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

/**
 * 处理代理请求
 */
async function handleProxyRequest(request, config, pathname) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(request)) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }

  // 移除路径前缀，获取真实路径
  const realPath = pathname.replace(new RegExp(`^${escapeRegExp(config.path)}`), '') || '/'

  // 构建目标 URL
  let decodedPath
  try {
    decodedPath = decodeURIComponent(realPath)
  } catch {
    return jsonResponse(request, { error: '代理路径编码不正确' }, 400)
  }
  const expectedOrigin = `${config.schema}://${config.host}`
  const targetUrl = new URL(realPath, expectedOrigin)
  if (
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\') ||
    targetUrl.origin !== expectedOrigin ||
    targetUrl.username ||
    targetUrl.password
  ) {
    return jsonResponse(request, { error: '不允许的代理目标' }, 400)
  }
  const url = new URL(request.url)
  targetUrl.search = url.search

  // 构建代理请求头
  const proxyHeaders = buildUpstreamHeaders(request)

  // The source persists nw=session as a cookie before redirecting. Apply the
  // acknowledgement only to this gallery request instead of persisting it globally.
  if (
    request.method === 'GET' &&
    /^\/g\/\d+\/[a-f0-9]+\/?$/i.test(targetUrl.pathname) &&
    targetUrl.searchParams.get('nw') === 'session'
  ) {
    proxyHeaders.set('Cookie', `${proxyHeaders.get('Cookie')}; nw=1`)
    targetUrl.searchParams.delete('nw')
  }

  // 设置必要的请求头
  proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  proxyHeaders.set(
    'Accept',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  )
  proxyHeaders.set('Accept-Language', 'en-US,en;q=0.5')
  proxyHeaders.set('Referer', `${config.schema}://${config.host}/`)
  proxyHeaders.set('Host', config.host)

  // 移除可能导致问题的头
  proxyHeaders.delete('origin')

  // 发送代理请求
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
    redirect: 'manual', // 手动处理重定向
  })

  const response = await fetchUpstream(request, proxyRequest)

  // 创建响应
  const responseHeaders = new Headers(response.headers)
  for (const name of [...responseHeaders.keys()]) {
    if (name.startsWith('access-control-')) responseHeaders.delete(name)
  }

  const serverUrl = new URL(request.url).origin
  // Authentication is owned by /auth/cookies, never by a proxied response.
  responseHeaders.delete('set-cookie')
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.delete('CDN-Cache-Control')
  responseHeaders.delete('Cloudflare-CDN-Cache-Control')

  // 如果是重定向，修改 Location 头
  if (responseHeaders.has('location')) {
    const location = responseHeaders.get('location')
    const modifiedLocation = modifyLocation(location, config, serverUrl)
    responseHeaders.set('location', modifiedLocation)
  }

  // 设置 CORS 头：回传请求方来源，解决跨域访问
  if (requesterOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', requesterOrigin)
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
    appendOriginVary(responseHeaders)
  }

  // 移除可能干扰 cookie 设置的头
  responseHeaders.delete('x-frame-options')
  responseHeaders.delete('content-security-policy')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

/**
 * 处理 OPTIONS 请求（CORS 预检）
 */
function handleCorsPreFlight(request, requestUrl, allowedAuthExportOrigins) {
  const requesterOrigin = getRequesterOrigin(request)
  const allowed = ['/ehentai/auth/export', '/exhentai/auth/export'].includes(requestUrl.pathname)
    ? isTrustedAuthExportOrigin(requesterOrigin, requestUrl.origin, allowedAuthExportOrigins)
    : isAllowedRequesterOrigin(request)
  if (!requesterOrigin || !allowed) {
    return new Response('Forbidden', { status: 403 })
  }

  const requestHeaders =
    request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization, Cookie'
  const requestMethod =
    request.headers.get('Access-Control-Request-Method') || 'GET, POST, PUT, DELETE, OPTIONS'

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': requesterOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': requestMethod,
      'Access-Control-Allow-Headers': requestHeaders,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  })
}

/**
 * 处理 404
 */
function handle404(pathname) {
  return new Response(
    JSON.stringify({
      error: 'Not found',
      path: pathname,
      availableRoutes: ORIGIN_MAP.map((config) => config.path),
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * 主处理函数
 */
async function handleRequest(request, env = {}) {
  const url = new URL(request.url)
  const pathname = url.pathname
  const allowedAuthExportOrigins = REQUEST_LOGS.get(request).allowedOrigins

  // 查找匹配的配置
  const config = findOriginConfig(pathname)

  // 健康检查路由
  if (pathname === '/health') {
    return handleHealthCheck(env)
  }

  if (request.method === 'GET' && isAssistantAsset(pathname)) {
    return assistantAssetResponse(request, env, allowedAuthExportOrigins)
  }

  if (
    request.method !== 'OPTIONS' &&
    pathname !== '/image-proxy' &&
    !(pathname === '/auth/bridge/receive' && request.method === 'POST') &&
    !(pathname === '/auth/bridge/script.user.js' && request.method === 'GET') &&
    !isAllowedRequesterOrigin(request)
  ) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }
  // The binding existed in deployment config but was never consumed. Only use
  // Cloudflare's connection IP; a caller-controlled forwarding header is not an identity.
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (request.method !== 'OPTIONS' && clientIp && env['proxy-df']?.limit) {
    const { success } = await env['proxy-df'].limit({ key: clientIp })
    if (!success) {
      const response = jsonResponse(
        request,
        { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
        429,
      )
      response.headers.set('Retry-After', '60')
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  }
  if (pathname.startsWith('/auth/bridge/')) {
    if (request.method === 'OPTIONS')
      return handleCorsPreFlight(request, url, allowedAuthExportOrigins)
    return handleAuthBridge(request, env, {
      trusted: isAllowedRequesterOrigin,
      respond: jsonResponse,
      install: installAuthCookies,
      cookie: buildAuthCookie,
    })
  }

  // Login/logout must stay available to repair legacy conflicting cookies.
  if (!pathname.startsWith('/auth/') && request.method !== 'OPTIONS') {
    try {
      getAllowedAuthCookieHeader(request.headers.get('cookie') || '')
    } catch (error) {
      return jsonResponse(request, { error: error.message, message: error.message }, 401)
    }
  }

  if (request.method === 'POST' && (pathname === '/auth/cookies' || pathname === '/auth/logout')) {
    return handleAuthRequest(request, url, env)
  }

  if (request.method === 'GET' && pathname === '/ehentai/auth/status') {
    const values = new Map(
      getAllowedAuthCookieHeader(request.headers.get('cookie') || '')
        .split('; ')
        .filter(Boolean)
        .map((part) => {
          const index = part.indexOf('=')
          return [part.slice(0, index), part.slice(index + 1)]
        }),
    )
    const memberId = values.get('ipb_member_id') || ''
    const credentialReady =
      /^[1-9]\d{0,19}$/.test(memberId) && isValidPassHash(values.get('ipb_pass_hash'))
    return jsonResponse(request, {
      success: true,
      credentialReady,
      memberId: credentialReady ? memberId : '',
    })
  }

  if (
    request.method === 'POST' &&
    ['/ehentai/auth/export', '/exhentai/auth/export'].includes(pathname)
  ) {
    return handleAuthExport(request, url, allowedAuthExportOrigins)
  }

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return handleCorsPreFlight(request, url, allowedAuthExportOrigins)
  }

  if (
    pathname === '/hentaiverse/page' ||
    pathname === '/hentaiverse/equipment-data' ||
    pathname === '/hentaiverse/form' ||
    pathname === '/hentaiverse/action'
  ) {
    return handleHentaiVerseRequest(request, url)
  }

  if (pathname === '/image-proxy' || pathname === '/exhentai/image-proxy') {
    try {
      return await handleImageProxy(request, url)
    } catch (error) {
      recordRequestError(request, 'image.proxy_failed', error)
      return new Response(JSON.stringify({ error: '图片代理请求失败', message: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (pathname === '/ehentai/image-lookup' || pathname === '/exhentai/image-lookup') {
    try {
      return await handleImageLookup(request)
    } catch (error) {
      recordRequestError(request, 'image.lookup_failed', error)
      return jsonResponse(request, { error: error.message || '图片搜索代理请求失败' }, 502)
    }
  }

  // 找到配置则进行代理
  if (config) {
    try {
      return await handleProxyRequest(request, config, pathname)
    } catch (error) {
      recordRequestError(request, 'proxy.request_failed', error)

      return new Response(JSON.stringify({ error: '代理请求失败', message: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // 404
  return handle404(pathname)
}

/**
 * Cloudflare Worker 导出
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const startedAt = performance.now()
    const context = {
      requestId: crypto.randomUUID(),
      path: sanitizeLogPath(url.pathname),
      environment: env?.EVIEWER_PROXY_ENVIRONMENT || 'unknown',
      revision: env?.EVIEWER_PROXY_REVISION || null,
      logLevel: Object.hasOwn(LOG_LEVELS, env?.PROXY_LOG_LEVEL) ? env.PROXY_LOG_LEVEL : 'info',
      upstreamRequests: 0,
      allowedOrigins: parseAllowedAuthExportOrigins(
        `${env?.ALLOWED_ORIGINS || ''},${env?.ALLOWED_AUTH_EXPORT_ORIGINS || ''}`,
      ),
    }
    REQUEST_LOGS.set(request, context)
    writeRequestLog(request, 'debug', 'request.started', {
      queryKeys: [...url.searchParams.keys()],
      hasAuthCookie: AUTH_COOKIE_NAMES.some((name) =>
        (request.headers.get('cookie') || '').includes(`${name}=`),
      ),
    })
    let response
    try {
      response = await handleRequest(request, env)
      return response
    } catch (error) {
      recordRequestError(request, 'request.exception', error)
      throw error
    } finally {
      const status = response?.status || 500
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      writeRequestLog(request, level, 'request.completed', {
        status,
        durationMs: Math.round(performance.now() - startedAt),
        upstreamRequests: context.upstreamRequests,
        ...(context.upstream ? { upstream: context.upstream } : {}),
        ...(context.failure ? { failure: context.failure } : {}),
        ...(context.reason ? { reason: context.reason } : {}),
        ...(context.error ? { error: context.error } : {}),
      })
      REQUEST_LOGS.delete(request)
    }
  },
}
