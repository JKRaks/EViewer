export interface TagTranslationEntry {
  dispName: string
  sub: string[]
}

export type TagTranslationData = Record<string, Record<string, TagTranslationEntry>>

export interface TagResolution {
  master: string
  displayName: string
  source: 'official' | 'unofficial'
}

export interface TagTranslationLookup {
  key: string
  namespace: string
  alias: string
}

export interface ActiveTranslationMeta {
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

export interface SearchableTag {
  namespace: string
  master: string
  displayName: string
  aliases: string[]
  source: 'official' | 'unofficial'
}

export interface TagNamespaceSummary {
  namespace: string
  displayName: string
  count: number
}

export interface TagMasterPage {
  namespace: string
  total: number
  offset: number
  items: SearchableTag[]
}

export type TagTranslationWorkerRequest =
  | { id: number; type: 'lookup'; queries: TagTranslationLookup[] }
  | { id: number; type: 'rebuild' }
  | { id: number; type: 'list-namespaces'; useCache: boolean }
  | {
      id: number
      type: 'list-master-tags'
      namespace: string
      offset: number
      limit: number
      useCache: boolean
    }
  | {
      id: number
      type: 'search-master-tags'
      keyword: string
      namespace?: string
      limit: number
      useCache: boolean
    }

export type TagTranslationWorkerResponse =
  | {
      id: number
      type: 'lookup-complete'
      results: Array<{ key: string; resolution: TagResolution | null }>
    }
  | { id: number; type: 'rebuild-progress'; completed: number; total: number }
  | { id: number; type: 'rebuild-complete'; count: number }
  | { id: number; type: 'namespaces-complete'; namespaces: TagNamespaceSummary[] }
  | { id: number; type: 'master-tags-complete'; page: TagMasterPage }
  | { id: number; type: 'search-complete'; results: SearchableTag[] }
  | { id: number; type: 'error'; message: string }

export const tagTranslationDatasetVersion = '2026-07-15-15bdf67e-v1'
export const activeTranslationMetaKey = 'tagTranslations.active'
export const buildTranslationMetaKey = 'tagTranslations.build'

export function createLookupKey(namespace: string, alias: string) {
  return `${namespace}\u0000${alias}`
}

export function splitLookupKey(key: string): [string, string] {
  const separator = key.indexOf('\u0000')
  return [key.slice(0, separator), key.slice(separator + 1)]
}

export function createStoredTranslationKey(generation: string, lookupKey: string) {
  return `${generation}\u0000${lookupKey}`
}
