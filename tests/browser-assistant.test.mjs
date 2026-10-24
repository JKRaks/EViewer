import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import {
  createAssistantScript,
  createAssistantManifest,
  assistantAssetResponse,
  ASSISTANT_VERSION,
} from '../worker/browser-assistant.js'
import { verifyAssistant } from '../deploy/cloudflare/release.mjs'

const origin = 'https://reader.example'
const nativeRequire = createRequire(import.meta.url)
const pause = () => new Promise((resolve) => setTimeout(resolve, 0))

// Execute the actual standalone installer in two manager-shaped sandboxes. No real account requests.
function scriptHarness(flavor, options = {}) {
  const listeners = new Map(),
    messages = [],
    calls = []
  const window = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    postMessage: (message, target) => {
      assert.equal(target, origin)
      messages.push(message)
    },
  }
  window.top = options.iframe ? {} : window
  const invoke = (details) => {
    calls.push(details)
    const handle = {
      abort: () => {
        details.aborted = true
        details.onabort()
      },
    }
    if (flavor === 'userscripts') {
      const promise = new Promise((resolve) => {
        details.resolve = resolve
      })
      promise.abort = handle.abort
      return promise
    }
    return handle
  }
  const info = { script: { version: ASSISTANT_VERSION }, scriptHandler: flavor, version: 'fixture' }
  const context = {
    window,
    location: { origin, pathname: '/' },
    document: {
      documentElement: { setAttribute() {} },
      addEventListener() {},
    },
    crypto,
    URL,
    Uint8Array,
    Blob,
    FormData,
    atob,
    btoa,
    setTimeout,
    clearTimeout,
    ...(options.noApi
      ? {}
      : flavor === 'userscripts'
        ? { GM: { xmlHttpRequest: invoke, info } }
        : { GM_xmlhttpRequest: invoke, GM_info: info }),
  }
  vm.runInNewContext(createAssistantScript(origin, flavor), context)
  const identity = messages.find((message) => message.action === 'ready')?.identity
  const send = (message, eventOrigin = origin) =>
    listeners.get('message')?.({
      origin: eventOrigin,
      source: {},
      data: {
        channel: 'eviewer-browser-assistant',
        direction: 'page',
        instance: identity?.instance,
        ...message,
      },
    })
  return { identity, messages, calls, send, close: () => listeners.get('pagehide')?.() }
}

