import { reactive } from 'vue'
import { formatSystemMessage } from '@/i18n'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { currentTransportSignal } from './connectionSettings'
import {
  assistantPath,
  CONNECTOR_CHANNEL,
  CONNECTOR_PROTOCOL,
  MANIFEST_PATH,
  readAssistantManifest,
  type AssistantFlavor,
  type AssistantManifest,
  type ConnectorIdentity,
  type ConnectorRequest,
  type ConnectorResult,
} from './connectorProtocol'

export const connectorState = reactive({
  phase: 'detecting' as 'detecting' | 'missing' | 'ready' | 'unsupported' | 'duplicate',
  identity: null as ConnectorIdentity | null,
  versionStatus: 'unknown' as
    | 'unknown'
    | 'checking'
    | 'current'
    | 'mismatch'
    | 'unavailable'
    | 'error',
  manifest: null as AssistantManifest | null,
  environment: 'unknown' as AssistantManifest['environment'] | 'unknown',
  expectedVersion: '',
  checkedAt: 0,
})
const identities = new Map<string, ConnectorIdentity>()
const pending = new Map<
  string,
  {
    finish: (error?: Error, result?: ConnectorResult) => void
    progress?: (loaded: number, total?: number) => void
    instance: string
  }
>()
let running = false
let discoveryTimer: ReturnType<typeof setTimeout> | undefined
let discoveryPromise: Promise<void> | undefined
let finishDiscovery: (() => void) | undefined
let versionPromise: Promise<void> | undefined
let sequence = 0

export function assistantUrl(flavor: AssistantFlavor, download = false) {
  const origin = new URL(eurlEnum.EH, location.origin).origin
  return new URL(assistantPath(flavor) + (download ? '?download=1' : ''), origin).href
}
function post(message: Record<string, unknown>) {
  window.postMessage({ channel: CONNECTOR_CHANNEL, direction: 'page', ...message }, location.origin)
}
function applyIdentity() {
  connectorState.identity = identities.values().next().value ?? null
  const identity = connectorState.identity
  connectorState.phase =
    identities.size > 1
      ? 'duplicate'
      : !identity
        ? 'missing'
        : identity.available && identity.protocolVersion === CONNECTOR_PROTOCOL
          ? 'ready'
          : 'unsupported'
}
function receive(event: MessageEvent) {
  const message = event.data
  if (
    event.origin !== location.origin ||
    message?.channel !== CONNECTOR_CHANNEL ||
    message.direction !== 'assistant'
  )
    return
  if (message.action === 'ready') {
    const identity = message.identity as ConnectorIdentity
    if (
      !identity ||
      identity.origin !== location.origin ||
      identity.instance !== message.instance ||
      typeof identity.instance !== 'string' ||
      !['tampermonkey', 'userscripts'].includes(identity.flavor) ||
      typeof identity.available !== 'boolean' ||
      !Number.isInteger(identity.protocolVersion) ||
      typeof identity.scriptVersion !== 'string' ||
      !Array.isArray(identity.capabilities)
    )
      return
    if (connectorState.identity?.instance !== identity.instance) connectorState.checkedAt = 0
    identities.set(identity.instance, identity)
    applyIdentity()
    if (!discoveryPromise) void checkAssistantVersion()
    return
  }
  const request = pending.get(message.id)
  if (!request || request.instance !== message.instance) return
  if (message.action === 'progress') request.progress?.(message.loaded, message.total)
  else if (message.action === 'response') {
    if (message.ok && message.result && Number.isInteger(message.result.status))
      request.finish(undefined, message.result)
    else request.finish(connectorError(message.error))
  }
}

function connectorError(code: string) {
  const messages: Record<string, string> = {
    ABORTED: '请求已取消',
    TIMEOUT: '请求超时，请稍后重试',
    NETWORK_ERROR: '网络连接失败，请检查网络后重试',
    TARGET_NOT_ALLOWED: '本机代理不支持此请求地址',
    BODY_TOO_LARGE: '上传图片体积超过限制',
    RESPONSE_TOO_LARGE: '源站响应体积超过限制',
    API_UNAVAILABLE: '脚本请求能力不可用，请检查扩展权限',
    REQUEST_LIMIT: '本机请求过多，请稍后重试',
    INVALID_BODY: '本机请求格式不正确',
  }
  const error = new Error(
    formatSystemMessage(messages[code] || '本机请求失败，请重新检测浏览器助手'),
  )
  error.name = code === 'ABORTED' ? 'AbortError' : 'ConnectorError'
  return error
}

export function detectConnector(): Promise<void> {
  if (discoveryPromise) return discoveryPromise
  if (!running) {
    startConnector()
    return discoveryPromise!
  }
  identities.clear()
  connectorState.phase = 'detecting'
  discoveryPromise = new Promise((resolve) => {
    finishDiscovery = resolve
  })
  post({ action: 'hello' })
  discoveryTimer = setTimeout(() => {
    applyIdentity()
    finishDiscovery?.()
    finishDiscovery = undefined
    discoveryPromise = undefined
    if (connectorState.identity) void checkAssistantVersion()
  }, 1200)
  return discoveryPromise
}

