// Keep the original URL and headers so cookies, form bodies and auth origins
// remain attached to the Pages origin when calling the bound Worker.
export async function onRequest({ request, env, next }) {
  const { pathname } = new URL(request.url)
  const proxyRequest =
    ['/ehentai', '/exhentai', '/github'].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    [
      '/auth/cookies',
      '/auth/logout',
      '/hentaiverse/page',
      '/hentaiverse/form',
      '/hentaiverse/action',
      '/image-proxy',
      '/health',
    ].includes(pathname)

  if (!proxyRequest) return next()
  if (!env.EPROXY || typeof env.EPROXY.fetch !== 'function') {
    return Response.json(
      { error: '未配置 EPROXY 服务绑定' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  try {
    const boundRequest = new Request(request)
    boundRequest.headers.delete('X-EViewer-Proxy-Revision')
    if (env.EVIEWER_PROXY_REVISION) {
      boundRequest.headers.set('X-EViewer-Proxy-Revision', env.EVIEWER_PROXY_REVISION)
    }
    return await env.EPROXY.fetch(boundRequest)
  } catch {
    return Response.json(
      { error: '代理服务暂时不可用' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
