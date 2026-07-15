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
} from './tagTranslationProtocol'

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
  return requestWorker<Array<{ key: string; resolution: TagResolution | null }>>(
    { type: 'lookup', queries },
  )
}

export async function getTagTranslationCacheStatus(): Promise<TagTranslationCacheStatus> {
  try {
    const database = await openCacheDatabase()
    const record = await database.get('meta', activeTranslationMetaKey)
    const meta = record?.value as ActiveTranslationMeta | undefined
    return {
      available: meta?.status === 'complete' && meta.datasetVersion === tagTranslationDatasetVersion,
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
  payload:
    | Omit<Extract<TagTranslationWorkerRequest, { type: 'lookup' }>, 'id'>
    | Omit<Extract<TagTranslationWorkerRequest, { type: 'rebuild' }>, 'id'>,
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

function getTranslationWorker() {
  if (translationWorker) {
    return translationWorker
  }

  translationWorker = new Worker(
    new URL('../workers/tagTranslation.worker.ts', import.meta.url),
    { type: 'module' },
  )
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
  } else {
    pending.resolve(response.count)
  }
}
