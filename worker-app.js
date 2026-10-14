import proxy from './proxy-server.workers.js'

// Keep these patterns aligned with assets.run_worker_first in wrangler.jsonc.
export const API_ROUTES = [
  '/ehentai',
  '/ehentai/*',
  '/exhentai',
  '/exhentai/*',
  '/auth/*',
  '/hentaiverse/*',
  '/image-proxy',
  '/health',
]

export function isApiPath(pathname) {
  return API_ROUTES.some((route) =>
    route.endsWith('/*') ? pathname.startsWith(route.slice(0, -1)) : pathname === route,
  )
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (isApiPath(pathname)) {
      const apiRequest = new Request(request)
      // Do not let callers select a different Worker version for an upstream request.
      apiRequest.headers.delete('Cloudflare-Workers-Version-Overrides')
      const response = await proxy.fetch(apiRequest, env)
      if (pathname !== '/health' || !response.ok) return response
      return Response.json(
        {
          ...(await response.json()),
          hosting: 'workers-static-assets',
          assets: typeof env.ASSETS?.fetch === 'function',
          version: env.EVIEWER_VERSION?.id || null,
        },
        { status: response.status, headers: response.headers },
      )
    }
    if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function')
      return Response.json(
        { error: '静态资源暂时不可用' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    return env.ASSETS.fetch(request)
  },
}
