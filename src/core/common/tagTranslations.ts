import { ref } from 'vue'
import { locale } from '@/i18n'
import type { tagItem } from '../model/book/tag'
import tagCollectionTranslationData from '../data/tagCollectionTranslations.json'
import { indexedDbCacheSettings } from '../cache/cacheSettings'
import { openCacheDatabase } from '../cache/indexedDb'
import { lookupTagTranslations, onTagTranslationCacheRebuilt } from './tagTranslationWorkerClient'
import {
  activeTranslationMetaKey,
  createLookupKey,
  createStoredTranslationKey,
  splitLookupKey,
  tagTranslationDatasetVersion,
  type ActiveTranslationMeta,
  type TagResolution,
} from './tagTranslationProtocol'

export interface tagDisplayInfo {
  text: string
  original: string
  master: string
  translated: boolean
}

export interface tagDisplayInput {
  collection: string
  tag: tagItem
}

const tagCollectionTranslations = tagCollectionTranslationData as Readonly<Record<string, string>>
const translationRevision = ref(0)
const resolvedTranslations = new Map<string, TagResolution | null>()
const pendingLookupKeys = new Set<string>()

let lookupFlushScheduled = false
let useWorkerFallback = false

onTagTranslationCacheRebuilt(() => {
  resolvedTranslations.clear()
  useWorkerFallback = false
  translationRevision.value++
})

/** 解析标签分组名称；缺失翻译时回退英文原名。 */
export function getTagCollectionDisplayName(collection: string): string {
  const original = collection.trim()
  if (locale.value === 'en') return original
  return tagCollectionTranslations[normalize(original)] ?? original
}

/** 异步查询翻译；当前未取得结果时先展示英文原名。 */
export function getTagDisplayInfo(collection: string, tag: tagItem): tagDisplayInfo {
  if (locale.value === 'en')
    return { text: tag.name, original: tag.name, master: tag.name, translated: false }
  void translationRevision.value
  const namespace = normalize(collection)
  const original = tag.name.trim()
  const lookupKey = createLookupKey(namespace, normalize(original))
  const resolution = resolvedTranslations.get(lookupKey) ?? undefined

  if (!resolvedTranslations.has(lookupKey)) {
    enqueueTranslationLookup(lookupKey)
  }

  return createTagDisplayInfo(original, resolution)
}

/** 批量等待标签翻译完成，用于导出等不应先显示英文回退值的场景。 */
export async function resolveTagDisplayInfos(inputs: tagDisplayInput[]): Promise<tagDisplayInfo[]> {
  if (locale.value === 'en')
    return inputs.map(({ tag }) => ({
      text: tag.name,
      original: tag.name,
      master: tag.name,
      translated: false,
    }))
  const descriptors = inputs.map(({ collection, tag }) => {
    const namespace = normalize(collection)
    const original = tag.name.trim()
    return {
      original,
      lookupKey: createLookupKey(namespace, normalize(original)),
    }
  })
  const missingKeys = [
    ...new Set(
      descriptors
        .map(({ lookupKey }) => lookupKey)
        .filter((lookupKey) => !resolvedTranslations.has(lookupKey)),
    ),
  ]

  if (missingKeys.length) {
    await resolveTranslationKeys(missingKeys)
  }

  return descriptors.map(({ original, lookupKey }) =>
    createTagDisplayInfo(original, resolvedTranslations.get(lookupKey) ?? undefined),
  )
}

function enqueueTranslationLookup(lookupKey: string) {
  pendingLookupKeys.add(lookupKey)
  if (lookupFlushScheduled) {
    return
  }
  lookupFlushScheduled = true
  globalThis.setTimeout(() => void flushTranslationLookups(), 0)
}

async function flushTranslationLookups() {
  lookupFlushScheduled = false
  const keys = [...pendingLookupKeys]
  pendingLookupKeys.clear()
  if (!keys.length) {
    return
  }

  await resolveTranslationKeys(keys)
}

async function resolveTranslationKeys(keys: string[]) {
  if (
    indexedDbCacheSettings.enabled &&
    indexedDbCacheSettings.cacheTagTranslations &&
    !useWorkerFallback
  ) {
    try {
      const database = await openCacheDatabase()
      const activeRecord = await database.get('meta', activeTranslationMetaKey)
      const active = activeRecord?.value as ActiveTranslationMeta | undefined
      if (active?.status === 'complete' && active.datasetVersion === tagTranslationDatasetVersion) {
        const transaction = database.transaction('tagTranslations', 'readonly')
        const records = await Promise.all(
          keys.map((key) =>
            transaction.store.get(createStoredTranslationKey(active.generation, key)),
          ),
        )
        await transaction.done
        keys.forEach((key, index) => {
          const record = records[index]
          resolvedTranslations.set(
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
        return
      }
      useWorkerFallback = true
    } catch (error) {
      console.warn('读取标签翻译缓存失败，改用后台翻译任务:', error)
      useWorkerFallback = true
    }
  }

  await lookupTranslationsInWorker(keys)
}

async function lookupTranslationsInWorker(keys: string[]) {
  try {
    const results = await lookupTagTranslations(
      keys.map((key) => {
        const [namespace, alias] = splitLookupKey(key)
        return { key, namespace, alias }
      }),
    )
    results.forEach(({ key, resolution }) => {
      resolvedTranslations.set(key, resolution)
    })
  } catch (error) {
    console.warn('后台标签翻译任务失败，保留标签原名:', error)
    keys.forEach((key) => resolvedTranslations.set(key, null))
  }
  translationRevision.value++
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function createTagDisplayInfo(
  original: string,
  resolution: TagResolution | null | undefined,
): tagDisplayInfo {
  const text = resolution?.displayName ?? original
  return {
    text,
    original,
    master: resolution?.master ?? original,
    translated: text !== original,
  }
}
