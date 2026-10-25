import type { ConnectorRequest } from './connectorProtocol'
import { requestConnector } from './connectorClient'
import { HENTAIVERSE_SECTIONS } from '@/core/hentaiverse/hentaiVerseProtocol'
import type {
  HentaiVerseFormData,
  HentaiVerseFormSection,
  HentaiVersePageTarget,
} from '@/core/hentaiverse/model/hentaiVerse'

/** Translate the existing HV operations into source requests, without exporting cookies. */
export function hentaiVerseRequest(
  path: string,
  options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown },
): ConnectorRequest {
  const world = options.query?.world || (options.body as { world?: string } | undefined)?.world
  const url = new URL(
    world === 'isekai' ? 'https://hentaiverse.org/isekai/' : 'https://hentaiverse.org/',
  )
  const request: ConnectorRequest = { url: '', method: options.method || 'GET' }
  let query = options.query || {}
  if (path === '/hentaiverse/equipment-data') {
    const source = String(query.path || '')
    if (
      !/^\/(?:isekai\/)?dynjs\/\d{1,20}\/[a-zA-Z0-9_-]{1,64}\/equip-([1-9]\d{0,19})\.js$/.test(
        source,
      )
    )
      throw new Error('不允许访问该装备数据资源')
    url.pathname = source
    query = {}
  } else if (path === '/hentaiverse/form') {
    const body = options.body as {
      section: HentaiVerseFormSection
      data: HentaiVerseFormData
      target: HentaiVersePageTarget
    }
    const route = HENTAIVERSE_SECTIONS.find(
      (item) => item.key === (body.section === 'persona' ? 'character' : body.section),
    )
    if (!route) throw new Error('HentaiVerse 表单格式不正确')
    query = { ...body.target, ...route.target }
    const form = new URLSearchParams()
    for (const [name, value] of Object.entries(body.data))
      for (const item of Array.isArray(value) ? value : [value]) form.append(name, String(item))
    request.body = { kind: 'text', text: form.toString() }
    request.contentType = 'application/x-www-form-urlencoded'
  } else if (path === '/hentaiverse/action') {
    url.pathname += 'json'
    request.body = {
      kind: 'text',
      text: JSON.stringify({
        ...Object.fromEntries(
          Object.entries(options.body as object).filter(([key]) => key !== 'world'),
        ),
        type: 'battle',
        method: 'action',
      }),
    }
    request.contentType = 'application/json'
  } else if (path !== '/hentaiverse/page') {
    throw new Error('不允许访问该 HentaiVerse 页面')
  }
  for (const [name, value] of Object.entries(query))
    if (name !== 'world' && value !== undefined && value !== '')
      url.searchParams.set(name, String(value))
  request.url = url.href
  return request
}

export async function requestLocalHentaiVerse(
  path: string,
  options: Parameters<typeof hentaiVerseRequest>[1],
  signal?: AbortSignal,
) {
  return requestConnector(hentaiVerseRequest(path, options), { signal })
}
