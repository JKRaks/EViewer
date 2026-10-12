import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import cors from 'cors'
import { Transform } from 'node:stream'

const app = express()
const PORT = process.env.PORT || 3000
const configuredAllowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || []
const ALLOWED_ORIGINS = configuredAllowedOrigins.length ? configuredAllowedOrigins : ['*']
const IMAGE_PROXY_MAX_BYTES = 15 * 1024 * 1024
const IMAGE_LOOKUP_MAX_BYTES = IMAGE_PROXY_MAX_BYTES + 1024 * 1024
const AUTH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const AUTH_COOKIE_NAMES = ['ipb_member_id', 'ipb_pass_hash']
const AUTH_COOKIE_PATHS = ['/ehentai', '/hentaiverse']
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

const isAllowedOrigin = (origin) =>
  !origin ||
  ALLOWED_ORIGINS.includes('*') ||
  ALLOWED_ORIGINS.includes(origin) ||
  /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)

const normalizeAuthInput = (value, cookieName) => {
  if (typeof value !== 'string') return ''
  const input = value.trim()
  const cookiePart = input
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  return (cookiePart ? cookiePart.slice(cookieName.length + 1) : input).trim()
}

const isValidPassHash = (value) =>
  typeof value === 'string' && value.length >= 8 && value.length <= 256 && !/[;\r\n\0]/.test(value)

const buildAuthCookie = (name, value, req, path, clear = false) => {
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    ?.trim()
  const secure = req.secure || forwardedProtocol === 'https'
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

const parseAllowedImageUrl = (value) => {
  if (typeof value !== 'string' || !value) {
    throw new Error('缺少图片 URL')
  }

  const targetUrl = new URL(value)
  const allowedHost = targetUrl.hostname === 'ehgt.org' || targetUrl.hostname.endsWith('.ehgt.org')
  if (targetUrl.protocol !== 'https:' || !allowedHost) {
    throw new Error('不允许代理该图片地址')
  }
  return targetUrl
}

// 配置 CORS（生产环境限制来源）
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin))
    },
    credentials: true, // 允许发送 Cookie
  }),
)
app.use(express.json({ limit: '128kb' }))

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log('\n========== 新请求 ==========')
  console.log('收到请求:', {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      cookie: req.headers.cookie ? '[present]' : undefined,
    },
  })
  next()
})

// 获取当前服务器的主机名（不包含端口）
const getServerHost = (req) => {
  const host = req.headers.host || `localhost:${PORT}`
  return host.split(':')[0] // 移除端口号
}

// 健康检查路由 - 必须在代理之前
app.get('/health', (req, res) => {
  console.log('健康检查请求')
  res.json({ status: 'ok', message: 'Proxy server is running' })
})

// 使用 /ehentai 路径，以便浏览器携带现有的 HttpOnly 认证 Cookie。
app.post('/ehentai/auth/export', (req, res) => {
  res.set('Cache-Control', 'no-store')
  const origin = req.headers.origin
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim()
  const sameOrigin = `${protocol}://${req.headers.host}`
  // 凭据导出不可沿用通用代理的通配符来源策略。
  const trustedOrigin = origin && (origin === sameOrigin || configuredAllowedOrigins.includes(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))
  if (!trustedOrigin || !req.is('application/json')) {
    return res.status(403).json({ success: false, message: '不允许提取认证信息，请配置可信的前端来源' })
  }
  const cookie = getAllowedAuthCookieHeader(req.headers.cookie)
  const values = new Map(cookie.split('; ').map((part) => {
    const separator = part.indexOf('=')
    return [part.slice(0, separator), part.slice(separator + 1)]
  }))
  if (!AUTH_COOKIE_NAMES.every((name) => values.get(name))) {
    return res.status(401).json({ success: false, message: '当前没有完整的认证 Cookie，请重新登录' })
  }
  return res.json({ success: true, cookie })
})