for (const flavor of ['tampermonkey', 'userscripts']) {
  test(`${flavor}: install metadata, stable identity and download response`, async () => {
    const source = createAssistantScript(origin, flavor, ['http://localhost:5183'])
    assert.ok(source.startsWith('// ==UserScript==\n'))
    assert.ok(
      !source.includes('__EVIEWER_BRIDGE_CONFIG__') && !source.includes('__ASSISTANT_CONFIG__'),
    )
    assert.match(source, /@match http:\/\/localhost\/\*/)
    assert.ok(
      source.includes(
        `@grant ${flavor === 'userscripts' ? 'GM.xmlHttpRequest' : 'GM_xmlhttpRequest'}`,
      ),
    )
    assert.ok(!source.includes('@grant none'))
    if (flavor === 'userscripts') assert.match(source, /@inject-into content/)
    const response = assistantAssetResponse(
      new Request(`${origin}/auth/bridge/eviewer-assistant.${flavor}.user.js?download=1`),
      {},
      [],
    )
    assert.match(response.headers.get('Content-Disposition'), /\.user\.js"$/)
    assert.equal(await response.text(), createAssistantScript(origin, flavor))
    const harness = scriptHarness(flavor)
    assert.equal(harness.identity.scriptVersion, ASSISTANT_VERSION)
    assert.equal(harness.identity.available, true)
    assert.equal(scriptHarness(flavor, { iframe: true }).identity, undefined)
    assert.equal(scriptHarness(flavor, { noApi: true }).identity.available, false)
  })

  test(`${flavor}: boundaries, redirected response, form encoding and binary data`, async () => {
    const h = scriptHarness(flavor)
    h.send(
      {
        action: 'request',
        id: 'foreign',
        request: { url: 'https://e-hentai.org/', method: 'GET' },
      },
      'https://foreign.example',
    )
    for (const url of [
      'http://127.0.0.1/',
      'https://evil.example/',
      'https://e-hentai.org.evil.example/',
      'https://exhentai.org/',
    ])
      h.send({ action: 'request', id: url, request: { url, method: 'GET' } })
    assert.equal(h.calls.length, 0)
    h.send({
      action: 'request',
      id: 'post',
      request: {
        url: 'https://e-hentai.org/gallerypopups.php?act=addfav',
        method: 'POST',
        body: {
          kind: 'text',
          text: 'favnote=%E4%B8%AD%E6%96%87%2B&modifygids%5B%5D=1&modifygids%5B%5D=2',
        },
      },
    })
    assert.match(h.calls[0].data, /%2B&modifygids/)
    assert.equal(h.calls[0].headers.Cookie, undefined)
    const response = {
      status: 200,
      responseText: '<html>ok</html>',
      finalUrl: 'https://e-hentai.org/g/123/abcdef/',
    }
    h.calls[0].onload(response)
    h.calls[0].resolve?.(response)
    await pause()
    assert.equal(h.messages.filter((message) => message.id === 'post').length, 1)
    assert.equal(h.messages.at(-1).result.finalUrl, response.finalUrl)
    h.send({
      action: 'request',
      id: 'image',
      request: { url: 'https://s.ehgt.org/test.jpg', method: 'GET', binary: true },
    })
    h.calls[1].onload({
      status: 200,
      response: Uint8Array.from([1, 2, 3]).buffer,
      responseHeaders: 'Content-Type: image/jpeg\r\n',
    })
    assert.equal(h.messages.at(-1).result.base64, 'AQID')
    assert.equal(h.messages.at(-1).result.mimeType, 'image/jpeg')
    h.close()
  })

  test(`${flavor}: multipart bytes, cancellation and manager timeout settle once`, () => {
    const h = scriptHarness(flavor)
    h.send({
      action: 'request',
      id: 'upload',
      request: {
        url: 'https://upload.e-hentai.org/image_lookup.php',
        method: 'POST',
        body: {
          kind: 'multipart',
          entries: [
            { name: 'f_sfile', base64: 'AQID', filename: 'test.png', type: 'image/png' },
            { name: 'fs_similar', value: '1' },
          ],
        },
      },
    })
    assert.equal(h.calls[0].data.get('f_sfile').size, 3)
    assert.equal(h.calls[0].data.get('fs_similar'), '1')
    assert.equal(h.calls[0].headers['Content-Type'], undefined)
    h.send({ action: 'abort', id: 'upload' })
    assert.equal(h.calls[0].aborted, true)
    assert.equal(h.messages.at(-1).error, 'ABORTED')
    assert.equal(h.messages.filter((message) => message.id === 'upload').length, 1)
    h.send({
      action: 'request',
      id: 'timeout',
      request: { url: 'https://e-hentai.org/', method: 'GET' },
    })
    h.calls[1].ontimeout()
    assert.equal(h.calls[1].aborted, true)
    assert.equal(h.messages.at(-1).error, 'TIMEOUT')
    h.close()
  })
}

// Load real TypeScript modules with only platform/services substituted, retaining Vue watches.
function clientHarness() {
  const events = new Map(),
    sent = [],
    fetched = [],
    storage = new Map(),
    modules = new Map()
  const add = (type, listener) => {
    if (!events.has(type)) events.set(type, new Set())
    events.get(type).add(listener)
  }
  const remove = (type, listener) => events.get(type)?.delete(listener)
  const emit = (data) => {
    for (const callback of events.get('message') || []) callback({ origin, data })
  }
  const env = {
    console,
    URL,
    URLSearchParams,
    FormData,
    Uint8Array,
    Blob,
    atob,
    btoa,
    AbortController,
    AbortSignal,
    DOMParser: class {
      parseFromString(text) {
        return {
          querySelectorAll: () => (text === 'account fixture' ? [1, 2, 3] : []),
          body: { textContent: 'Image Limits' },
        }
      }
    },
    setTimeout: (fn, time) => setTimeout(fn, time === 1200 ? 5 : time),
    clearTimeout,
    location: { origin },
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    document: { visibilityState: 'visible', addEventListener: add, removeEventListener: remove },
    window: {
      addEventListener: add,
      removeEventListener: remove,
      postMessage: (message) => {
        sent.push(message)
        if (message.action === 'hello')
          queueMicrotask(() =>
            identities.forEach((identity) =>
              emit({
                channel: 'eviewer-browser-assistant',
                direction: 'assistant',
                action: 'ready',
                instance: identity.instance,
                identity,
              }),
            ),
          )
      },
    },
    fetch: async (url) => {
      fetched.push(String(url))
      if (failure) throw new Error('offline')
      return Response.json(manifest)
    },
  }
  let failure = false,
    manifest = createAssistantManifest(origin)
  const identity = {
    instance: 'fixture',
    origin,
    flavor: 'tampermonkey',
    scriptVersion: ASSISTANT_VERSION,
    buildVersion: ASSISTANT_VERSION,
    protocolVersion: 1,
    available: true,
    manager: 'fixture',
    managerVersion: '1',
    capabilities: ['text', 'binary', 'multipart', 'abort'],
  }
  let identities = [identity]
  function load(name) {
    if (modules.has(name)) return modules.get(name)
    const exports = {}
    modules.set(name, exports)
    const source = readFileSync(
      new URL(`../src/core/${name.includes('/') ? name : 'connector/' + name}.ts`, import.meta.url),
      'utf8',
    )
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    vm.runInNewContext(js, {
      ...env,
      exports,
      require: (dependency) => {
        if (dependency === 'vue') return nativeRequire('vue')
        if (dependency === '@/i18n') return { formatSystemMessage: (value) => value }
        if (dependency.includes('eurlEnum')) return { eurlEnum: { EH: origin + '/ehentai' } }
        if (dependency === './userConfigCache') return { clearUserConfigCache() {} }
        return load(dependency.split('/').at(-1))
      },
    })
    return exports
  }
  return {
    client: load('connectorClient'),
    settings: load('connectionSettings'),
    protocol: load('connectorProtocol'),
    sent,
    fetched,
    storage,
    auth: () => load('auth/authState'),
    transport: () => load('connectorTransport'),
    respond: (text, finalUrl = 'https://e-hentai.org/home.php') => {
      const request = sent.findLast((message) => message.action === 'request')
      emit({
        channel: 'eviewer-browser-assistant',
        direction: 'assistant',
        action: 'response',
        instance: request.instance,
        id: request.id,
        ok: true,
        result: { status: 200, text, finalUrl },
      })
    },
    identity,
    manifest: (value) => {
      manifest = value
    },
    identities: (value) => {
      identities = value
    },
    offline: (value) => {
      failure = value
    },
  }
}

test('page client: installed version equality, older/newer mismatch, offline and preview distinction', async () => {
  const h = clientHarness()
  try {
    await h.client.detectConnector()
    await h.client.checkAssistantVersion(true)
    assert.equal(h.client.connectorState.versionStatus, 'current')
    for (const version of ['1.0.0', '9.0.0', '']) {
      h.identity.scriptVersion = version
      h.identity.buildVersion = version
      await h.client.detectConnector()
      await h.client.checkAssistantVersion(true)
      assert.equal(h.client.connectorState.versionStatus, version ? 'mismatch' : 'error')
    }
    h.offline(true)
    await h.client.checkAssistantVersion(true)
    assert.equal(h.client.connectorState.versionStatus, 'error')
    h.offline(false)
    h.identity.scriptVersion = ASSISTANT_VERSION
    h.identity.buildVersion = ASSISTANT_VERSION
    h.manifest(createAssistantManifest(origin, { EVIEWER_PROXY_ENVIRONMENT: 'preview' }))
    await h.client.checkAssistantVersion(true)
    assert.equal(h.client.connectorState.versionStatus, 'unavailable')
    h.manifest(createAssistantManifest(origin))
    h.identity.buildVersion = '1.0.0'
    await h.client.detectConnector()
    await h.client.checkAssistantVersion(true)
    assert.equal(h.client.connectorState.versionStatus, 'error')
  } finally {
    h.client.stopConnector()
  }
})

test('page client: duplicate/protocol rejection and mode switch abort without replay', async () => {
  const h = clientHarness()
  try {
    h.identities([h.identity, { ...h.identity, instance: 'duplicate' }])
    await h.client.detectConnector()
    assert.equal(h.client.connectorState.phase, 'duplicate')
    await assert.rejects(h.client.requestConnector({ url: 'https://e-hentai.org/', method: 'GET' }))
    h.identities([{ ...h.identity, protocolVersion: 999 }])
    await h.client.detectConnector()
    assert.equal(h.client.connectorState.phase, 'unsupported')
    h.identities([h.identity])
    await h.client.detectConnector()
    h.settings.connectionSettings.mode = 'local'
    const request = h.client.requestConnector({
      url: 'https://e-hentai.org/favorites.php',
      method: 'POST',
    })
    const rejected = assert.rejects(request, { name: 'AbortError' })
    h.settings.connectionSettings.mode = 'server'
    await rejected
    assert.equal(h.sent.filter((message) => message.action === 'request').length, 1)
    assert.equal(h.sent.at(-1).action, 'abort')
    assert.equal(
      h.protocol.galleryTarget('/gallerypopups.php?gid=1', 't=abc'),
      'https://e-hentai.org/gallerypopups.php?gid=1&t=abc',
    )
    assert.equal(
      h.protocol.galleryTarget('/image-lookup'),
      'https://upload.e-hentai.org/image_lookup.php',
    )
  } finally {
    h.client.stopConnector()
  }
})

test('deployment verification checks the actual manifest and both raw installers', async () => {
  const plan = { environment: 'production', commit: 'a'.repeat(40) }
  const env = { EVIEWER_PROXY_ENVIRONMENT: plan.environment, EVIEWER_PROXY_REVISION: plan.commit }
  const fetcher = async (url) => assistantAssetResponse(new Request(url), env, [])
  await verifyAssistant(origin, plan, fetcher)
  await assert.rejects(verifyAssistant(origin, { ...plan, commit: 'b'.repeat(40) }, fetcher))
})

test('local login: server identity stays separate; probe/pause never imports, exports or clears cookies', async () => {
  const h = clientHarness()
  try {
    await h.client.detectConnector()
    const auth = h.auth()
    Object.assign(auth.serverAuthState, {
      loggedIn: true,
      memberId: 'server-account',
      expiresAt: Date.now() + 60000,
    })
    h.settings.connectionSettings.mode = 'local'
    assert.equal(auth.authState.loggedIn, false)
    assert.equal(auth.authState.expiresAt, undefined)
    const probe = auth.refreshLocalAuthState(true)
    h.respond('account fixture')
    await probe
    assert.equal(auth.authState.loggedIn, true)
    assert.equal(auth.authState.memberId, '')
    assert.equal(auth.serverAuthState.memberId, 'server-account')
    assert.equal(h.storage.has('eviewer:auth-state'), false)
    await auth.clearAuthCookies()
    assert.equal(auth.authState.loggedIn, false)
    assert.equal(auth.localSession.paused, true)
    assert.equal(auth.serverAuthState.loggedIn, true)
    h.settings.connectionSettings.mode = 'server'
    assert.equal(auth.authState.memberId, 'server-account')
    h.settings.connectionSettings.mode = 'local'
    const cancelled = auth.refreshLocalAuthState(true)
    h.settings.connectionSettings.mode = 'server'
    await cancelled
    assert.equal(auth.authState.memberId, 'server-account')
    assert.ok(h.fetched.every((url) => url.endsWith('/assistant-manifest.json')))
  } finally {
    h.client.stopConnector()
  }
})

test('local transport: repeated form fields and image-search redirect do not replay POST', async () => {
  const h = clientHarness()
  try {
    await h.client.detectConnector()
    h.settings.connectionSettings.mode = 'local'
    const transport = h.transport()
    const favorite = transport.requestLocalGallery('/favorites.php', {
      method: 'POST',
      encoding: 'urlencoded',
      data: { 'modifygids[]': ['1', '2'], favnote: '中文+' },
    })
    const body = new URLSearchParams(h.sent.at(-1).request.body.text)
    assert.deepEqual(body.getAll('modifygids[]'), ['1', '2'])
    assert.equal(body.get('favnote'), '中文+')
    h.respond('ok', 'https://e-hentai.org/favorites.php')
    await favorite
    const form = new FormData()
    form.append(
      'f_sfile',
      new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }),
      'test.png',
    )
    const upload = transport.requestLocalGallery('/image-lookup', {
      method: 'POST',
      encoding: 'multipart',
      data: form,
    })
    await pause()
    assert.equal(h.sent.at(-1).request.body.entries[0].base64, 'AQID')
    h.respond('compact layout', 'https://e-hentai.org/?f_shash=fixture')
    await pause()
    assert.equal(h.sent.at(-1).request.method, 'GET')
    assert.equal(new URL(h.sent.at(-1).request.url).searchParams.get('inline_set'), 'dm_e')
    h.respond('extended layout', 'https://e-hentai.org/?f_shash=fixture')
    assert.equal((await upload).data, 'extended layout')
    assert.equal(
      h.sent.filter(
        (message) => message.request?.url === 'https://upload.e-hentai.org/image_lookup.php',
      ).length,
      1,
    )
  } finally {
    h.client.stopConnector()
  }
})
