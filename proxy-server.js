import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
const IMAGE_PROXY_MAX_BYTES = 15 * 1024 * 1024

const isAllowedOrigin = (origin) =>
  !origin ||
  ALLOWED_ORIGINS.includes(origin) ||
  /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)

const parseAllowedImageUrl = (value) => {
  if (typeof value !== 'string' || !value) {
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

// 配置 CORS（生产环境限制来源）
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin))
    },
    credentials: true, // 允许发送 Cookie
  }),
)

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
      cookie: req.headers.cookie,
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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

      // 转发客户端的 Cookie
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie)
        // console.log('转发 Cookie:', req.headers.cookie)
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
      const origin = req.headers.origin || ALLOWED_ORIGINS[0]
      proxyRes.headers['Access-Control-Allow-Origin'] = origin
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true'
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie'
      proxyRes.headers['Access-Control-Expose-Headers'] = 'Set-Cookie'

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
  console.log('  - GET /image-proxy?url=... (代理 ehgt.org 图片)')
  console.log('  - ALL /ehentai/* (代理到 e-hentai.org)')
})
