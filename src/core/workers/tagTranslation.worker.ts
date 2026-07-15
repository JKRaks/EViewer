/// <reference lib="webworker" />

import officialTagTranslationData from '../data/officialTagTranslations.json'
import { openCacheDatabase, type TagTranslationCacheRecord } from '../cache/indexedDb'
import {
  activeTranslationMetaKey,
  buildTranslationMetaKey,
  createLookupKey,
  createStoredTranslationKey,
  tagTranslationDatasetVersion,
  type ActiveTranslationMeta,
  type TagResolution,
  type TagTranslationData,
  type TagTranslationWorkerRequest,
  type TagTranslationWorkerResponse,
} from '../common/tagTranslationProtocol'

const workerScope = self as DedicatedWorkerGlobalScope
let officialTranslationIndex: Map<string, TagResolution> | undefined
let unofficialTranslationIndexPromise: Promise<Map<string, TagResolution>> | undefined

workerScope.addEventListener('message', (event: MessageEvent<TagTranslationWorkerRequest>) => {
  void handleRequest(event.data)
})

async function handleRequest(request: TagTranslationWorkerRequest) {
  try {
    if (request.type === 'lookup') {
      const official = getOfficialTranslationIndex()
      const missingOfficial = request.queries.some((query) => !official.has(query.key))
      const unofficial = missingOfficial ? await getUnofficialTranslationIndex() : undefined
      postResponse({
        id: request.id,
        type: 'lookup-complete',
        results: request.queries.map((query) => ({
          key: query.key,
          resolution: official.get(query.key) ?? unofficial?.get(query.key) ?? null,
        })),
      })
      return
    }

    const translations = await getEffectiveTranslationIndex()
    const count = await rebuildTranslationCache(request.id, translations)
    postResponse({ id: request.id, type: 'rebuild-complete', count })
  } catch (error) {
    postResponse({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function getOfficialTranslationIndex() {
  if (!officialTranslationIndex) {
    officialTranslationIndex = flattenTranslationIndex(
      buildTranslationIndex(officialTagTranslationData as TagTranslationData, 'official'),
    )
  }
  return officialTranslationIndex
}

async function getUnofficialTranslationIndex() {
  if (!unofficialTranslationIndexPromise) {
    unofficialTranslationIndexPromise = import('../data/unofficialTagTranslations.json').then(
      (module) =>
        flattenTranslationIndex(
          buildTranslationIndex(module.default as TagTranslationData, 'unofficial'),
        ),
    )
  }
  return unofficialTranslationIndexPromise
}

async function getEffectiveTranslationIndex() {
  const effective = new Map(getOfficialTranslationIndex())
  for (const [key, resolution] of await getUnofficialTranslationIndex()) {
    if (!effective.has(key)) {
      effective.set(key, resolution)
    }
  }
  return effective
}

async function rebuildTranslationCache(
  requestId: number,
  translations: Map<string, TagResolution>,
) {
  const database = await openCacheDatabase()
  const previousRecord = await database.get('meta', activeTranslationMetaKey)
  const previousMeta = previousRecord?.value as ActiveTranslationMeta | undefined
  const generation = `${Date.now()}`
  const entries = [...translations.entries()]

  await database.put('meta', {
    key: buildTranslationMetaKey,
    value: { status: 'building', generation, count: entries.length, updatedAt: Date.now() },
  })

  try {
    const chunkSize = 1000
    for (let offset = 0; offset < entries.length; offset += chunkSize) {
      const transaction = database.transaction('tagTranslations', 'readwrite')
      for (const [lookupKey, resolution] of entries.slice(offset, offset + chunkSize)) {
        const separator = lookupKey.indexOf('\u0000')
        const record: TagTranslationCacheRecord = {
          key: createStoredTranslationKey(generation, lookupKey),
          generation,
          namespace: lookupKey.slice(0, separator),
          alias: lookupKey.slice(separator + 1),
          master: resolution.master,
          displayName: resolution.displayName,
          source: resolution.source,
        }
        void transaction.store.put(record)
      }
      await transaction.done
      postResponse({
        id: requestId,
        type: 'rebuild-progress',
        completed: Math.min(offset + chunkSize, entries.length),
        total: entries.length,
      })
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

function buildTranslationIndex(data: TagTranslationData, source: TagResolution['source']) {
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

function postResponse(response: TagTranslationWorkerResponse) {
  workerScope.postMessage(response)
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}
