/// <reference lib="webworker" />

import officialTagTranslationData from '../data/officialTagTranslations.json'
import tagCollectionTranslationData from '../data/tagCollectionTranslations.json'
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
  type SearchableTag,
  type TagNamespaceSummary,
} from '../common/tagTranslationProtocol'

const workerScope = self as DedicatedWorkerGlobalScope
let officialTranslationIndex: Map<string, TagResolution> | undefined
let unofficialTranslationIndexPromise: Promise<Map<string, TagResolution>> | undefined
let tagSearchIndexPromise: Promise<TagSearchIndex> | undefined

interface TagSearchIndex {
  namespaces: TagNamespaceSummary[]
  byNamespace: Map<string, SearchableTag[]>
}

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

    if (request.type === 'list-namespaces') {
      const index = await getTagSearchIndex(request.useCache)
      postResponse({ id: request.id, type: 'namespaces-complete', namespaces: index.namespaces })
      return
    }

    if (request.type === 'list-master-tags') {
      const index = await getTagSearchIndex(request.useCache)
      const namespace = normalize(request.namespace)
      const tags = index.byNamespace.get(namespace) ?? []
      const offset = Math.max(0, request.offset)
      postResponse({
        id: request.id,
        type: 'master-tags-complete',
        page: {
          namespace,
          total: tags.length,
          offset,
          items: tags.slice(offset, offset + Math.max(1, request.limit)),
        },
      })
      return
    }

    if (request.type === 'search-master-tags') {
      const index = await getTagSearchIndex(request.useCache)
      postResponse({
        id: request.id,
        type: 'search-complete',
        results: searchTags(index, request.keyword, request.namespace, request.limit),
      })
      return
    }

    const translations = await getEffectiveTranslationIndex()
    const count = await rebuildTranslationCache(request.id, translations)
    tagSearchIndexPromise = undefined
    postResponse({ id: request.id, type: 'rebuild-complete', count })
  } catch (error) {
    postResponse({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function getTagSearchIndex(useCache: boolean) {
  if (!tagSearchIndexPromise) {
    tagSearchIndexPromise = useCache
      ? buildSearchIndexFromCache().then((cached) => cached ?? buildSearchIndexFromJson())
      : buildSearchIndexFromJson()
  }
  return tagSearchIndexPromise
}

async function buildSearchIndexFromCache(): Promise<TagSearchIndex | undefined> {
  try {
    const database = await openCacheDatabase()
    const activeRecord = await database.get('meta', activeTranslationMetaKey)
    const active = activeRecord?.value as ActiveTranslationMeta | undefined
    if (active?.status !== 'complete' || active.datasetVersion !== tagTranslationDatasetVersion) {
      return undefined
    }
    const records = await database.getAllFromIndex(
      'tagTranslations',
      'by-generation',
      active.generation,
    )
    const grouped = new Map<string, SearchableTag & { aliasSet: Set<string> }>()
    for (const record of records) {
      const key = createLookupKey(record.namespace, normalize(record.master))
      let tag = grouped.get(key)
      if (!tag) {
        tag = {
          namespace: record.namespace,
          master: record.master,
          displayName: record.displayName,
          source: record.source,
          aliases: [],
          aliasSet: new Set(),
        }
        grouped.set(key, tag)
      }
      tag.aliasSet.add(record.alias)
    }
    return finalizeSearchIndex(
      [...grouped.values()].map(({ aliasSet, ...tag }) => ({
        ...tag,
        aliases: [...aliasSet],
      })),
    )
  } catch {
    return undefined
  }
}

async function buildSearchIndexFromJson(): Promise<TagSearchIndex> {
  const unofficial = (await import('../data/unofficialTagTranslations.json'))
    .default as TagTranslationData
  const masters = new Map<string, SearchableTag>()
  addMasterRecords(masters, officialTagTranslationData as TagTranslationData, 'official')
  addMasterRecords(masters, unofficial, 'unofficial')
  return finalizeSearchIndex([...masters.values()])
}

function addMasterRecords(
  target: Map<string, SearchableTag>,
  data: TagTranslationData,
  source: SearchableTag['source'],
) {
  for (const [rawNamespace, entries] of Object.entries(data)) {
    const namespace = normalize(rawNamespace)
    for (const [master, entry] of Object.entries(entries)) {
      const key = createLookupKey(namespace, normalize(master))
      if (target.has(key)) continue
      target.set(key, {
        namespace,
        master,
        displayName: entry.dispName || master,
        aliases: [...new Set([master, ...entry.sub].map(normalize).filter(Boolean))],
        source,
      })
    }
  }
}

function finalizeSearchIndex(records: SearchableTag[]): TagSearchIndex {
  const byNamespace = new Map<string, SearchableTag[]>()
  for (const record of records) {
    const tags = byNamespace.get(record.namespace) ?? []
    tags.push(record)
    byNamespace.set(record.namespace, tags)
  }

  byNamespace.forEach((tags) =>
    tags.sort((left, right) =>
      left.displayName.localeCompare(right.displayName, 'zh-CN', { sensitivity: 'base' }),
    ),
  )
  const collectionNames = tagCollectionTranslationData as Record<string, string>
  const namespaces = [...byNamespace.entries()].map(([namespace, tags]) => ({
    namespace,
    displayName: collectionNames[namespace] ?? namespace,
    count: tags.length,
  }))
  return { namespaces, byNamespace }
}

function searchTags(
  index: TagSearchIndex,
  keyword: string,
  rawNamespace: string | undefined,
  limit: number,
) {
  const query = normalize(keyword)
  if (!query) return []
  const namespace = rawNamespace ? normalize(rawNamespace) : undefined
  const candidates = namespace
    ? (index.byNamespace.get(namespace) ?? [])
    : [...index.byNamespace.values()].flat()

  return candidates
    .map((tag) => ({ tag, score: scoreTag(tag, query) }))
    .filter(({ score }) => score < 4)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.tag.displayName.localeCompare(right.tag.displayName, 'zh-CN'),
    )
    .slice(0, Math.max(1, limit))
    .map(({ tag }) => tag)
}

function scoreTag(tag: SearchableTag, query: string) {
  const values = [tag.displayName, tag.master, ...tag.aliases].map(normalize)
  if (values.some((value) => value === query)) return 0
  if (values.some((value) => value.startsWith(query))) return 1
  if (values.some((value) => value.includes(query))) return 2
  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.length > 1 && terms.every((term) => values.some((value) => value.includes(term)))) {
    return 3
  }
  return 4
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
  const keys = await database.getAllKeysFromIndex('tagTranslations', 'by-generation', generation)
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
        } else if (existing && normalize(existing.master) !== alias && existing.master !== master) {
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
