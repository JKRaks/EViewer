import assert from 'node:assert/strict'
import test from 'node:test'
import app from './worker-app.js'

const proxyOrigin = 'https://proxy.example'
const frontendOrigin = 'https://viewer.example'
const authCookie = 'ipb_member_id=222; ipb_pass_hash=newFakeHash'
const env = {
  ALLOWED_ORIGINS: frontendOrigin,
  PROXY_LOG_LEVEL: 'error',
  ASSETS: { fetch: () => new Response('not an API', { status: 404 }) },
}

function request(path, options = {}) {
  return new Request(`${proxyOrigin}${path}`, {
    ...options,
    headers: { Origin: frontendOrigin, Cookie: authCookie, ...options.headers },
  })
}

function mockUpstream(t, respond = () => new Response('private data')) {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(options.cache, 'no-store')
    const upstream =
      input instanceof Request
        ? input
        : new Request(input, {
            ...options,
            ...(options?.body ? { duplex: 'half' } : {}),
          })
    calls.push(upstream)
    return respond(upstream, calls.length)
  })
  return calls
}

test('rejects host escapes and prefix lookalikes before any upstream request', async (t) => {
  const calls = mockUpstream(t)
  for (const path of [
    '/ehentai//collector.example/secret',
    '/exhentai//collector.example/secret',
    '/ehentai/\\collector.example/secret',
    '/ehentai/%2fcollector.example/secret',
    '/ehentai/%5ccollector.example/secret',
    '/ehentai//user@collector.example:443/',
    '/ehentai-other/',
    '/ehentai/%zz',
  ]) {
    const response = await app.fetch(request(path), env)
    assert.ok([400, 404].includes(response.status), `${path}: ${response.status}`)
  }
  assert.equal(calls.length, 0)
})

test('rejects untrusted origins on actual requests, preflights and auth mutations', async (t) => {
  const calls = mockUpstream(t)
  for (const Origin of ['https://evil.example', 'null', 'http://localhost:5173']) {
    for (const [path, method] of [
      ['/ehentai/', 'GET'],
      ['/hentaiverse/page', 'GET'],
      ['/auth/cookies', 'POST'],
      ['/auth/logout', 'POST'],
      ['/ehentai/auth/export', 'POST'],
      ['/ehentai/image-lookup', 'POST'],
      ['/hentaiverse/form', 'POST'],
      ['/hentaiverse/action', 'POST'],
      ['/auth/cookies', 'OPTIONS'],
      ['/ehentai/', 'OPTIONS'],
    ]) {
      const response = await app.fetch(request(path, { method, headers: { Origin } }), env)
      assert.equal(response.status, 403, `${Origin} ${path} ${method}`)
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
      assert.equal(response.headers.get('Set-Cookie'), null)
    }
  }
  for (const headers of [{}, { Origin: 'null' }, { 'Sec-Fetch-Site': 'same-origin' }]) {
    const response = await app.fetch(
      new Request(`${proxyOrigin}/auth/logout`, {
        method: 'POST',
        headers,
      }),
      env,
    )
    assert.equal(response.status, 403)
  }
  assert.equal(calls.length, 0)
})

test('same-origin and explicitly configured cross-origin frontends retain credential access', async (t) => {
  mockUpstream(t)
  for (const Origin of [proxyOrigin, frontendOrigin]) {
    const response = await app.fetch(request('/ehentai/?page=2', { headers: { Origin } }), env)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), Origin)
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true')
    const preflight = await app.fetch(
      request('/auth/cookies', {
        method: 'OPTIONS',
        headers: {
          Origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      }),
      env,
    )
    assert.equal(preflight.status, 204)
  }
  const response = await app.fetch(
    request('/ehentai/', { headers: { Origin: 'http://localhost:5173' } }),
    {
      ...env,
      ALLOWED_ORIGINS: 'http://localhost:5173',
    },
  )
  assert.equal(response.status, 200)
  const legacy = await app.fetch(request('/ehentai/'), {
    PROXY_LOG_LEVEL: 'error',
    ALLOWED_AUTH_EXPORT_ORIGINS: frontendOrigin,
  })
  assert.equal(legacy.status, 200)
  const wildcard = await app.fetch(request('/ehentai/'), { ...env, ALLOWED_ORIGINS: '*' })
  assert.equal(wildcard.status, 403)
})

test('proxy, multipart lookup and HV only forward required authentication cookies', async (t) => {
  const calls = mockUpstream(t)
  const headers = {
    Cookie: `${authCookie}; unrelated_session=extraFake; CF_Authorization=accessFake`,
    Authorization: 'Bearer fakeBearer',
    'CF-Access-Jwt-Assertion': 'fakeJWT',
    'CF-Access-Client-Secret': 'fakeSecret',
    'CF-Access-Client-Id': 'fakeId',
  }
  for (const path of ['/ehentai/?page=2', '/exhentai/', '/hentaiverse/page']) {
    assert.equal((await app.fetch(request(path, { headers }), env)).status, 200)
  }
  assert.equal(
    (
      await app.fetch(
        request('/ehentai/image-lookup', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'multipart/form-data; boundary=fake' },
          body: '--fake--',
        }),
        env,
      )
    ).status,
    200,
  )
  assert.equal(calls.length, 4)
  for (const upstream of calls) {
    assert.equal(upstream.headers.get('Cookie'), authCookie)
    for (const name of Object.keys(headers).filter((name) => name !== 'Cookie')) {
      assert.equal(upstream.headers.get(name), null, name)
    }
  }
  assert.equal(calls[0].url, 'https://e-hentai.org/?page=2')
  assert.equal(await calls[3].text(), '--fake--')
})

