import { indexedDbCacheSettings } from './cacheSettings'
import { normalizeBookId } from './galleryCache'
import { openCacheDatabase, type ReadingHistoryRecord } from './indexedDb'

export function isReadingHistoryEnabled() {
  return indexedDbCacheSettings.enabled && indexedDbCacheSettings.cacheReadingHistory
}

export async function getReadingHistory(bookId: string): Promise<ReadingHistoryRecord | undefined> {
  if (!isReadingHistoryEnabled()) return undefined
  try {
    return await (await openCacheDatabase()).get('readingHistory', normalizeBookId(bookId))
  } catch (error) {
    console.warn('读取浏览记录失败:', error)
    return undefined
  }
}

export async function listReadingHistory(): Promise<ReadingHistoryRecord[]> {
  if (!isReadingHistoryEnabled()) return []
  try {
    const records = await (await openCacheDatabase()).getAll('readingHistory')
    return records.sort((left, right) => right.updatedAt - left.updatedAt)
  } catch (error) {
    console.warn('读取浏览历史失败:', error)
    return []
  }
}

const pendingWrites = new Map<string, Promise<void>>()

export function recordViewedImage(
  bookId: string,
  ordinal: number,
  metadata: Pick<ReadingHistoryRecord, 'title' | 'coverUrl' | 'imageCount'>,
): Promise<void> {
  if (!isReadingHistoryEnabled() || !Number.isInteger(ordinal) || ordinal < 1) return Promise.resolve()
  const key = normalizeBookId(bookId)
  const previous = pendingWrites.get(key) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(async () => {
    if (!isReadingHistoryEnabled()) return
    try {
      const database = await openCacheDatabase()
      const record = await database.get('readingHistory', key)
      const viewedOrdinals = new Set(record?.viewedOrdinals ?? [])
      viewedOrdinals.add(ordinal)
      await database.put('readingHistory', {
        bookId: key,
        title: metadata.title || record?.title || '未命名画册',
        coverUrl: metadata.coverUrl || record?.coverUrl || '',
        imageCount: metadata.imageCount || record?.imageCount || 0,
        viewedOrdinals: Array.from(viewedOrdinals).sort((a, b) => a - b),
        lastOrdinal: ordinal,
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.warn('保存浏览记录失败:', error)
    }
  })
  pendingWrites.set(key, pending)
  void pending.finally(() => {
    if (pendingWrites.get(key) === pending) pendingWrites.delete(key)
  })
  return pending
}

export async function deleteReadingHistory(bookId: string) {
  const key = normalizeBookId(bookId)
  await pendingWrites.get(key)
  await (await openCacheDatabase()).delete('readingHistory', key)
}

export async function clearReadingHistory() {
  await Promise.all(pendingWrites.values())
  await (await openCacheDatabase()).clear('readingHistory')
}
