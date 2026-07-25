import { openCacheDatabase } from '../cache/indexedDb'
import {
  activeTranslationMetaKey,
  tagTranslationDatasetVersion,
  type ActiveTranslationMeta,
  type TagResolution,
  type TagTranslationCacheStatus,
  type TagTranslationLookup,
  type TagTranslationWorkerRequest,
  type TagTranslationWorkerResponse,
  type SearchableTag,
  type TagMasterPage,
  type TagNamespaceSummary,
} from './tagTranslationProtocol'
import { indexedDbCacheSettings } from '../cache/cacheSettings'

interface PendingWorkerRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  onProgress?: (completed: number, total: number) => void
}

let translationWorker: Worker | undefined
let nextRequestId = 1
const pendingRequests = new Map<number, PendingWorkerRequest>()
const cacheRebuiltListeners = new Set<() => void>()

export async function lookupTagTranslations(queries: TagTranslationLookup[]) {
  return requestWorker<Array<{ key: string; resolution: TagResolution | null }>>({
    type: 'lookup',
    queries,
  })
}

export function listTagNamespaces() {
  return requestWorker<TagNamespaceSummary[]>({
    type: 'list-namespaces',
    useCache: shouldUseTranslationCache(),
  })
}

export function listMasterTags(namespace: string, offset: number, limit: number) {
  return requestWorker<TagMasterPage>({
    type: 'list-master-tags',
    namespace,
    offset,
    limit,
    useCache: shouldUseTranslationCache(),
  })
}

export function searchMasterTags(keyword: string, namespace?: string, limit = 40) {
  return requestWorker<SearchableTag[]>({
    type: 'search-master-tags',
    keyword,
    namespace,
    limit,
    useCache: shouldUseTranslationCache(),
  })
}

export function resolveMasterTag(namespace: string, value: string) {
  return requestWorker<SearchableTag | null>({
    type: 'resolve-tag',
    namespace,
    value,
    useCache: shouldUseTranslationCache(),
  })
}

export async function getTagTranslationCacheStatus(): Promise<TagTranslationCacheStatus> {
  try {
    const database = await openCacheDatabase()
    const record = await database.get('meta', activeTranslationMetaKey)
    const meta = record?.value as ActiveTranslationMeta | undefined
    return {
      available:
        meta?.status === 'complete' && meta.datasetVersion === tagTranslationDatasetVersion,
      count: meta?.count ?? 0,
      updatedAt: meta?.updatedAt,
      datasetVersion: meta?.datasetVersion,
    }
  } catch {
    return { available: false, count: 0 }
  }
}

export async function rebuildTagTranslationCache(
  onProgress?: (completed: number, total: number) => void,
): Promise<number> {
  const count = await requestWorker<number>({ type: 'rebuild' }, onProgress)
  cacheRebuiltListeners.forEach((listener) => listener())
  return count
}

export function onTagTranslationCacheRebuilt(listener: () => void) {
  cacheRebuiltListeners.add(listener)
}

export function resetTagTranslationRuntime() {
  const error = new Error('标签翻译后台任务已重置')
  pendingRequests.forEach((request) => request.reject(error))
  pendingRequests.clear()
  translationWorker?.terminate()
  translationWorker = undefined
  globalThis.setTimeout(() => {
    cacheRebuiltListeners.forEach((listener) => listener())
  }, 0)
}

function requestWorker<T>(
  payload: TagTranslationWorkerPayload,
  onProgress?: (completed: number, total: number) => void,
): Promise<T> {
  const id = nextRequestId++
  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      onProgress,
    })
    getTranslationWorker().postMessage({ id, ...payload } as TagTranslationWorkerRequest)
  })
}

type TagTranslationWorkerPayload = TagTranslationWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never

function shouldUseTranslationCache() {
  return indexedDbCacheSettings.enabled && indexedDbCacheSettings.cacheTagTranslations
}

function getTranslationWorker() {
  if (translationWorker) {
    return translationWorker
  }

  translationWorker = new Worker(new URL('../workers/tagTranslation.worker.ts', import.meta.url), {
    type: 'module',
  })
  translationWorker.addEventListener('message', handleWorkerMessage)
  translationWorker.addEventListener('error', (event) => {
    const error = new Error(event.message || '标签翻译后台任务运行失败')
    pendingRequests.forEach((request) => request.reject(error))
    pendingRequests.clear()
    translationWorker?.terminate()
    translationWorker = undefined
  })
  return translationWorker
}

function handleWorkerMessage(event: MessageEvent<TagTranslationWorkerResponse>) {
  const response = event.data
  const pending = pendingRequests.get(response.id)
  if (!pending) {
    return
  }

  if (response.type === 'rebuild-progress') {
    pending.onProgress?.(response.completed, response.total)
    return
  }

  pendingRequests.delete(response.id)
  if (response.type === 'error') {
    pending.reject(new Error(response.message))
  } else if (response.type === 'lookup-complete') {
    pending.resolve(response.results)
  } else if (response.type === 'rebuild-complete') {
    pending.resolve(response.count)
  } else if (response.type === 'namespaces-complete') {
    pending.resolve(response.namespaces)
  } else if (response.type === 'master-tags-complete') {
    pending.resolve(response.page)
  } else if (response.type === 'search-complete') {
    pending.resolve(response.results)
  } else {
    pending.resolve(response.result)
  }
}