app.post('/auth/cookies', (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ success: false, message: '不允许的请求来源' })
  }

  const memberId = normalizeAuthInput(req.body?.memberId, 'ipb_member_id')
  const passHash = normalizeAuthInput(req.body?.passHash, 'ipb_pass_hash')
  if (!/^[1-9]\d{0,19}$/.test(memberId)) {
    return res.status(400).json({ success: false, message: 'ipb_member_id 格式不正确' })
  }
  if (!isValidPassHash(passHash)) {
    return res.status(400).json({ success: false, message: 'ipb_pass_hash 格式不正确' })
  }

  res.set('Cache-Control', 'no-store')
  AUTH_COOKIE_PATHS.forEach((path) => {
    res.append('Set-Cookie', buildAuthCookie('ipb_member_id', memberId, req, path))
    res.append('Set-Cookie', buildAuthCookie('ipb_pass_hash', passHash, req, path))
  })
  return res.json({ success: true, memberId, expiresAt: Date.now() + AUTH_COOKIE_MAX_AGE * 1000 })
})

app.post('/auth/logout', (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ success: false, message: '不允许的请求来源' })
  }

  res.set('Cache-Control', 'no-store')
  AUTH_COOKIE_PATHS.forEach((path) => {
    res.append('Set-Cookie', buildAuthCookie('ipb_member_id', '', req, path, true))
    res.append('Set-Cookie', buildAuthCookie('ipb_pass_hash', '', req, path, true))
  })
  return res.json({ success: true })
})

const getAllowedAuthCookieHeader = (cookieHeader = '') => {
  const allowed = new Map()
  cookieHeader.split(';').forEach((part) => {
    const separator = part.indexOf('=')
    if (separator <= 0) return
    const name = part.slice(0, separator).trim()
    if (AUTH_COOKIE_NAMES.includes(name)) {
      allowed.set(name, part.slice(separator + 1).trim())
    }
  })
  return Array.from(allowed, ([name, value]) => `${name}=${value}`).join('; ')
}

