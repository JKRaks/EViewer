import { ref } from 'vue'
import type { tagItem } from '../model/book/tag'
import officialTagTranslationData from '../data/officialTagTranslations.json'
import tagCollectionTranslationData from '../data/tagCollectionTranslations.json'
import { indexedDbCacheSettings } from '../cache/cacheSettings'
import {
  openCacheDatabase,
  type TagTranslationCacheRecord,
} from '../cache/indexedDb'

export interface TagTranslationEntry {
  dispName: string
  sub: string[]
}

export type TagTranslationData = Record<string, Record<string, TagTranslationEntry>>

interface TagResolution {
  master: string
  displayName: string
  source: 'official' | 'unofficial'
}

interface ActiveTranslationMeta {
  status: 'complete'
  datasetVersion: string
  generation: string
  count: number
  updatedAt: number
}

export interface TagTranslationCacheStatus {
  available: boolean
  count: number
  updatedAt?: number
  datasetVersion?: string
}

export interface tagDisplayInfo {
  text: string
  original: string
  master: string
  translated: boolean
}

const tagTranslationDatasetVersion = '2026-07-15-15bdf67e-v1'
const activeTranslationMetaKey = 'tagTranslations.active'
const buildTranslationMetaKey = 'tagTranslations.build'
const officialTagTranslations = officialTagTranslationData as TagTranslationData
const tagCollectionTranslations = tagCollectionTranslationData as Readonly<Record<string, string>>
const officialIndex = buildTranslationIndex(officialTagTranslations, 'official')
const translationRevision = ref(0)
const indexedDbResults = new Map<string, TagResolution | null>()
const pendingIndexedDbKeys = new Set<string>()

let indexedDbFlushScheduled = false
let useUnofficialJsonFallback = false
let unofficialIndex: Map<string, Map<string, TagResolution | null>> | undefined
let unofficialIndexPromise: Promise<Map<string, Map<string, TagResolution | null>>> | undefined

/** 解析标签分组名称；缺失翻译时回退英文原名。 */
export function getTagCollectionDisplayName(collection: string): string {
  const original = collection.trim()
  return tagCollectionTranslations[normalize(original)] ?? original
}

/** 官方库优先，未命中时按配置查询 IndexedDB 或非官方 JSON。 */
export function getTagDisplayInfo(collection: string, tag: tagItem): tagDisplayInfo {
  void translationRevision.value
  const namespace = normalize(collection)
  const original = tag.name.trim()
  const alias = normalize(original)
  const lookupKey = createLookupKey(namespace, alias)
  let resolution = officialIndex.get(namespace)?.get(alias) ?? undefined

  if (!resolution) {
    if (
      indexedDbCacheSettings.enabled &&
      indexedDbCacheSettings.cacheTagTranslations &&
      !useUnofficialJsonFallback
    ) {
      resolution = indexedDbResults.get(lookupKey) ?? undefined
      if (!indexedDbResults.has(lookupKey)) {
        enqueueIndexedDbLookup(lookupKey)
      }
    } else if (unofficialIndex) {
      resolution = unofficialIndex.get(namespace)?.get(alias) ?? undefined
    } else {
      void ensureUnofficialIndex()
    }
  }

  const text = resolution?.displayName ?? original
  return {
    text,
    original,
    master: resolution?.master ?? original,
    translated: text !== original,
  }
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
  const database = await openCacheDatabase()
  const previousRecord = await database.get('meta', activeTranslationMetaKey)
  const previousMeta = previousRecord?.value as ActiveTranslationMeta | undefined
  const nonofficial = await loadUnofficialData()
  const nonofficialResolvedIndex = buildTranslationIndex(nonofficial, 'unofficial')
  unofficialIndex = nonofficialResolvedIndex
  const effective = flattenTranslationIndex(officialIndex)

  for (const [key, resolution] of flattenTranslationIndex(nonofficialResolvedIndex)) {
    if (!effective.has(key)) {
      effective.set(key, resolution)
    }
  }

  const generation = `${Date.now()}`
  const entries = [...effective.entries()]
  await database.put('meta', {
    key: buildTranslationMetaKey,
    value: { status: 'building', generation, count: entries.length, updatedAt: Date.now() },
  })

  try {
    const chunkSize = 1000
    for (let offset = 0; offset < entries.length; offset += chunkSize) {
      const transaction = database.transaction('tagTranslations', 'readwrite')
      for (const [lookupKey, resolution] of entries.slice(offset, offset + chunkSize)) {
        const [namespace, alias] = splitLookupKey(lookupKey)
        const record: TagTranslationCacheRecord = {
          key: createStoredTranslationKey(generation, lookupKey),
          generation,
          namespace,
          alias,
          master: resolution.master,
          displayName: resolution.displayName,
          source: resolution.source,
        }
        void transaction.store.put(record)
      }
      await transaction.done
      onProgress?.(Math.min(offset + chunkSize, entries.length), entries.length)
    }

    const activeMeta: ActiveTranslationMeta = {
      status: 'complete',
      datasetVersion: tagTranslationDatasetVersion,
      generation,
      count: entries.length,
      updatedAt: Date.now(),
    }
    const activation = database.transaction('meta', 'readwrite')
    void activation.store.put({ key: activeTranslationMetaKey, value: activeMeta })
    void activation.store.delete(buildTranslationMetaKey)
    await activation.done
  } catch (error) {
    await deleteTranslationGeneration(database, generation)
    await database.delete('meta', buildTranslationMetaKey)
    throw error
  }

  if (previousMeta?.generation && previousMeta.generation !== generation) {
    await deleteTranslationGeneration(database, previousMeta.generation)
  }

  indexedDbResults.clear()
  useUnofficialJsonFallback = false
  translationRevision.value++
  return entries.length
}

