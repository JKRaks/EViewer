import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const databaseName = 'eviewer-cache'
const databaseVersion = 1
const databaseOpenTimeout = 5000

export interface CacheMetaRecord {
  key: string
  value: unknown
}

export interface TagTranslationCacheRecord {
  key: string
  generation: string
  namespace: string
  alias: string
  master: string
  displayName: string
  source: 'official' | 'unofficial'
}

export interface GalleryDetailRecord {
  bookId: string
  payload: unknown
  updatedAt: number
}

export interface GalleryImagePageRecord {
  bookId: string
  pageIndex: number
  imageIds: string[]
  nextImageIndex: number
  lastPageIndex: number
  updatedAt: number
}

export interface GalleryImageUrlRecord {
  bookId: string
  imageId: string
  url: string
  resolvedAt: number
}

interface EViewerCacheDatabase extends DBSchema {
  meta: {
    key: string
    value: CacheMetaRecord
  }
  tagTranslations: {
    key: string
    value: TagTranslationCacheRecord
    indexes: { 'by-generation': string }
  }
  galleryDetails: {
    key: string
    value: GalleryDetailRecord
    indexes: { 'by-updated-at': number }
  }
  galleryImagePages: {
    key: [string, number]
    value: GalleryImagePageRecord
    indexes: { 'by-book': string }
  }
  galleryImageUrls: {
    key: [string, string]
    value: GalleryImageUrlRecord
    indexes: { 'by-book': string; 'by-resolved-at': number }
  }
}

export interface IndexedDbEnvironmentStatus {
  supported: boolean
  usable: boolean
  message: string
  usage?: number
  quota?: number
}

let databasePromise: Promise<IDBPDatabase<EViewerCacheDatabase>> | undefined

export function openCacheDatabase(): Promise<IDBPDatabase<EViewerCacheDatabase>> {
  if (!databasePromise) {
    const opening = openDB<EViewerCacheDatabase>(databaseName, databaseVersion, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' })
        }
        if (!database.objectStoreNames.contains('tagTranslations')) {
          const store = database.createObjectStore('tagTranslations', { keyPath: 'key' })
          store.createIndex('by-generation', 'generation')
        }
        if (!database.objectStoreNames.contains('galleryDetails')) {
          const store = database.createObjectStore('galleryDetails', { keyPath: 'bookId' })
          store.createIndex('by-updated-at', 'updatedAt')
        }
        if (!database.objectStoreNames.contains('galleryImagePages')) {
          const store = database.createObjectStore('galleryImagePages', {
            keyPath: ['bookId', 'pageIndex'],
          })
          store.createIndex('by-book', 'bookId')
        }
        if (!database.objectStoreNames.contains('galleryImageUrls')) {
          const store = database.createObjectStore('galleryImageUrls', {
            keyPath: ['bookId', 'imageId'],
          })
          store.createIndex('by-book', 'bookId')
          store.createIndex('by-resolved-at', 'resolvedAt')
        }
      },
      terminated() {
        databasePromise = undefined
      },
    })

    databasePromise = openWithTimeout(opening).catch((error) => {
      databasePromise = undefined
      throw error
    })
  }
  return databasePromise
}

function openWithTimeout(
  opening: Promise<IDBPDatabase<EViewerCacheDatabase>>,
): Promise<IDBPDatabase<EViewerCacheDatabase>> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = globalThis.setTimeout(() => {
      settled = true
      reject(new Error('IndexedDB 打开超时'))
    }, databaseOpenTimeout)

    opening.then(
      (database) => {
        if (settled) {
          database.close()
          return
        }
        settled = true
        globalThis.clearTimeout(timeout)
        resolve(database)
      },
      (error) => {
        if (settled) {
          return
        }
        settled = true
        globalThis.clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

export async function validateIndexedDbEnvironment(): Promise<IndexedDbEnvironmentStatus> {
  if (typeof indexedDB === 'undefined') {
    return {
      supported: false,
      usable: false,
      message: '当前浏览器不支持 IndexedDB',
    }
  }

  const probeKey = `environment-probe:${Date.now()}`
  try {
    const database = await openCacheDatabase()
    await database.put('meta', { key: probeKey, value: Date.now() })
    const probe = await database.get('meta', probeKey)
    await database.delete('meta', probeKey)
    if (!probe) {
      throw new Error('IndexedDB 写入后无法读取')
    }
    const estimate =
      typeof navigator !== 'undefined' ? await navigator.storage?.estimate?.() : undefined
    return {
      supported: true,
      usable: true,
      message: 'IndexedDB 读写正常，可以使用缓存功能',
      usage: estimate?.usage,
      quota: estimate?.quota,
    }
  } catch (error) {
    return {
      supported: true,
      usable: false,
      message: `IndexedDB 无法使用：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function clearCacheStore(
  storeName: 'tagTranslations' | 'galleryDetails' | 'galleryImagePages' | 'galleryImageUrls',
) {
  const database = await openCacheDatabase()
  await database.clear(storeName)
}