test('source cookies and shared caching cannot overwrite local credentials or cache private responses', async (t) => {
  mockUpstream(
    t,
    () =>
      new Response('private data', {
        headers: {
          'Set-Cookie': 'ipb_pass_hash=oldFakeHash; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/',
          'Cache-Control': 'public, max-age=300',
          'CDN-Cache-Control': 'public',
          'Cloudflare-CDN-Cache-Control': 'public',
          Vary: 'Cookie, Accept-Encoding',
          'Access-Control-Allow-Origin': 'https://evil.example',
          'Access-Control-Allow-Credentials': 'true',
        },
      }),
  )
  for (const path of ['/ehentai/', '/ehentai/image-lookup']) {
    const response = await app.fetch(
      request(
        path,
        path.endsWith('image-lookup')
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'multipart/form-data; boundary=fake' },
              body: '--fake--',
            }
          : {},
      ),
      env,
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Set-Cookie'), null)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('CDN-Cache-Control'), null)
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), null)
    assert.equal(response.headers.get('Vary'), 'Cookie, Accept-Encoding, Origin')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), frontendOrigin)
  }
})

test('conflicting credentials fail closed; logout and login clear legacy scopes before setting new cookies', async (t) => {
  const calls = mockUpstream(t)
  const Cookie = `${authCookie}; ipb_member_id=111; ipb_pass_hash=oldFakeHash`
  for (const path of ['/ehentai/', '/hentaiverse/page', '/ehentai/auth/export']) {
    const response = await app.fetch(
      request(path, {
        method: path.endsWith('export') ? 'POST' : 'GET',
        headers: { Cookie, 'Content-Type': 'application/json' },
      }),
      env,
    )
    assert.equal(response.status, 401)
    assert.match(await response.text(), /重新登录/)
  }
  assert.equal(calls.length, 0)
  for (const path of ['/auth/logout', '/auth/cookies']) {
    const response = await app.fetch(
      request(path, {
        method: 'POST',
        headers: { Cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: '222', passHash: 'newFakeHash' }),
      }),
      env,
    )
    assert.equal(response.status, 200)
    const cookies = response.headers.getSetCookie()
    const clears = cookies.filter((cookie) => cookie.includes('Max-Age=0'))
    assert.equal(clears.length, 16)
    for (const scope of ['/', '/ehentai', '/hentaiverse', '/exhentai']) {
      for (const name of ['ipb_member_id', 'ipb_pass_hash']) {
        assert.equal(
          clears.filter(
            (cookie) => cookie.startsWith(`${name}=`) && cookie.includes(`Path=${scope};`),
          ).length,
          2,
        )
      }
    }
    const active = cookies.filter((cookie) => !cookie.includes('Max-Age=0'))
    assert.equal(active.length, path.endsWith('logout') ? 0 : 4)
    for (const cookie of active) {
      assert.match(cookie, /HttpOnly/)
      assert.match(cookie, /SameSite=None/)
      assert.match(cookie, /; Secure/)
      assert.doesNotMatch(cookie, /Domain=/)
    }
    assert.deepEqual(cookies.slice(0, 16), clears)
  }
})

test('concurrent users and anonymous requests never share credentials', async (t) => {
  mockUpstream(t, async (upstream) => {
    const cookie = upstream.headers.get('Cookie') || ''
    await new Promise((resolve) => setTimeout(resolve, cookie.includes('222') ? 10 : 1))
    return new Response(cookie)
  })
  const cookies = [authCookie, 'ipb_member_id=333; ipb_pass_hash=otherFakeHash', '']
  const responses = await Promise.all(
    cookies.map((Cookie) =>
      app.fetch(
        request('/ehentai/', {
          headers: { Cookie },
        }),
        env,
      ),
    ),
  )
  assert.deepEqual(await Promise.all(responses.map((response) => response.text())), cookies)
})

test('public image proxy sends no credentials and keeps public caching', async (t) => {
  const calls = mockUpstream(
    t,
    () => new Response('fake image', { headers: { 'Content-Type': 'image/png' } }),
  )
  const response = await app.fetch(
    request('/image-proxy?url=https://ehgt.org/example.png', {
      headers: { Origin: 'https://evil.example', Authorization: 'Bearer fake' },
    }),
    env,
  )
  assert.equal(response.status, 200)
  assert.equal(calls[0].headers.get('Cookie'), null)
  assert.equal(calls[0].headers.get('Authorization'), null)
  assert.match(response.headers.get('Cache-Control'), /^public/)
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null)
})

test('image lookup follows only allowed HTTPS redirects and drops the upload body on GET', async (t) => {
  let location = 'https://e-hentai.org/?f_shash=fake'
  const calls = mockUpstream(t, (upstream) =>
    upstream.method === 'POST'
      ? new Response(null, { status: 303, headers: { Location: location } })
      : new Response('lookup result'),
  )
  const lookup = () =>
    app.fetch(
      request('/ehentai/image-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=fake' },
        body: '--fake--',
      }),
      env,
    )
  assert.equal((await lookup()).status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].method, 'GET')
  assert.equal(calls[1].headers.get('Cookie'), authCookie)
  assert.equal(calls[1].headers.get('Content-Type'), null)
  assert.equal(await calls[1].text(), '')
  for (location of [
    'https://collector.example/',
    'http://e-hentai.org/',
    'https://e-hentai.org:8443/',
    'https://user@e-hentai.org/',
  ]) {
    const count = calls.length
    const response = await lookup()
    assert.equal(response.status, 502)
    assert.equal(calls.length, count + 1)
  }
})
