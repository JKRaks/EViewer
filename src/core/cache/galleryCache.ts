import { bookInfoBusi } from '../books/bookInfoBusi'
import { watch } from 'vue'
import {
  connectionSettings,
  currentTransportSignal,
  type RequestMode,
  type GallerySite,
} from '../connector/connectionSettings'
import { bookInfoInput } from '../model/book/bookInfoInput'
import { bookInfoOutput, userComment } from '../model/book/bookInfoOutput'
import type { tagCollection } from '../model/book/tag'
import { indexedDbCacheSettings } from './cacheSettings'
import {
  clearCacheStore,
  openCacheDatabase,
  type GalleryDetailRecord,
  type GalleryImagePageRecord,
} from './indexedDb'

const pendingRequests = new Map<string, Promise<bookInfoOutput>>()
watch(
  () => [connectionSettings.mode, connectionSettings.site],
  () => pendingRequests.clear(),
  { flush: 'sync' },
)
const imageUrlExpiryBufferMs = 30_000

interface CachedBookInfoPayload {
  commentFormatVersion?: number
  isSuccess: boolean
  data?: string[]
  msg: string
  bookId: string
  coverImage: string
  imageCount: number
  bookName: string
  favorited: number
  language: string
  totalSize: string
  publishDate?: string
  rating: string
  ratingCount: number
  tags: tagCollection[]
  visible: string
  pageIndex: number
  lastPageIndex: number
  category: string
  uploader: string
  userComments?: Array<Omit<userComment, 'date'> & { date?: string }>
}

export type BookInfoCachePurpose = 'detail' | 'viewer'

export function normalizeBookId(bookId: string): string {
  return bookId.trim().replace('-', '/')
}

export async function getBookInfoWithCache(
  input: bookInfoInput,
  purpose: BookInfoCachePurpose,
  forceRefresh = false,
): Promise<bookInfoOutput> {
  const mode = connectionSettings.mode
  const site = connectionSettings.site
  const signal = currentTransportSignal()
  const bookId = normalizeBookId(input.bookId)
  const pageIndex = input.page ?? 0
  let staleDetail: GalleryDetailRecord | undefined

  if (indexedDbCacheSettings.enabled) {
    try {
      const database = await openCacheDatabase()
      if (purpose === 'detail' && indexedDbCacheSettings.cacheBookDetails && pageIndex === 0) {
        staleDetail = await database.get('galleryDetails', bookId)
        signal.throwIfAborted()
        if (
          staleDetail &&
          ((staleDetail.requestMode || 'server') !== mode ||
            (staleDetail.gallerySite || 'eh') !== site)
        )
          staleDetail = undefined
        if (
          staleDetail &&
          !forceRefresh &&
          (staleDetail.payload as CachedBookInfoPayload).commentFormatVersion === 1
        ) {
          return hydrateBookInfo(staleDetail.payload)
        }
      }
      if (purpose === 'viewer' && indexedDbCacheSettings.cacheBookImageInfo && !forceRefresh) {
        const cachedPage = await database.get('galleryImagePages', [bookId, pageIndex])
        signal.throwIfAborted()
        if (
          cachedPage &&
          (cachedPage.requestMode || 'server') === mode &&
          (cachedPage.gallerySite || 'eh') === site
        ) {
          return hydrateImagePage(cachedPage)
        }
      }
    } catch (error) {
      if (signal.aborted) throw error
      console.warn('读取画册缓存失败，改用网络请求:', error)
    }
  }

  signal.throwIfAborted()
  const requestKey = `${mode}:${site}\u0000${bookId}\u0000${pageIndex}`
  let request = pendingRequests.get(requestKey)
  if (!request) {
    const networkInput = new bookInfoInput()
    Object.assign(networkInput, input, { bookId, page: pageIndex })
    request = new bookInfoBusi().getBookInfo(networkInput).finally(() => {
      if (pendingRequests.get(requestKey) === request) pendingRequests.delete(requestKey)
    })
    pendingRequests.set(requestKey, request)
  }

  try {
    const result = await request
    signal.throwIfAborted()
    if (result.isSuccess && indexedDbCacheSettings.enabled) {
      await persistBookInfo(result, purpose, mode, site)
    } else if (!result.isSuccess && staleDetail) {
      return hydrateBookInfo(staleDetail.payload)
    }
    return result
  } catch (error) {
    if (signal.aborted) throw error
    if (staleDetail) {
      return hydrateBookInfo(staleDetail.payload)
    }
    throw error
  }
}