const parseHentaiVersePageTarget = (query) => {
  const section = typeof query.s === 'string' ? query.s : ''
  const subsection = typeof query.ss === 'string' ? query.ss : ''
  if (!section && !subsection) return new URL('/', HENTAIVERSE_ORIGIN)
  if (!HENTAIVERSE_PAGE_ROUTES.has(`${section}:${subsection}`)) {
    throw new Error('不允许访问该 HentaiVerse 页面')
  }

  const target = new URL('/', HENTAIVERSE_ORIGIN)
  target.searchParams.set('s', section)
  target.searchParams.set('ss', subsection)
  if (section === 'Battle' && subsection === 'ba' && query.encounter) {
    const encounter = String(query.encounter)
    if (!/^[A-Za-z0-9+/=_-]{20,512}$/.test(encounter)) throw new Error('遭遇令牌格式不正确')
    target.searchParams.set('encounter', encounter)
  }
  if (section === 'Character' && subsection === 'eq' && query.equip_slot) {
    const slot = String(query.equip_slot)
    if (!/^\d{1,4}$/.test(slot)) throw new Error('装备槽位格式不正确')
    target.searchParams.set('equip_slot', slot)
  }
  if (section === 'Character' && subsection === 'ab' && query.tree) {
    const tree = String(query.tree)
    if (!/^[a-z0-9]{1,32}$/.test(tree)) throw new Error('能力树格式不正确')
    target.searchParams.set('tree', tree)
  }
  const filter = query.filter
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

const parseHentaiVerseEquipmentSource = (path, cookieHeader) => {
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

const isAllowedHentaiVerseFormField = (section, name, value) => {
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

const requestHentaiVerse = async (req, targetUrl, method, body, contentType) => {
  const cookie = getAllowedAuthCookieHeader(req.headers.cookie)
  const headers = {
    Accept:
      method === 'POST' && contentType === 'application/json'
        ? 'application/json'
        : 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    Referer: `${HENTAIVERSE_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...(contentType && { 'Content-Type': contentType }),
    ...(cookie && { Cookie: cookie }),
  }
  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  })
  if (
    method === 'POST' &&
    contentType?.startsWith('application/x-www-form-urlencoded') &&
    [302, 303].includes(response.status) &&
    response.headers.get('location')
  ) {
    const location = new URL(response.headers.get('location'), targetUrl)
    if (location.origin === HENTAIVERSE_ORIGIN && location.pathname === '/') {
      const next = parseHentaiVersePageTarget(Object.fromEntries(location.searchParams))
      await response.body?.cancel()
      delete headers['Content-Type']
      return fetch(next, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(30000) })
    }
  }
  return response
}

const sendHentaiVerseResponse = async (res, response, contentType) => {
  const content = Buffer.from(await response.arrayBuffer())
  res.status(response.status)
  res.set('Cache-Control', 'no-store')
  res.set('Content-Type', contentType || response.headers.get('content-type') || 'text/html; charset=UTF-8')
  const location = response.headers.get('location')
  if (location) res.set('X-HentaiVerse-Location', location)
  return res.send(content)
}

app.get('/hentaiverse/page', async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: '不允许的请求来源' })
  try {
    const target = parseHentaiVersePageTarget(req.query)
    return await sendHentaiVerseResponse(res, await requestHentaiVerse(req, target, 'GET'))
  } catch (error) {
    return res.status(400).json({ error: error.message || 'HentaiVerse 页面请求失败' })
  }
})

app.get('/hentaiverse/equipment-data', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: '不允许的请求来源' })
  let target
  try {
    target = parseHentaiVerseEquipmentSource(req.query.path, req.headers.cookie)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  try {
    const response = await requestHentaiVerse(req, target, 'GET')
    res.set('X-Content-Type-Options', 'nosniff')
    return await sendHentaiVerseResponse(res, response, 'text/plain; charset=UTF-8')
  } catch (error) {
    return res.status(502).json({ error: error.message || '装备属性请求失败' })
  }
})

app.post('/hentaiverse/form', async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin))
    return res.status(403).json({ error: '不允许的请求来源' })
  const section = String(req.body?.section || '')
  const route = HENTAIVERSE_FORM_ROUTES[section]
  const data = req.body?.data
  if (!route || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'HentaiVerse 表单格式不正确' })
  }
  const entries = Object.entries(data)
  if (
    !entries.length ||
    entries.length > 400 ||
    entries.some(([name, value]) => !isAllowedHentaiVerseFormField(section, name, value))
  ) {
    return res.status(400).json({ error: 'HentaiVerse 表单包含不允许的字段' })
  }
  const form = new URLSearchParams(
    entries.flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value]).map((item) => [name, String(item)]),
    ),
  )
  const target = new URL('/', HENTAIVERSE_ORIGIN)
  target.searchParams.set('s', route.s)
  target.searchParams.set('ss', route.ss)

  try {
    if (section === 'itemWorld' && req.body?.target?.filter) {
      const pageTarget = parseHentaiVersePageTarget({ ...route, filter: req.body.target.filter })
      target.search = pageTarget.search
    }
    return await sendHentaiVerseResponse(
      res,
      await requestHentaiVerse(
        req,
        target,
        'POST',
        form,
        'application/x-www-form-urlencoded; charset=UTF-8',
      ),
    )
  } catch (error) {
    return res.status(502).json({ error: error.message || 'HentaiVerse 表单请求失败' })
  }
})

app.post('/hentaiverse/action', async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: '不允许的请求来源' })
  const { token, mode, target = 0, skill = 0 } = req.body || {}
  const allowedModes = new Set(['attack', 'magic', 'items', 'spirit', 'defend', 'focus'])
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(token) || !allowedModes.has(mode)) {
    return res.status(400).json({ error: 'HentaiVerse 战斗动作格式不正确' })
  }
  if (!Number.isInteger(target) || target < 0 || target > 100 || !Number.isInteger(skill) || skill < 0 || skill > 1000000) {
    return res.status(400).json({ error: 'HentaiVerse 战斗目标格式不正确' })
  }
  const payload = JSON.stringify({ type: 'battle', method: 'action', token, mode, target, skill })
  try {
    return await sendHentaiVerseResponse(
      res,
      await requestHentaiVerse(req, new URL('/json', HENTAIVERSE_ORIGIN), 'POST', payload, 'application/json'),
    )
  } catch (error) {
    return res.status(502).json({ error: error.message || 'HentaiVerse 回合请求失败' })
  }
})

// 封面图片代理 - 仅允许 EH 图片域名，防止成为任意 URL 代理
app.get('/image-proxy', async (req, res) => {
  let targetUrl
  try {
    targetUrl = parseAllowedImageUrl(req.query.url)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Referer: 'https://e-hentai.org/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      return res.status(502).json({ error: '图片源站请求失败', status: response.status })
    }

    const contentType = response.headers.get('content-type') || ''
    const contentLength = Number(response.headers.get('content-length') || '0')
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(502).json({ error: '上游返回内容不是图片' })
    }
    if (contentLength > IMAGE_PROXY_MAX_BYTES) {
      return res.status(413).json({ error: '图片体积超过限制' })
    }

    const body = await response.arrayBuffer()
    if (body.byteLength > IMAGE_PROXY_MAX_BYTES) {
      return res.status(413).json({ error: '图片体积超过限制' })
    }

    res.set({
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Type': contentType,
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    })
    return res.send(Buffer.from(body))
  } catch (error) {
    console.error('图片代理请求失败:', error)
    return res.status(502).json({ error: '图片代理请求失败', message: error.message })
  }
})

const createSizeLimitedStream = (source, maxBytes) => {
  let received = 0
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        const error = new Error('上传图片体积超过限制')
        error.code = 'PAYLOAD_TOO_LARGE'
        callback(error)
        return
      }
      callback(null, chunk)
    },
  })
  source.pipe(limiter)
  return limiter
}

const requestImageLookup = async (req) => {
  const allowedHosts = new Set(['upload.e-hentai.org', 'e-hentai.org'])
  const cookie = req.headers.cookie || ''
  let targetUrl = new URL('https://upload.e-hentai.org/image_lookup.php')
  let method = 'POST'
  let body = createSizeLimitedStream(req, IMAGE_LOOKUP_MAX_BYTES)

  for (let redirectCount = 0; redirectCount <= 6; redirectCount++) {
    const headers = {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: method === 'POST' ? 'https://e-hentai.org/' : `${targetUrl.origin}/`,
      ...(cookie && { Cookie: cookie }),
      ...(method === 'POST' && {
        'Content-Type': req.headers['content-type'],
        ...(req.headers['content-length'] && { 'Content-Length': req.headers['content-length'] }),
      }),
    }
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      duplex: method === 'POST' ? 'half' : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    })
    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response
    targetUrl = new URL(location, targetUrl)
    if (!allowedHosts.has(targetUrl.hostname) || targetUrl.protocol !== 'https:') {
      throw new Error('图片搜索返回了不允许的重定向地址')
    }
    method = 'GET'
    body = undefined
  }
  throw new Error('图片搜索重定向次数过多')
}

app.all('/ehentai/image-lookup', (req, res, next) => {
  if (req.method === 'POST') return next()
  return res.status(405).json({ error: 'Method not allowed' })
})

app.post('/ehentai/image-lookup', async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: '不允许的请求来源' })
  }
  const contentType = String(req.headers['content-type'] || '').toLowerCase()
  const contentLength = Number(req.headers['content-length'] || '0')
  if (!contentType.startsWith('multipart/form-data;') || !contentType.includes('boundary=')) {
    return res.status(415).json({ error: '仅支持 multipart 图片上传' })
  }
  if (contentLength > IMAGE_LOOKUP_MAX_BYTES) {
    return res.status(413).json({ error: '上传图片体积超过限制' })
  }

  try {
    const response = await requestImageLookup(req)
    const content = Buffer.from(await response.arrayBuffer())
    res.status(response.status)
    res.set('Cache-Control', 'no-store')
    res.set('Content-Type', response.headers.get('content-type') || 'text/html; charset=UTF-8')
    return res.send(content)
  } catch (error) {
    const status = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 502
    console.error('图片搜索代理请求失败:', error)
    return res.status(status).json({ error: error.message || '图片搜索代理请求失败' })
  }
})

// 代理配置
const createProxyOptions = () => ({
  target: 'https://e-hentai.org',
  changeOrigin: true,
  secure: false,
  followRedirects: false,
  // 移除 selfHandleResponse，让代理正常处理响应
  // selfHandleResponse: false,
  // logLevel: 'debug', // 启用详细日志
  logger: console, // 使用 console 作为日志记录器
  cookiePathRewrite: {
    '*': '/',
  },
  pathRewrite: {
    '^/ehentai': '', // 移除 /ehentai 前缀
  },
  on: {
    proxyReq: (proxyReq, req) => {
      // console.log('\n========== onProxyReq 被触发 ==========')
      // console.log('代理请求详情:', {
      //   原始URL: req.url,
      //   原始路径: req.path,
      //   目标URL: targetUrl,
      //   目标路径: proxyReq.path,
      //   Cookie: req.headers.cookie,
      // })

      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie)
      }

      proxyReq.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      )
      proxyReq.setHeader(
        'Accept',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      )
      proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.5')
      proxyReq.setHeader('Referer', 'https://e-hentai.org/')

      // console.log('已设置请求头')
    },
    proxyRes: (proxyRes, req) => {
      // console.log('\n========== onProxyRes 被触发 ==========')
      // console.log('代理响应:', {
      //   状态码: proxyRes.statusCode,
      //   Location: proxyRes.headers.location,
      //   ContentType: proxyRes.headers['content-type'],
      //   SetCookie: proxyRes.headers['set-cookie'],
      // })

      // 获取当前服务器的主机名
      const serverHost = getServerHost(req)
      const serverPort = req.headers.host?.split(':')[1] || PORT
      const serverUrl = `http://${serverHost}:${serverPort}`

      // console.log('服务器信息:', { serverHost, serverPort, serverUrl })

      // 修改 Set-Cookie 头
      if (proxyRes.headers['set-cookie']) {
        // console.log('原始 Set-Cookie:', proxyRes.headers['set-cookie'])

        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map((cookie) => {
          let modifiedCookie = cookie
            // 替换域名为当前服务器的主机名
            .replace(/Domain=\.?e-hentai\.org/gi, `Domain=${serverHost}`)
            .replace(/Domain=\.?exhentai\.org/gi, `Domain=${serverHost}`)
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
        // console.log('修改后的 Set-Cookie:', proxyRes.headers['set-cookie'])
      } else {
        // console.log('响应中没有 Set-Cookie 头')
      }

      // 如果是重定向，修改 Location 头
      if (proxyRes.headers.location) {
        const location = proxyRes.headers.location
        if (location.startsWith('/')) {
          proxyRes.headers.location = `/ehentai${location}`
          // console.log('修改相对路径重定向:', location, '->', proxyRes.headers.location)
        } else if (
          location.startsWith('http://e-hentai.org') ||
          location.startsWith('https://e-hentai.org')
        ) {
          proxyRes.headers.location = location.replace(
            /https?:\/\/e-hentai\.org/,
            `${serverUrl}/ehentai`,
          )
          // console.log('修改绝对路径重定向:', location, '->', proxyRes.headers.location)
        }
      }

      // 设置 CORS 头，允许 Cookie
      const origin = req.headers.origin
      delete proxyRes.headers['access-control-allow-origin']
      delete proxyRes.headers['access-control-allow-credentials']
      if (origin && isAllowedOrigin(origin)) {
        proxyRes.headers['Access-Control-Allow-Origin'] = origin
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true'
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie'
        proxyRes.headers['Access-Control-Expose-Headers'] = 'Set-Cookie'
        proxyRes.headers.Vary = 'Origin'
      }

      console.log('已设置 CORS 头')

      // 移除可能干扰 cookie 设置的头
      delete proxyRes.headers['x-frame-options']
      delete proxyRes.headers['content-security-policy']

      // console.log('========== onProxyRes 结束 ==========\n')
    },
    error: (err, req, res) => {
      // console.error('\n========== 代理错误 ==========')
      // console.error('错误:', {
      //   message: err.message,
      //   code: err.code,
      //   stack: err.stack,
      // })
      if (!res.headersSent) {
        res.status(500).json({ error: '代理请求失败', message: err.message })
      }
    },
  },
})

// 代理 /ehentai 路径
app.use(
  '/ehentai',
  (req, res, next) => {
    if (!isAllowedOrigin(req.headers.origin)) {
      return res.status(403).json({ error: '不允许的请求来源' })
    }
    // console.log('========== 进入 /ehentai 代理中间件 ==========')
    // console.log('匹配到 /ehentai 路径:', req.path)
    // console.log('完整 URL:', req.url)
    next()
  },
  createProxyMiddleware(createProxyOptions()),
)

// 404 处理
app.use((req, res) => {
  // console.log('404: 未找到路由', req.path)
  res.status(404).json({ error: 'Not found', path: req.path })
})

app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`)
  console.log(`允许的来源: ${ALLOWED_ORIGINS.join(', ')}`)
  console.log('路由配置:')
  console.log('  - GET /health (健康检查)')
  console.log('  - POST /auth/cookies (保存用户认证 Cookie)')
  console.log('  - POST /auth/logout (清除用户认证 Cookie)')
  console.log('  - GET/POST /hentaiverse/* (HentaiVerse 受控网关)')
  console.log('  - GET /image-proxy?url=... (代理 ehgt.org 图片)')
  console.log('  - ALL /ehentai/* (代理到 e-hentai.org)')
})
