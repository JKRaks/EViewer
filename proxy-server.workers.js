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
    allowedOrigins: ['http://localhost:5173', 'https://yourdomain.com'],
  },
  {
    path: '/exhentai',
    host: 'exhentai.org',
    schema: 'https',
    allowedOrigins: ['http://localhost:5173', 'https://yourdomain.com'],
  },
  {
    path: '/github',
    host: 'github.com',
    schema: 'https',
    allowedOrigins: ['http://localhost:5173', 'https://yourdomain.com'],
  },
]

const IMAGE_PROXY_MAX_BYTES = 15 * 1024 * 1024

function parseAllowedImageUrl(value) {
  if (!value) {
    throw new Error('缺少图片 URL')
  }

  const targetUrl = new URL(value)
  const allowedHost =
    targetUrl.hostname === 'ehgt.org' || targetUrl.hostname.endsWith('.ehgt.org')
  if (targetUrl.protocol !== 'https:' || !allowedHost) {
    throw new Error('不允许代理该图片地址')
  }
  return targetUrl
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
      cookie: request.headers.get('cookie'),
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
function handleHealthCheck() {
  const routes = ORIGIN_MAP.map((config) => ({
    path: config.path,
    target: `${config.schema}://${config.host}`,
  }))

  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Proxy server is running',
      routes,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
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
    return new Response(
      JSON.stringify({ error: '图片源站请求失败', status: response.status }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
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

/**
 * 处理代理请求
 */
async function handleProxyRequest(request, config, pathname) {
  console.log(`匹配到 ${config.path} 路径:`, pathname)
  console.log('完整 URL:', request.url)

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
    Cookie: request.headers.get('cookie'),
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
    SetCookie: response.headers.get('set-cookie'),
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
    console.log('原始 Set-Cookie:', setCookieHeader)

    const modifiedSetCookie = modifySetCookieHeaders(setCookieHeader, serverHost, config.host)
    responseHeaders.set('set-cookie', modifiedSetCookie)
    console.log('修改后的 Set-Cookie:', modifiedSetCookie)
  }

  // 如果是重定向，修改 Location 头
  if (responseHeaders.has('location')) {
    const location = responseHeaders.get('location')
    const modifiedLocation = modifyLocation(location, config, serverUrl)
    responseHeaders.set('location', modifiedLocation)
    console.log('修改重定向:', location, '->', modifiedLocation)
  }

  // 设置 CORS 头：回传请求方来源，解决跨域访问
  const requesterOrigin = getRequesterOrigin(request)
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
function handleCorsPreFlight(request) {
  const requesterOrigin = getRequesterOrigin(request)
  if (!requesterOrigin) {
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
async function handleRequest(request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // 查找匹配的配置
  const config = findOriginConfig(pathname)

  logRequest(request, config)

  // 健康检查路由
  if (pathname === '/health') {
    return handleHealthCheck()
  }

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return handleCorsPreFlight(request)
  }

  if (pathname === '/image-proxy') {
    try {
      return await handleImageProxy(request, url)
    } catch (error) {
      console.error('图片代理请求失败:', error)
      return new Response(
        JSON.stringify({ error: '图片代理请求失败', message: error.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
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
  async fetch(request) {
    return handleRequest(request)
  },
}