async function deleteTranslationGeneration(
  database: Awaited<ReturnType<typeof openCacheDatabase>>,
  generation: string,
) {
  const keys = await database.getAllKeysFromIndex(
    'tagTranslations',
    'by-generation',
    generation,
  )
  const transaction = database.transaction('tagTranslations', 'readwrite')
  for (const key of keys) {
    void transaction.store.delete(key)
  }
  await transaction.done
}

function buildTranslationIndex(
  data: TagTranslationData,
  source: TagResolution['source'],
): Map<string, Map<string, TagResolution | null>> {
  const result = new Map<string, Map<string, TagResolution | null>>()
  for (const [namespace, entries] of Object.entries(data)) {
    const namespaceIndex = new Map<string, TagResolution | null>()
    for (const [master, entry] of Object.entries(entries)) {
      const resolution = { master, displayName: entry.dispName, source }
      for (const rawAlias of [master, ...entry.sub]) {
        const alias = normalize(rawAlias)
        const existing = namespaceIndex.get(alias)
        if (!namespaceIndex.has(alias)) {
          namespaceIndex.set(alias, resolution)
        } else if (normalize(master) === alias) {
          namespaceIndex.set(alias, resolution)
        } else if (
          existing &&
          normalize(existing.master) !== alias &&
          existing.master !== master
        ) {
          namespaceIndex.set(alias, null)
        }
      }
    }
    result.set(normalize(namespace), namespaceIndex)
  }
  return result
}

async function loadUnofficialData(): Promise<TagTranslationData> {
  const module = await import('../data/unofficialTagTranslations.json')
  return module.default as TagTranslationData
}

async function ensureUnofficialIndex() {
  if (!unofficialIndexPromise) {
    unofficialIndexPromise = loadUnofficialData().then((data) => {
      unofficialIndex = buildTranslationIndex(data, 'unofficial')
      translationRevision.value++
      return unofficialIndex
    }).catch((error) => {
      console.warn('加载非官方标签翻译失败，保留标签原名:', error)
      unofficialIndex = new Map()
      translationRevision.value++
      return unofficialIndex
    })
  }
  return unofficialIndexPromise
}

function enqueueIndexedDbLookup(lookupKey: string) {
  pendingIndexedDbKeys.add(lookupKey)
  if (indexedDbFlushScheduled) {
    return
  }
  indexedDbFlushScheduled = true
  void Promise.resolve().then(flushIndexedDbLookups)
}

async function flushIndexedDbLookups() {
  indexedDbFlushScheduled = false
  const keys = [...pendingIndexedDbKeys]
  pendingIndexedDbKeys.clear()
  if (!keys.length) {
    return
  }

  try {
    const database = await openCacheDatabase()
    const activeRecord = await database.get('meta', activeTranslationMetaKey)
    const active = activeRecord?.value as ActiveTranslationMeta | undefined
    if (active?.status !== 'complete' || active.datasetVersion !== tagTranslationDatasetVersion) {
      useUnofficialJsonFallback = true
      await ensureUnofficialIndex()
      return
    }
    const transaction = database.transaction('tagTranslations', 'readonly')
    const records = await Promise.all(
      keys.map((key) => transaction.store.get(createStoredTranslationKey(active.generation, key))),
    )
    await transaction.done
    keys.forEach((key, index) => {
      const record = records[index]
      indexedDbResults.set(
        key,
        record
          ? {
              master: record.master,
              displayName: record.displayName,
              source: record.source,
            }
          : null,
      )
    })
    translationRevision.value++
  } catch {
    useUnofficialJsonFallback = true
    await ensureUnofficialIndex()
  }
}

function flattenTranslationIndex(index: Map<string, Map<string, TagResolution | null>>) {
  const result = new Map<string, TagResolution>()
  for (const [namespace, aliases] of index) {
    for (const [alias, resolution] of aliases) {
      if (resolution) {
        result.set(createLookupKey(namespace, alias), resolution)
      }
    }
  }
  return result
}

function createLookupKey(namespace: string, alias: string) {
  return `${namespace}\u0000${alias}`
}

function splitLookupKey(key: string): [string, string] {
  const separator = key.indexOf('\u0000')
  return [key.slice(0, separator), key.slice(separator + 1)]
}

function createStoredTranslationKey(generation: string, lookupKey: string) {
  return `${generation}\u0000${lookupKey}`
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}