export async function getCachedImagePages(bookId: string): Promise<GalleryImagePageRecord[]> {
  const mode = connectionSettings.mode
  const site = connectionSettings.site
  if (!indexedDbCacheSettings.enabled || !indexedDbCacheSettings.cacheBookImageInfo) {
    return []
  }
  try {
    const database = await openCacheDatabase()
    const records = await database.getAllFromIndex(
      'galleryImagePages',
      'by-book',
      normalizeBookId(bookId),
    )
    return records
      .filter(
        (record) =>
          (record.requestMode || 'server') === mode && (record.gallerySite || 'eh') === site,
      )
      .sort((left, right) => left.pageIndex - right.pageIndex)
  } catch (error) {
    console.warn('读取图片分页缓存失败:', error)
    return []
  }
}

export async function updateImagePageProgress(
  bookId: string,
  pageIndex: number,
  nextImageIndex: number,
) {
  if (!indexedDbCacheSettings.enabled || !indexedDbCacheSettings.cacheBookImageInfo) {
    return
  }
  try {
    const database = await openCacheDatabase()
    const key: [string, number] = [normalizeBookId(bookId), pageIndex]
    const record = await database.get('galleryImagePages', key)
    if (
      record &&
      (record.gallerySite || 'eh') === connectionSettings.site &&
      (record.requestMode || 'server') === connectionSettings.mode
    ) {
      record.nextImageIndex = Math.min(Math.max(nextImageIndex, 0), record.imageIds.length)
      record.updatedAt = Date.now()
      await database.put('galleryImagePages', record)
    }
  } catch (error) {
    console.warn('更新图片解析进度失败:', error)
  }
}

export async function getCachedImageUrls(bookId: string) {
  const mode = connectionSettings.mode
  const site = connectionSettings.site
  if (!indexedDbCacheSettings.enabled || !indexedDbCacheSettings.cacheBookImageInfo) {
    return new Map<string, string>()
  }
  try {
    const database = await openCacheDatabase()
    const records = await database.getAllFromIndex(
      'galleryImageUrls',
      'by-book',
      normalizeBookId(bookId),
    )
    const validRecords: typeof records = []
    const expiredRecords: typeof records = []
    for (const record of records) {
      if ((record.requestMode || 'server') !== mode || (record.gallerySite || 'eh') !== site)
        continue
      if (isCachedImageUrlValid(record.url)) {
        validRecords.push(record)
      } else {
        expiredRecords.push(record)
      }
    }
    if (expiredRecords.length > 0) {
      await Promise.all(
        expiredRecords.map((record) =>
          database.delete('galleryImageUrls', [record.bookId, record.imageId]),
        ),
      )
    }
    return new Map(validRecords.map((record) => [record.imageId, record.url]))
  } catch (error) {
    console.warn('读取图片 URL 缓存失败:', error)
    return new Map<string, string>()
  }
}

export function isCachedImageUrlValid(url: string, now = Date.now()): boolean {
  if (!url) return false

  const keystamp = url.match(/keystamp=(\d+)/)?.[1]
  if (!keystamp) return true

  const expiresAt = Number(keystamp) * 1000
  return Number.isFinite(expiresAt) && expiresAt > now + imageUrlExpiryBufferMs
}

export async function cacheImageUrl(bookId: string, imageId: string, url: string) {
  const requestMode = connectionSettings.mode
  const gallerySite = connectionSettings.site
  if (!indexedDbCacheSettings.enabled || !indexedDbCacheSettings.cacheBookImageInfo || !url) {
    return
  }
  try {
    const database = await openCacheDatabase()
    await database.put('galleryImageUrls', {
      requestMode,
      gallerySite,
      bookId: normalizeBookId(bookId),
      imageId,
      url,
      resolvedAt: Date.now(),
    })
  } catch (error) {
    console.warn('保存图片 URL 缓存失败:', error)
  }
}

export async function invalidateCachedImageUrl(bookId: string, imageId: string) {
  if (!indexedDbCacheSettings.enabled || !indexedDbCacheSettings.cacheBookImageInfo) {
    return
  }
  try {
    const database = await openCacheDatabase()
    await database.delete('galleryImageUrls', [normalizeBookId(bookId), imageId])
  } catch (error) {
    console.warn('清除失效图片 URL 缓存失败:', error)
  }
}

