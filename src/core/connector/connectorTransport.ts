import type { requestEncoding } from '@/core/model/R'
import { formatSystemMessage } from '@/i18n'
import { requestConnector } from './connectorClient'
import { galleryTarget, type ConnectorRequest, type MultipartEntry } from './connectorProtocol'

function base64(bytes: Uint8Array) {
  let text = ''
  for (let index = 0; index < bytes.length; index += 8192)
    text += String.fromCharCode(...bytes.subarray(index, index + 8192))
  return btoa(text)
}

export async function requestLocalGallery(
  path: string,
  options: {
    method: 'GET' | 'POST'
    query?: string
    data?: Record<string, unknown> | FormData
    encoding: requestEncoding
    signal?: AbortSignal
    timeout?: number
    onUploadProgress?: (loaded: number, total?: number) => void
  },
) {
  const input: ConnectorRequest = {
    url: galleryTarget(path, options.query),
    method: options.method,
    timeout: options.timeout,
  }
  const data = options.data
  if (data instanceof FormData) {
    const entries: MultipartEntry[] = []
    let size = 0
    for (const [name, value] of data.entries()) {
      if (typeof value === 'string') {
        size += value.length
        entries.push({ name, value })
      } else {
        size += value.size
        if (size > 16 * 1024 * 1024) throw new Error(formatSystemMessage('上传图片体积超过限制'))
        entries.push({
          name,
          filename: value.name,
          type: value.type,
          base64: base64(new Uint8Array(await value.arrayBuffer())),
        })
      }
    }
    input.body = { kind: 'multipart', entries }
  } else if (data) {
    const form = new URLSearchParams()
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue
      for (const entry of Array.isArray(value) ? value : [value]) form.append(name, String(entry))
    }
    input.body = {
      kind: 'text',
      text: options.encoding === 'json' ? JSON.stringify(data) : form.toString(),
    }
    input.contentType =
      options.encoding === 'json' ? 'application/json' : 'application/x-www-form-urlencoded'
  }
  let response = await requestConnector(input, options)
  // Upload redirects omit the layout selector needed by the existing gallery parser.
  // Read the resulting search once with that selector; never repeat the upload.
  if (path === '/image-lookup' && response.status === 200) {
    const resultUrl = new URL(response.finalUrl)
    if (resultUrl.origin === 'https://e-hentai.org' && resultUrl.pathname === '/') {
      resultUrl.searchParams.set('inline_set', 'dm_e')
      response = await requestConnector(
        { url: resultUrl.href, method: 'GET', timeout: options.timeout },
        options,
      )
    }
  }
  if (response.status < 200 || response.status >= 400)
    throw new Error(formatSystemMessage('请求失败: {p0} {p1}', { p0: response.status, p1: '' }))
  return { status: response.status, data: response.text, finalUrl: response.finalUrl }
}

export async function requestLocalCover(url: string, signal?: AbortSignal) {
  const response = await requestConnector({ url, method: 'GET', binary: true }, { signal })
  if (response.status !== 200 || !response.mimeType.startsWith('image/'))
    throw new Error('IMAGE_RESPONSE_INVALID')
  return new Blob([Uint8Array.from(atob(response.base64), (value) => value.charCodeAt(0))], {
    type: response.mimeType,
  })
}
