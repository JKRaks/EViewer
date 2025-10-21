const TARGET_DOMAIN = 'e-hentai.org'
const ALLOWED_ORIGINS = ['https://your-domain.com', 'http://localhost:5173']

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleCORS(request)
  }

  // 健康检查
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // 构建目标 URL
    const targetUrl = new URL(`https://${TARGET_DOMAIN}${url.pathname}${url.search}`)

    console.log('Proxying:', request.url, '->', targetUrl.href)

    // 创建新请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: modifyRequestHeaders(request.headers),
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual', // 手动处理重定向
    })

    // 发送请求
    const response = await fetch(proxyRequest)

    // 修改响应
    return modifyResponse(response, request)
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(
      JSON.stringify({
        error: '代理请求失败',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

function modifyRequestHeaders(headers) {
  const newHeaders = new Headers()

  // 复制必要的头
  for (const [key, value] of headers.entries()) {
    if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
      newHeaders.set(key, value)
    }
  }

  // 设置目标站点的头
  newHeaders.set('Host', TARGET_DOMAIN)
  newHeaders.set('Origin', `https://${TARGET_DOMAIN}`)
  newHeaders.set('Referer', `https://${TARGET_DOMAIN}/`)
  newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  return newHeaders
}

function modifyResponse(response, request) {
  const newHeaders = new Headers(response.headers)

  // 设置 CORS
  const origin = request.headers.get('Origin')
  if (ALLOWED_ORIGINS.includes(origin)) {
    newHeaders.set('Access-Control-Allow-Origin', origin)
    newHeaders.set('Access-Control-Allow-Credentials', 'true')
  }

  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
  newHeaders.set('Access-Control-Expose-Headers', 'Set-Cookie')

  // 修改 Set-Cookie
  if (newHeaders.has('set-cookie')) {
    const cookies = newHeaders.get('set-cookie').split(',')
    const modifiedCookies = cookies.map((cookie) =>
      cookie
        .replace(/Domain=\.?e-hentai\.org/gi, '')
        .replace(/Domain=\.?exhentai\.org/gi, '')
        .replace(/;\s*Secure/gi, '')
        .replace(/;\s*SameSite=Strict/gi, '; SameSite=None; Secure'),
    )
    newHeaders.delete('set-cookie')
    modifiedCookies.forEach((c) => newHeaders.append('Set-Cookie', c))
  }

  // 修改 Location (重定向)
  if (newHeaders.has('location')) {
    const location = newHeaders.get('location')
    if (location.startsWith('/')) {
      newHeaders.set('location', new URL(location, request.url).href)
    } else if (location.includes(TARGET_DOMAIN)) {
      newHeaders.set(
        'location',
        location.replace(new RegExp(`https?://${TARGET_DOMAIN}`, 'g'), new URL(request.url).origin),
      )
    }
  }

  // 移除安全策略头
  newHeaders.delete('x-frame-options')
  newHeaders.delete('content-security-policy')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

function handleCORS(request) {
  const origin = request.headers.get('Origin')
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Max-Age': '86400',
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return new Response(null, { status: 204, headers })
}