export async function checkAssistantVersion(force = false) {
  if (versionPromise) return versionPromise
  if (!connectorState.identity) return
  if (!force && Date.now() - connectorState.checkedAt < 5 * 60_000) return
  const identity = { ...connectorState.identity }
  connectorState.versionStatus = 'checking'
  versionPromise = (async () => {
    try {
      const read = async (origin: string) => {
        const response = await fetch(new URL(MANIFEST_PATH, origin), {
          cache: 'no-store',
          credentials: 'omit',
          signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error('MANIFEST_UNAVAILABLE')
        return readAssistantManifest(await response.json())
      }
      const localManifest = await read(new URL(eurlEnum.EH, location.origin).origin)
      const manifest =
        localManifest.environment === 'production'
          ? localManifest
          : localManifest.productionOrigin
            ? await read(localManifest.productionOrigin)
            : localManifest
      if (connectorState.identity?.instance !== identity.instance) return
      connectorState.manifest = manifest
      connectorState.environment = localManifest.environment
      connectorState.expectedVersion = manifest.scripts[identity.flavor].version
      connectorState.versionStatus =
        !identity.scriptVersion || identity.scriptVersion !== identity.buildVersion
          ? 'error'
          : manifest.environment !== 'production'
            ? 'unavailable'
            : identity.scriptVersion === connectorState.expectedVersion
              ? 'current'
              : 'mismatch'
    } catch {
      if (connectorState.identity?.instance === identity.instance)
        connectorState.versionStatus = 'error'
    } finally {
      if (running && connectorState.identity?.instance === identity.instance)
        connectorState.checkedAt = Date.now()
    }
  })().finally(() => {
    versionPromise = undefined
    if (
      running &&
      connectorState.identity &&
      connectorState.identity.instance !== identity.instance
    )
      void checkAssistantVersion(true)
  })
  return versionPromise
}

export function startConnector() {
  if (running) return
  running = true
  window.addEventListener('message', receive)
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  void detectConnector()
}
function resume() {
  if (
    document.visibilityState === 'visible' &&
    Date.now() - connectorState.checkedAt > 5 * 60_000
  ) {
    void detectConnector()
  }
}
export function stopConnector() {
  window.removeEventListener('message', receive)
  document.removeEventListener('visibilitychange', resume)
  window.removeEventListener('pageshow', resume)
  clearTimeout(discoveryTimer)
  finishDiscovery?.()
  discoveryPromise = undefined
  identities.clear()
  connectorState.identity = null
  connectorState.phase = 'missing'
  for (const [id, request] of pending) {
    post({ action: 'abort', id, instance: request.instance })
    request.finish(connectorError('ABORTED'))
  }
  running = false
}

export async function requestConnector(
  input: ConnectorRequest,
  options: {
    signal?: AbortSignal
    onUploadProgress?: (loaded: number, total?: number) => void
  } = {},
): Promise<ConnectorResult> {
  const transportSignal = currentTransportSignal()
  if (!running) startConnector()
  if (discoveryPromise) await discoveryPromise
  if (transportSignal.aborted || options.signal?.aborted) throw connectorError('ABORTED')
  const identity = connectorState.identity
  if (!identity || connectorState.phase !== 'ready') {
    throw new Error(formatSystemMessage('浏览器助手未就绪，请前往设置安装或重新检测'))
  }
  const capability = input.binary
    ? 'binary'
    : input.body?.kind === 'multipart'
      ? 'multipart'
      : 'text'
  if (!identity.capabilities.includes(capability)) throw connectorError('API_UNAVAILABLE')
  if (new URL(input.url).hostname === 'exhentai.org' && !identity.capabilities.includes('exhentai'))
    throw new Error(formatSystemMessage('请前往设置更新浏览器助手，以支持 ExHentai 本机请求'))
  if (
    new URL(input.url).hostname === 'hentaiverse.org' &&
    !identity.capabilities.includes('hentaiverse')
  )
    throw new Error(formatSystemMessage('请前往设置更新浏览器助手，以支持 HentaiVerse 本机请求'))
  const id = `request-${Date.now()}-${++sequence}`
  return new Promise((resolve, reject) => {
    const signal = options.signal
      ? AbortSignal.any([options.signal, transportSignal])
      : transportSignal
    const abort = () => {
      post({ action: 'abort', instance: identity.instance, id })
      finish(connectorError('ABORTED'))
    }
    const timer = setTimeout(
      () => {
        post({ action: 'abort', instance: identity.instance, id })
        finish(connectorError('TIMEOUT'))
      },
      (input.timeout || 30000) + 1500,
    )
    const finish = (error?: Error, result?: ConnectorResult) => {
      if (!pending.delete(id)) return
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve(result!)
    }
    pending.set(id, { finish, progress: options.onUploadProgress, instance: identity.instance })
    signal.addEventListener('abort', abort, { once: true })
    post({ action: 'request', instance: identity.instance, id, request: input })
  })
}
