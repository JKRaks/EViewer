import scriptSource from './auth-bridge-script.js'

const PREFIX = '/auth/bridge'
const PAIR_COOKIE = 'eviewer_bridge'
const PAIR_COOKIE_PATH = '/auth'
const LIFETIME = 5 * 60 * 1000
const MAX_BODY = 16 * 1024

export function pack(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function unpack(value) {
  if (typeof value !== 'string' || !/^[\w-]+$/.test(value)) throw new Error('Invalid encoding')
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  )
}

async function digest(value) {
  return pack(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

function readPair(request) {
  const value = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PAIR_COOKIE}=`))
    ?.slice(PAIR_COOKIE.length + 1)
  if (!value || !/^[a-f0-9]{64}\.[\w-]{43}$/.test(value)) return null
  const [id, secret] = value.split('.')
  return { id, secret }
}

async function sessionRequest(env, id, action, body) {
  const stub = env.AUTH_BRIDGE.get(env.AUTH_BRIDGE.idFromString(id))
  return stub.fetch(
    new Request(`https://bridge.internal/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function cancelAuthBridge(request, env) {
  const pair = readPair(request)
  if (!pair || !env.AUTH_BRIDGE) return
  await sessionRequest(env, pair.id, 'cancel', { receiverHash: await digest(pair.secret) })
}

export function clearBridgeCookie(requestUrl, buildCookie) {
  return buildCookie(PAIR_COOKIE, '', requestUrl, PAIR_COOKIE_PATH, true)
}

async function readInput(request, form = false) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('oversize')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('empty')
  const chunks = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAX_BODY) {
      await reader.cancel()
      throw new Error('oversize')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(form ? new URLSearchParams(text).get('payload') : text)
}

async function startPair(request, env, helpers) {
  await cancelAuthBridge(request, env)
  const url = new URL(request.url)
  const id = env.AUTH_BRIDGE.newUniqueId().toString()
  const secret = pack(crypto.getRandomValues(new Uint8Array(32)))
  const upload = pack(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = Date.now() + LIFETIME
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )
  const receiverKey = await crypto.subtle.importKey('raw', unpack(secret), 'AES-GCM', false, [
    'encrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const privateKey = {
    iv: pack(iv),
    data: pack(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        receiverKey,
        new TextEncoder().encode(
          JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey)),
        ),
      ),
    ),
  }
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
  const ticket = pack(
    new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        id,
        upload,
        publicKey,
        origin: url.origin,
        expiresAt,
        language: request.headers.get('Accept-Language')?.startsWith('zh') ? 'zh' : 'en',
      }),
    ),
  )
  const response = await sessionRequest(env, id, 'create', {
    receiverHash: await digest(secret),
    uploadHash: await digest(upload),
    expiresAt,
    privateKey,
  })
  if (!response.ok) throw new Error('create')
  const cookie = helpers
    .cookie(PAIR_COOKIE, `${id}.${secret}`, url, PAIR_COOKIE_PATH)
    .replace(/Max-Age=\d+/, `Max-Age=${LIFETIME / 1000}`)
  return helpers.respond(
    request,
    {
      success: true,
      state: 'waiting',
      expiresAt,
      authorizationUrl: `https://e-hentai.org/home.php#eviewer-login=${ticket}`,
    },
    200,
    [cookie],
  )
}

