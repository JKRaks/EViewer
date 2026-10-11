/**
 * Cloudflare Worker - 配置化代理脚本
 * 支持多个代理目标的灵活配置
 */

/**
 * 代理配置映射
 * 可以在 wrangler.toml 或环境变量中配置
 */
const ORIGIN_MAP = [
  {
    path: '/ehentai',
    host: 'e-hentai.org',
    schema: 'https',
    allowedOrigins: ['*'],
  },
  {
    path: '/exhentai',
    host: 'exhentai.org',
    schema: 'https',
    allowedOrigins: ['*'],
  },
  {
    path: '/github',
    host: 'github.com',
    schema: 'https',
    allowedOrigins: ['*'],
  },
]

const IMAGE_PROXY_MAX_BYTES = 15 * 1024 * 1024
const IMAGE_LOOKUP_MAX_BYTES = IMAGE_PROXY_MAX_BYTES + 1024 * 1024
const AUTH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const AUTH_COOKIE_NAMES = ['ipb_member_id', 'ipb_pass_hash']
const AUTH_COOKIE_PATHS = ['/ehentai', '/hentaiverse']
const LOCAL_DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/
const HENTAIVERSE_ORIGIN = 'https://hentaiverse.org'
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
 * 认证导出专用的来源判断，不复用普通代理的通配符 CORS 策略。
 */
export function isTrustedAuthExportOrigin(origin, requestOrigin, configuredOrigins = []) {
  if (!origin) return false
  return (
    origin === requestOrigin ||
    LOCAL_DEVELOPMENT_ORIGIN.test(origin) ||
    configuredOrigins.includes(origin)
  )
}

function parseAllowedImageUrl(value) {
  if (!value) {
    throw new Error('缺少图片 URL')
  }

  const targetUrl = new URL(value)
  const allowedHost = targetUrl.hostname === 'ehgt.org' || targetUrl.hostname.endsWith('.ehgt.org')
  if (targetUrl.protocol !== 'https:' || !allowedHost) {
    throw new Error('不允许代理该图片地址')
  }
  return targetUrl
}

function isAllowedRequesterOrigin(origin) {
  if (!origin) return true
  if (/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)) return true
  return ORIGIN_MAP.some(
    (config) => config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin),
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
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  })
  const requesterOrigin = getRequesterOrigin(request)
  if (requesterOrigin && isAllowedRequesterOrigin(requesterOrigin)) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Vary', 'Origin')
  }
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie))
  return new Response(JSON.stringify(payload), { status, headers })
}

async function handleAuthRequest(request, requestUrl) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(requesterOrigin)) {
    return jsonResponse(request, { success: false, message: '不允许的请求来源' }, 403)
  }

  if (requestUrl.pathname === '/auth/logout') {
    return jsonResponse(
      request,
      { success: true },
      200,
      AUTH_COOKIE_PATHS.flatMap((path) =>
        AUTH_COOKIE_NAMES.map((name) => buildAuthCookie(name, '', requestUrl, path, true)),
      ),
    )
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
  const memberId = normalizeAuthInput(body?.memberId, 'ipb_member_id')
  const passHash = normalizeAuthInput(body?.passHash, 'ipb_pass_hash')
  if (!/^[1-9]\d{0,19}$/.test(memberId)) {
    return jsonResponse(request, { success: false, message: 'ipb_member_id 格式不正确' }, 400)
  }
  if (!isValidPassHash(passHash)) {
    return jsonResponse(request, { success: false, message: 'ipb_pass_hash 格式不正确' }, 400)
  }

  return jsonResponse(
    request,
    { success: true, memberId, expiresAt: Date.now() + AUTH_COOKIE_MAX_AGE * 1000 },
    200,
    AUTH_COOKIE_PATHS.flatMap((path) => [
      buildAuthCookie('ipb_member_id', memberId, requestUrl, path),
      buildAuthCookie('ipb_pass_hash', passHash, requestUrl, path),
    ]),
  )
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
    headers.set('Vary', 'Origin')
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
  if (!trustedOrigin || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return authExportJsonResponse(request, { success: false, message: '不允许提取认证信息，请配置可信的前端来源' }, 403, trustedOrigin)
  }
  const cookie = getAllowedAuthCookieHeader(request.headers.get('Cookie') || '')
  const values = new Map(cookie.split('; ').map((part) => {
    const separator = part.indexOf('=')
    return [part.slice(0, separator), part.slice(separator + 1)]
  }))
  if (!AUTH_COOKIE_NAMES.every((name) => values.get(name))) {
    return authExportJsonResponse(request, { success: false, message: '当前没有完整的认证 Cookie，请重新登录' }, 401, trustedOrigin)
  }
  return authExportJsonResponse(request, { success: true, cookie }, 200, trustedOrigin)
}

