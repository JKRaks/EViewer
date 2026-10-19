// Keep the userscript as standalone source; bundler helpers must never leak into it.
export default String.raw`// ==UserScript==
// @name EViewer 原站登录
// @namespace __EVIEWER_BRIDGE_ORIGIN__/auth/bridge
// @version 1.0.0
// @description 经用户确认后，仅加密同步 ipb_member_id 和 ipb_pass_hash。
// @match https://e-hentai.org/home.php*
// @grant none
// @noframes
// @run-at document-end
// @updateURL __EVIEWER_BRIDGE_ORIGIN__/auth/bridge/script.user.js
// @downloadURL __EVIEWER_BRIDGE_ORIGIN__/auth/bridge/script.user.js
// ==/UserScript==
;(function () {
  'use strict'
  const configuration = __EVIEWER_BRIDGE_CONFIG__
  const encoded = new URLSearchParams(location.hash.slice(1)).get('eviewer-login')
  if (!encoded || document.getElementById('eviewer-login-bridge')) return
  let ticket
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    ticket = JSON.parse(new TextDecoder().decode(bytes))
    if (ticket.origin !== configuration.origin) return
    if (ticket.version !== 1 || !/^[a-f0-9]{64}$/.test(ticket.id) ||
      !/^[\w-]{43}$/.test(ticket.upload) || !Number.isFinite(ticket.expiresAt)) return
  } catch { return }
  const zh = ticket.language === 'zh'
  const text = (cn, en) => zh ? cn : en
  // The fragment is only a short-lived upload ticket, never an account cookie.
  history.replaceState(null, '', location.pathname + location.search)
  const panel = document.createElement('section')
  panel.id = 'eviewer-login-bridge'
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', 'EViewer')
  Object.assign(panel.style, { position: 'fixed', inset: '12px 12px auto auto', zIndex: '2147483647',
    boxSizing: 'border-box', padding: '20px', width: '360px', maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100dvh - 24px)', overflow: 'auto', background: '#fff', color: '#172033',
    border: '2px solid #245cc2', borderRadius: '10px', boxShadow: '0 6px 25px #0004',
    font: '16px/1.5 system-ui', textAlign: 'left' })
  const title = document.createElement('h2')
  title.textContent = text('同步到 EViewer', 'Sync to EViewer') + ' · 1.0.0'
  Object.assign(title.style, { fontSize: '20px', margin: '0 0 12px' })
  const destination = document.createElement('p')
  destination.textContent = text('接收地址：', 'Destination: ') + configuration.origin
  destination.style.overflowWrap = 'anywhere'
  const state = document.createElement('p')
  state.setAttribute('role', 'status')
  const note = document.createElement('p')
  note.textContent = text('仅同步 ipb_member_id 和 ipb_pass_hash。提交后返回原来的 EViewer 页面。',
    'Only ipb_member_id and ipb_pass_hash are synced. Return to your original EViewer page after submitting.')
  const submit = document.createElement('button')
  submit.textContent = text('授权同步登录凭据', 'Authorize credential sync')
  const close = document.createElement('button')
  close.textContent = text('取消', 'Cancel')
  for (const button of [submit, close]) Object.assign(button.style, { minHeight: '44px',
    padding: '8px 14px', margin: '4px 8px 4px 0', font: 'inherit', cursor: 'pointer' })
  close.onclick = () => panel.remove()
  panel.append(title, destination, state, note, submit, close)
  document.body.append(panel)

  function readAccount() {
    const account = {}
    for (const part of document.cookie.split(';')) {
      const index = part.indexOf('=')
      const name = part.slice(0, index).trim()
      if (!['ipb_member_id', 'ipb_pass_hash'].includes(name)) continue
      try { account[name] = decodeURIComponent(part.slice(index + 1)) } catch { /* Missing cookie below. */ }
    }
    return account
  }

  function refresh() {
    const account = readAccount()
    const ready = Boolean(account.ipb_member_id && account.ipb_pass_hash)
    submit.disabled = !ready || ticket.expiresAt <= Date.now()
    state.textContent = ticket.expiresAt <= Date.now()
      ? text('授权已过期，请回 EViewer 重新开始。', 'Request expired. Start again in EViewer.')
      : ready ? text('两项登录凭据均可读取。', 'Both login credentials are available.')
        : text('请先登录原站，然后回 EViewer 重新开始授权。', 'Log in to the original site, then start again in EViewer.')
  }
  refresh()
  submit.onclick = async () => {
    refresh()
    if (submit.disabled) return
    submit.disabled = true
    const account = readAccount()
    try {
      const pack = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
        new TextEncoder().encode(JSON.stringify({ id: ticket.id,
          memberId: account.ipb_member_id, passHash: account.ipb_pass_hash })))
      const rsa = await crypto.subtle.importKey('jwk', ticket.publicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
      const wrappedKey = await crypto.subtle.encrypt('RSA-OAEP', rsa, await crypto.subtle.exportKey('raw', key))
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = configuration.origin + '/auth/bridge/receive'
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'payload'
      input.value = JSON.stringify({ id: ticket.id, upload: ticket.upload, language: ticket.language,
        envelope: { iv: pack(iv), encrypted: pack(encrypted), wrappedKey: pack(wrappedKey) } })
      form.append(input)
      document.body.append(form)
      form.submit()
    } catch {
      state.textContent = text('加密提交失败，请检查脚本版本并重试。', 'Encryption failed. Check your script version and retry.')
      submit.disabled = false
    } finally {
      account.ipb_member_id = account.ipb_pass_hash = ''
    }
  }
})()
`