function receiptPage(language) {
  const chinese = language === 'zh'
  const title = chinese ? '加密凭据已提交' : 'Encrypted credentials submitted'
  const text = chinese
    ? '请返回发起授权的 EViewer 页面完成同步。可以关闭此页面。'
    : 'Return to the EViewer page that started this request to finish syncing. You may close this page.'
  return new Response(
    `<!doctype html><html lang="${chinese ? 'zh-CN' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body><h1>${title}</h1><p>${text}</p></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      },
    },
  )
}

async function receivePair(request, env, helpers) {
  if (
    request.headers.get('origin') !== 'https://e-hentai.org' ||
    !/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type') || '')
  )
    return helpers.respond(request, { success: false, message: '不允许的授权来源' }, 403)
  const input = await readInput(request, true)
  if (
    !/^[a-f0-9]{64}$/.test(input?.id) ||
    !/^[\w-]{43}$/.test(input?.upload) ||
    ![input?.envelope?.iv, input?.envelope?.encrypted, input?.envelope?.wrappedKey].every(
      (value) => typeof value === 'string' && /^[\w-]+$/.test(value),
    )
  )
    return helpers.respond(request, { success: false, message: '授权数据格式不正确' }, 400)
  const response = await sessionRequest(env, input.id, 'receive', {
    uploadHash: await digest(input.upload),
    envelope: input.envelope,
  })
  if (!response.ok)
    return helpers.respond(request, { success: false, ...(await response.json()) }, response.status)
  return receiptPage(input.language)
}

async function claimPair(request, env, helpers, pair) {
  const response = await sessionRequest(env, pair.id, 'claim', {
    receiverHash: await digest(pair.secret),
  })
  if (!response.ok)
    return helpers.respond(request, { success: false, ...(await response.json()) }, response.status)
  const { envelope, privateKey } = await response.json()
  const receiverKey = await crypto.subtle.importKey('raw', unpack(pair.secret), 'AES-GCM', false, [
    'decrypt',
  ])
  const jwk = JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unpack(privateKey.iv) },
        receiverKey,
        unpack(privateKey.data),
      ),
    ),
  )
  const rsa = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
  const rawKey = await crypto.subtle.decrypt('RSA-OAEP', rsa, unpack(envelope.wrappedKey))
  const aes = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const payload = JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unpack(envelope.iv) },
        aes,
        unpack(envelope.encrypted),
      ),
    ),
  )
  if (payload.id !== pair.id) throw new Error('binding')
  // This response installs the existing authentication cookies. No upstream request
  // is needed: acquiring both credentials is the success criterion.
  return helpers.install(request, new URL(request.url), payload)
}

export async function handleAuthBridge(request, env, helpers) {
  const url = new URL(request.url)
  const path = url.pathname.slice(PREFIX.length)
  if (path === '/script.user.js' && request.method === 'GET') {
    const source = scriptSource
      .replace('__EVIEWER_BRIDGE_CONFIG__', JSON.stringify({ origin: url.origin }))
      .replaceAll('__EVIEWER_BRIDGE_ORIGIN__', url.origin)
    return new Response(source, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ...(url.searchParams.has('download')
          ? { 'Content-Disposition': 'attachment; filename="eviewer-login.user.js"' }
          : {}),
      },
    })
  }
  if (path !== '/receive' && !helpers.trusted(request))
    return helpers.respond(request, { success: false, message: '不允许的请求来源' }, 403)
  if (!env.AUTH_BRIDGE)
    return helpers.respond(
      request,
      {
        success: path === '/status',
        available: false,
        state: 'idle',
        message: '原站授权暂未配置，请使用手动输入',
      },
      path === '/status' ? 200 : 503,
    )
  try {
    if (request.method === 'POST' && ['/start', '/claim', '/cancel'].includes(path)) {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
        return helpers.respond(request, { success: false, message: '授权数据格式不正确' }, 400)
      await readInput(request)
    }
    if (path === '/start' && request.method === 'POST')
      return await startPair(request, env, helpers)
    if (path === '/receive' && request.method === 'POST')
      return await receivePair(request, env, helpers)
    const pair = readPair(request)
    if (path === '/cancel' && request.method === 'POST') {
      await cancelAuthBridge(request, env)
      return helpers.respond(request, { success: true, state: 'idle' }, 200, [
        clearBridgeCookie(url, helpers.cookie),
      ])
    }
    if (path === '/status' && request.method === 'GET') {
      if (!pair) return helpers.respond(request, { success: true, available: true, state: 'idle' })
      const response = await sessionRequest(env, pair.id, 'status', {
        receiverHash: await digest(pair.secret),
      })
      if (response.status === 410)
        return helpers.respond(request, { success: true, available: true, state: 'expired' }, 200, [
          clearBridgeCookie(url, helpers.cookie),
        ])
      return helpers.respond(
        request,
        { available: true, ...(await response.json()) },
        response.status,
      )
    }
    if (path === '/claim' && request.method === 'POST') {
      if (!pair)
        return helpers.respond(request, { success: false, message: '授权已过期，请重新开始' }, 410)
      return await claimPair(request, env, helpers, pair)
    }
    return helpers.respond(request, { success: false, message: '未知授权接口' }, 404)
  } catch {
    // Crypto exceptions and invalid input never include submitted data in logs.
    return helpers.respond(request, { success: false, message: '授权交接失败，请重新开始' }, 400)
  }
}
