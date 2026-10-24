import runtimeSource from './browser-assistant-runtime.js'
import loginSource from './auth-bridge-script.js'

export const ASSISTANT_VERSION = '2.1.0'
export const ASSISTANT_PROTOCOL = 1
export const ASSISTANT_FLAVORS = ['tampermonkey', 'userscripts']
const prefix = '/auth/bridge/'

export function isAssistantAsset(pathname) {
  return (
    pathname === prefix + 'assistant-manifest.json' ||
    ASSISTANT_FLAVORS.some((flavor) => pathname === prefix + `eviewer-assistant.${flavor}.user.js`)
  )
}

export function createAssistantManifest(origin, env = {}) {
  const local = new URL(origin).protocol === 'http:'
  return {
    schema: 1,
    environment: local ? 'development' : env.EVIEWER_PROXY_ENVIRONMENT || 'production',
    revision: env.EVIEWER_PROXY_REVISION || null,
    productionOrigin: env.EVIEWER_ASSISTANT_PRODUCTION_ORIGIN || null,
    scripts: Object.fromEntries(
      ASSISTANT_FLAVORS.map((flavor) => [
        flavor,
        {
          version: ASSISTANT_VERSION,
          protocolVersion: ASSISTANT_PROTOCOL,
          installPath: prefix + `eviewer-assistant.${flavor}.user.js`,
        },
      ]),
    ),
  }
}

export function createAssistantScript(origin, flavor, allowedOrigins = []) {
  if (!ASSISTANT_FLAVORS.includes(flavor)) throw new Error('Unknown assistant flavor')
  const origins = [...new Set([origin, ...allowedOrigins])]
  const installationUrl = origin + prefix + `eviewer-assistant.${flavor}.user.js`
  const matches = origins.map((value) => {
    const url = new URL(value)
    return `${url.protocol}//${url.hostname}/*`
  })
  const metadata = [
    '// ==UserScript==',
    `// @name EViewer 浏览器助手 (${flavor})`,
    `// @namespace ${origin}/eviewer-assistant`,
    `// @version ${ASSISTANT_VERSION}`,
    '// @description 为 EViewer 提供本机请求；仅主动授权时向对应站点加密同步原站登录凭据。',
    ...[...new Set(matches), 'https://e-hentai.org/home.php*'].map((value) => '// @match ' + value),
    `// @grant ${flavor === 'tampermonkey' ? 'GM_xmlhttpRequest' : 'GM.xmlHttpRequest'}`,
    ...(flavor === 'userscripts' ? ['// @inject-into content'] : ['// @grant GM_info']),
    '// @connect e-hentai.org',
    '// @connect upload.e-hentai.org',
    '// @connect ehgt.org',
    '// @connect hentaiverse.org',
    '// @run-at document-start',
    '// @noframes',
    `// @updateURL ${installationUrl}`,
    `// @downloadURL ${installationUrl}`,
    '// ==/UserScript==',
    '',
  ].join('\n')
  const runtime = runtimeSource.replace(
    '__ASSISTANT_CONFIG__',
    JSON.stringify({
      origins,
      flavor,
      version: ASSISTANT_VERSION,
      protocolVersion: ASSISTANT_PROTOCOL,
    }),
  )
  const login = loginSource
    .slice(loginSource.indexOf(';(function'))
    .replace('__EVIEWER_BRIDGE_CONFIG__', JSON.stringify({ origin }))
    .replace("' · 1.0.0'", JSON.stringify(' · ' + ASSISTANT_VERSION))
  return (
    metadata +
    runtime +
    '\n;(() => {\n' +
    "if (window.top !== window || location.origin !== 'https://e-hentai.org' || location.pathname !== '/home.php') return;\n" +
    'const mount = () => {\n' +
    login +
    '\n};\n' +
    "if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, {once:true});\n})()\n"
  )
}

export function assistantAssetResponse(request, env, allowedOrigins) {
  const url = new URL(request.url)
  const headers = {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  }
  if (url.pathname === prefix + 'assistant-manifest.json') {
    return Response.json(createAssistantManifest(url.origin, env), { headers })
  }
  const flavor = ASSISTANT_FLAVORS.find(
    (value) => url.pathname === prefix + `eviewer-assistant.${value}.user.js`,
  )
  return new Response(createAssistantScript(url.origin, flavor, allowedOrigins), {
    headers: {
      ...headers,
      'Content-Type': 'text/javascript; charset=utf-8',
      ...(url.searchParams.has('download')
        ? { 'Content-Disposition': `attachment; filename="eviewer-assistant.${flavor}.user.js"` }
        : {}),
    },
  })
}