function getAllowedAuthCookieHeader(cookieHeader = '') {
  const allowed = new Map()
  cookieHeader.split(';').forEach((part) => {
    const separator = part.indexOf('=')
    if (separator <= 0) return
    const name = part.slice(0, separator).trim()
    if (AUTH_COOKIE_NAMES.includes(name)) allowed.set(name, part.slice(separator + 1).trim())
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
  const response = await fetch(target, { method, headers, body, redirect: 'manual' })
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
      return fetch(next, { method: 'GET', headers, redirect: 'manual' })
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
  if (requesterOrigin && isAllowedRequesterOrigin(requesterOrigin)) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Vary', 'Origin')
  }
  const location = upstream.headers.get('location')
  if (location) headers.set('X-HentaiVerse-Location', location)
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers })
}

async function handleHentaiVerseRequest(request, requestUrl) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(requesterOrigin)) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }
  try {
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
    return jsonResponse(request, { error: error.message || 'HentaiVerse 请求失败' }, 502)
  }
}

/**
 * 根据路径找到对应的配置
 */
function findOriginConfig(pathname) {
  return ORIGIN_MAP.find((config) => pathname.startsWith(config.path))
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
 * 获取请求的主机名
 */
function getServerHost(request) {
  const url = new URL(request.url)
  return url.hostname
}

/**
 * 记录请求信息
 */
function logRequest(request, config = null) {
  const url = new URL(request.url)
  console.log('收到请求:', {
    method: request.method,
    url: request.url,
    path: url.pathname,
    query: url.search,
    config: config ? { path: config.path, host: config.host } : null,
    headers: {
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      cookie: request.headers.get('cookie') ? '[present]' : undefined,
    },
  })
}

/**
 * 修改 Set-Cookie 头
 */
function modifySetCookieHeaders(setCookieHeader, serverHost, targetHost) {
  return setCookieHeader
    .split(',')
    .map((cookie) => {
      let modifiedCookie = cookie
        .trim()
        // 替换域名为当前服务器的主机名
        .replace(new RegExp(`Domain=\\.?${escapeRegExp(targetHost)}`, 'gi'), `Domain=${serverHost}`)
        // 移除 Secure 标志（如果不是 HTTPS）
        .replace(/;\s*Secure/gi, '')
        // 调整 SameSite 策略
        .replace(/;\s*SameSite=None/gi, '; SameSite=None')
        .replace(/;\s*SameSite=Strict/gi, '; SameSite=None')

      // 如果没有 Domain，添加当前服务器的主机名
      if (!/Domain=/i.test(modifiedCookie)) {
        modifiedCookie += `; Domain=${serverHost}`
      }

      // 如果没有 SameSite，添加一个
      if (!/SameSite=/i.test(modifiedCookie)) {
        modifiedCookie += '; SameSite=None; Secure'
      }

      // 确保有 Path
      if (!/Path=/i.test(modifiedCookie)) {
        modifiedCookie += '; Path=/'
      }

      return modifiedCookie
    })
    .join(', ')
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
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let targetUrl
  try {
    targetUrl = parseAllowedImageUrl(requestUrl.searchParams.get('url'))
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response = await fetch(targetUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      Referer: 'https://e-hentai.org/',
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

  const body = await response.arrayBuffer()
  if (body.byteLength > IMAGE_PROXY_MAX_BYTES) {
    return new Response(JSON.stringify({ error: '图片体积超过限制' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headers = new Headers({
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
  })
  const requesterOrigin = getRequesterOrigin(request)
  if (requesterOrigin) {
    headers.set('Access-Control-Allow-Origin', requesterOrigin)
    headers.set('Vary', 'Origin')
  }

  return new Response(body, { status: 200, headers })
}

/** 仅将受限 multipart 图片请求转发到源站图片检索入口。 */
async function handleImageLookup(request) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(requesterOrigin)) {
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

  const allowedHosts = new Set(['upload.e-hentai.org', 'e-hentai.org'])
  let targetUrl = new URL('https://upload.e-hentai.org/image_lookup.php')
  let method = 'POST'
  let body = request.body
  let response

  for (let redirectCount = 0; redirectCount <= 6; redirectCount++) {
    const headers = new Headers(request.headers)
    headers.delete('origin')
    headers.set('Host', targetUrl.host)
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    headers.set('Referer', method === 'POST' ? 'https://e-hentai.org/' : `${targetUrl.origin}/`)
    if (method === 'GET') {
      headers.delete('content-type')
      headers.delete('content-length')
    }
    response = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
    })
    if (response.status < 300 || response.status >= 400) break

    const location = response.headers.get('location')
    if (!location) break
    targetUrl = new URL(location, targetUrl)
    if (!allowedHosts.has(targetUrl.hostname) || targetUrl.protocol !== 'https:') {
      return jsonResponse(request, { error: '图片搜索返回了不允许的重定向地址' }, 502)
    }
    method = 'GET'
    body = undefined
  }

  if (!response || (response.status >= 300 && response.status < 400)) {
    return jsonResponse(request, { error: '图片搜索重定向次数过多' }, 502)
  }
  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.delete('content-security-policy')
  responseHeaders.delete('x-frame-options')
  if (requesterOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', requesterOrigin)
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Vary', 'Origin')
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
  console.log(`匹配到 ${config.path} 路径:`, pathname)
  console.log('完整 URL:', request.url)

  const requesterOrigin = getRequesterOrigin(request)
  if (!isAllowedRequesterOrigin(requesterOrigin)) {
    return jsonResponse(request, { error: '不允许的请求来源' }, 403)
  }

  // 移除路径前缀，获取真实路径
  const realPath = pathname.replace(new RegExp(`^${escapeRegExp(config.path)}`), '') || '/'

  // 构建目标 URL
  const targetUrl = new URL(realPath, `${config.schema}://${config.host}`)
  const url = new URL(request.url)
  targetUrl.search = url.search

  console.log('代理请求详情:', {
    原始URL: request.url,
    原始路径: pathname,
    目标URL: targetUrl.toString(),
    目标路径: realPath,
    Cookie: request.headers.get('cookie') ? '[present]' : undefined,
  })

  // 构建代理请求头
  const proxyHeaders = new Headers(request.headers)

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

  const response = await fetch(proxyRequest)

  console.log('代理响应:', {
    状态码: response.status,
    Location: response.headers.get('location'),
    ContentType: response.headers.get('content-type'),
    SetCookie: response.headers.has('set-cookie') ? '[present]' : undefined,
  })

  // 创建响应
  const responseHeaders = new Headers(response.headers)

  // 获取当前服务器信息
  const serverHost = getServerHost(request)
  const serverUrl = new URL(request.url).origin

  console.log('服务器信息:', { serverHost, serverUrl })

  // 修改 Set-Cookie 头
  if (responseHeaders.has('set-cookie')) {
    const setCookieHeader = responseHeaders.get('set-cookie')

    const modifiedSetCookie = modifySetCookieHeaders(setCookieHeader, serverHost, config.host)
    responseHeaders.set('set-cookie', modifiedSetCookie)
  }

  // 如果是重定向，修改 Location 头
  if (responseHeaders.has('location')) {
    const location = responseHeaders.get('location')
    const modifiedLocation = modifyLocation(location, config, serverUrl)
    responseHeaders.set('location', modifiedLocation)
    console.log('修改重定向:', location, '->', modifiedLocation)
  }

  // 设置 CORS 头：回传请求方来源，解决跨域访问
  if (requesterOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', requesterOrigin)
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
    responseHeaders.set('Access-Control-Expose-Headers', 'Set-Cookie')
    responseHeaders.set('Vary', 'Origin')
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
  const allowed = requestUrl.pathname === '/ehentai/auth/export'
    ? isTrustedAuthExportOrigin(requesterOrigin, requestUrl.origin, allowedAuthExportOrigins)
    : isAllowedRequesterOrigin(requesterOrigin)
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
  console.log('404: 未找到路由', pathname)
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
  const allowedAuthExportOrigins = parseAllowedAuthExportOrigins(env.ALLOWED_AUTH_EXPORT_ORIGINS)

  // 查找匹配的配置
  const config = findOriginConfig(pathname)

  logRequest(request, config)

  // 健康检查路由
  if (pathname === '/health') {
    return handleHealthCheck(env)
  }

  if (request.method === 'POST' && (pathname === '/auth/cookies' || pathname === '/auth/logout')) {
    return handleAuthRequest(request, url)
  }

  if (request.method === 'POST' && pathname === '/ehentai/auth/export') {
    return handleAuthExport(request, url, allowedAuthExportOrigins)
  }

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return handleCorsPreFlight(request, url, allowedAuthExportOrigins)
  }

  if (
    pathname === '/hentaiverse/page' ||
    pathname === '/hentaiverse/form' ||
    pathname === '/hentaiverse/action'
  ) {
    return handleHentaiVerseRequest(request, url)
  }

  if (pathname === '/image-proxy') {
    try {
      return await handleImageProxy(request, url)
    } catch (error) {
      console.error('图片代理请求失败:', error)
      return new Response(JSON.stringify({ error: '图片代理请求失败', message: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (pathname === '/ehentai/image-lookup') {
    try {
      return await handleImageLookup(request)
    } catch (error) {
      console.error('图片搜索代理请求失败:', error)
      return jsonResponse(request, { error: error.message || '图片搜索代理请求失败' }, 502)
    }
  }

  // 找到配置则进行代理
  if (config) {
    try {
      return await handleProxyRequest(request, config, pathname)
    } catch (error) {
      console.error('\n========== 代理错误 ==========')
      console.error('错误:', {
        message: error.message,
        stack: error.stack,
      })

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
    const expectedRevision = request.headers.get('X-EViewer-Proxy-Revision')
    if (
      expectedRevision &&
      env?.EVIEWER_PROXY_REVISION &&
      expectedRevision !== env.EVIEWER_PROXY_REVISION
    ) {
      return jsonResponse(request, { error: '代理服务版本未同步，请等待部署完成后刷新页面' }, 503)
    }
    return handleRequest(request, env)
  },
}