export async function clearGalleryDetailsCache() {
  await clearCacheStore('galleryDetails')
}

export async function clearGalleryImageCache() {
  await Promise.all([clearCacheStore('galleryImagePages'), clearCacheStore('galleryImageUrls')])
}

async function persistBookInfo(
  result: bookInfoOutput,
  purpose: BookInfoCachePurpose,
  requestMode: RequestMode,
  gallerySite: GallerySite,
) {
  try {
    const database = await openCacheDatabase()
    const bookId = normalizeBookId(result.bookId)
    const tasks: Promise<unknown>[] = []
    if (purpose === 'detail' && result.pageIndex === 0 && indexedDbCacheSettings.cacheBookDetails) {
      tasks.push(
        database.put('galleryDetails', {
          requestMode,
          gallerySite,
          bookId,
          payload: serializeBookInfo(result),
          updatedAt: Date.now(),
        }),
      )
    }
    if (indexedDbCacheSettings.cacheBookImageInfo) {
      const imageIds = Array.isArray(result.data) ? result.data : []
      const key: [string, number] = [bookId, result.pageIndex]
      const existing = await database.get('galleryImagePages', key)
      const sameImages =
        existing?.gallerySite === gallerySite &&
        existing?.requestMode === requestMode &&
        existing?.imageIds.length === imageIds.length &&
        existing.imageIds.every((imageId, index) => imageId === imageIds[index])
      tasks.push(
        database.put('galleryImagePages', {
          requestMode,
          gallerySite,
          bookId,
          pageIndex: result.pageIndex,
          imageIds,
          nextImageIndex: sameImages ? existing.nextImageIndex : 0,
          lastPageIndex: result.lastPageIndex,
          updatedAt: Date.now(),
        }),
      )
    }
    await Promise.all(tasks)
  } catch (error) {
    console.warn('保存画册缓存失败:', error)
  }
}

function serializeBookInfo(result: bookInfoOutput): CachedBookInfoPayload {
  return {
    commentFormatVersion: 1,
    isSuccess: result.isSuccess,
    data: result.data ? [...result.data] : undefined,
    msg: result.msg,
    bookId: result.bookId,
    coverImage: result.coverImage,
    imageCount: result.imageCount,
    bookName: result.bookName,
    favorited: result.favorited,
    language: result.language,
    totalSize: result.totalSize,
    publishDate: result.publishDate?.toISOString(),
    rating: result.rating,
    ratingCount: result.ratingCount,
    tags: result.tags.map((collection) => ({
      collection: collection.collection,
      items: collection.items.map((tag) => ({ ...tag })),
    })),
    visible: result.visible,
    pageIndex: result.pageIndex,
    lastPageIndex: result.lastPageIndex,
    category: result.category,
    uploader: result.uploader,
    userComments: result.userComments?.map((comment) => ({
      username: comment.username,
      comment: comment.comment,
      contentHtml: comment.contentHtml,
      date: comment.date?.toISOString(),
      score: comment.score,
      isUploader: comment.isUploader,
    })),
  }
}

function hydrateBookInfo(payload: unknown): bookInfoOutput {
  const cached = payload as CachedBookInfoPayload
  const result = Object.assign(new bookInfoOutput(), cached, {
    data: cached.data ? [...cached.data] : undefined,
    publishDate: cached.publishDate ? new Date(cached.publishDate) : undefined,
    tags: (cached.tags ?? []).map((collection) => ({
      collection: collection.collection,
      items: collection.items.map((tag) => ({ ...tag })),
    })),
    userComments: cached.userComments?.map((cachedComment) =>
      Object.assign(new userComment(), cachedComment, {
        date: cachedComment.date ? new Date(cachedComment.date) : undefined,
      }),
    ),
  })
  return result
}

function hydrateImagePage(record: GalleryImagePageRecord): bookInfoOutput {
  const result = new bookInfoOutput()
  result.isSuccess = true
  result.bookId = record.bookId
  result.pageIndex = record.pageIndex
  result.lastPageIndex = record.lastPageIndex
  result.data = [...record.imageIds]
  return result
}
