// Standalone source: do not serialize a bundled function with captured helpers.
export default String.raw`
;(() => {
  'use strict'
  const config = __ASSISTANT_CONFIG__
  if (window.top !== window || !config.origins.includes(location.origin)) return
  const channel = 'eviewer-browser-assistant'
  const instance = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('-')
  const gm = typeof GM === 'object' ? GM : undefined
  const info = typeof GM_info === 'object' ? GM_info : gm?.info
  const invoke = config.flavor === 'tampermonkey'
    ? (typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null)
    : (typeof gm?.xmlHttpRequest === 'function' ? gm.xmlHttpRequest.bind(gm) : null)
  const identity = {
    instance, flavor: config.flavor, scriptVersion: info?.script?.version || '',
    buildVersion: config.version,
    protocolVersion: config.protocolVersion, origin: location.origin,
    manager: info?.scriptHandler || '', managerVersion: info?.version || '',
    available: Boolean(invoke), capabilities: ['text', 'binary', 'multipart', 'abort'],
  }
  const active = new Map()
  const send = (data) => window.postMessage({ channel, direction: 'assistant', instance, ...data }, location.origin)
  const ready = () => send({ action: 'ready', identity })
  const mark = () => document.documentElement.setAttribute('data-eviewer-assistant', config.version)
  if (document.documentElement) mark()
  else document.addEventListener('DOMContentLoaded', mark, { once: true })

  function allowedTarget(value, method, binary = false) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) throw new Error('TARGET_NOT_ALLOWED')
    if (binary) {
      if (method !== 'GET' || !(url.hostname === 'ehgt.org' || url.hostname.endsWith('.ehgt.org'))) throw new Error('TARGET_NOT_ALLOWED')
      return url.href
    }
    if (url.hostname === 'upload.e-hentai.org' && url.pathname === '/image_lookup.php' && method === 'POST') return url.href
    if (url.hostname !== 'e-hentai.org') throw new Error('TARGET_NOT_ALLOWED')
    const read = /^(\/|\/popular\/?|\/(home|uconfig|favorites|gallerypopups|gallerytorrents|toplist|bitcoin|hathperks)\.php|\/g\/\d+\/[a-z0-9]+\/?|\/s\/[a-z0-9]+\/\d+-\d+)$/.test(url.pathname)
    const write = /^\/(favorites|gallerypopups|uconfig)\.php$/.test(url.pathname)
    if (!(method === 'GET' && read) && !(method === 'POST' && write)) throw new Error('TARGET_NOT_ALLOWED')
    return url.href
  }

  function requestBody(input) {
    if (!input.body) return undefined
    if (input.body.kind === 'text') {
      if (typeof input.body.text !== 'string' || input.body.text.length > 1024 * 1024) throw new Error('BODY_TOO_LARGE')
      return input.body.text
    }
    if (input.body.kind !== 'multipart' || !Array.isArray(input.body.entries)) throw new Error('INVALID_BODY')
    const form = new FormData()
    let size = 0
    for (const entry of input.body.entries) {
      if (typeof entry.name !== 'string') throw new Error('INVALID_BODY')
      if (typeof entry.value === 'string') {
        size += entry.value.length
        form.append(entry.name, entry.value)
      } else {
        if (typeof entry.base64 !== 'string' || entry.base64.length > 22 * 1024 * 1024) throw new Error('BODY_TOO_LARGE')
        const bytes = Uint8Array.from(atob(entry.base64), c => c.charCodeAt(0))
        size += bytes.byteLength
        form.append(entry.name, new Blob([bytes], { type: entry.type || 'application/octet-stream' }), entry.filename || 'image')
      }
      if (size > 16 * 1024 * 1024) throw new Error('BODY_TOO_LARGE')
    }
    return form
  }

  function startRequest(id, input) {
    let url, body
    try {
      if (!invoke) throw new Error('API_UNAVAILABLE')
      if (active.has(id) || active.size >= 32) throw new Error('REQUEST_LIMIT')
      url = allowedTarget(input.url, input.method, input.binary)
      body = requestBody(input)
    } catch (error) { send({ action: 'response', id, ok: false, error: error.message }); return }
    let handle, timer, ended = false
    const finish = (value) => {
      if (ended) return
      ended = true
      clearTimeout(timer)
      active.delete(id)
      send({ action: 'response', id, ...value })
    }
    const cancel = (reason = 'ABORTED') => {
      finish({ ok: false, error: reason })
      try { handle?.abort?.() } catch { /* Already settled. */ }
    }
    active.set(id, cancel)
    const timeout = Math.min(Math.max(Number(input.timeout) || 30000, 100), 60000)
    timer = setTimeout(() => cancel('TIMEOUT'), timeout + 100)
    const onload = (response) => {
      if (ended) return
      try {
        const finalUrl = response.finalUrl || response.responseURL || url
        // Validate returned data; managers may already have followed network redirects.
        allowedTarget(finalUrl, finalUrl === url ? input.method : 'GET', input.binary)
        const result = { status: response.status, finalUrl, text: '', mimeType: '', base64: '' }
        if (input.binary) {
          const bytes = new Uint8Array(response.response)
          if (bytes.byteLength > 15 * 1024 * 1024) throw new Error('RESPONSE_TOO_LARGE')
          let text = ''
          for (let index = 0; index < bytes.length; index += 8192) text += String.fromCharCode(...bytes.subarray(index, index + 8192))
          result.base64 = btoa(text)
          result.mimeType = /(?:^|\r?\n)content-type:\s*([^;\r\n]+)/i.exec(response.responseHeaders || '')?.[1] || 'application/octet-stream'
        } else {
          result.text = response.responseText ?? response.response ?? ''
          if (typeof result.text !== 'string' || result.text.length > 20 * 1024 * 1024) throw new Error('RESPONSE_TOO_LARGE')
        }
        finish({ ok: true, result })
      } catch (error) { finish({ ok: false, error: error.message }) }
    }
    try {
      const headers = { Accept: input.binary ? 'image/*' : 'text/html,application/xhtml+xml,*/*' }
      if (input.body?.kind === 'text') headers['Content-Type'] = input.contentType === 'application/json'
        ? 'application/json' : 'application/x-www-form-urlencoded; charset=UTF-8'
      handle = invoke({ url, method: input.method, headers, data: body, timeout,
        responseType: input.binary ? 'arraybuffer' : 'text',
        onload, onerror: () => finish({ ok: false, error: 'NETWORK_ERROR' }),
        ontimeout: () => cancel('TIMEOUT'), onabort: () => finish({ ok: false, error: 'ABORTED' }),
        upload: { onprogress: event => { if (!ended) send({ action: 'progress', id,
          loaded: event.loaded, total: event.lengthComputable ? event.total : undefined }) } },
      })
      if (handle?.then) handle.then(onload, () => finish({ ok: false, error: 'NETWORK_ERROR' }))
    } catch { finish({ ok: false, error: 'NETWORK_ERROR' }) }
  }

  window.addEventListener('message', event => {
    const message = event.data
    if (event.origin !== location.origin || message?.channel !== channel || message.direction !== 'page') return
    if (message.action === 'hello') { ready(); return }
    if (message.instance !== instance || typeof message.id !== 'string' || message.id.length > 100) return
    if (message.action === 'abort') active.get(message.id)?.()
    else if (message.action === 'request' && message.request) startRequest(message.id, message.request)
  })
  window.addEventListener('pagehide', () => { for (const cancel of active.values()) cancel() })
  ready()
})()
`
