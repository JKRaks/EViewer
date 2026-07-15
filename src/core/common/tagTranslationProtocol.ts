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

export type TagTranslationWorkerRequest =
  | { id: number; type: 'lookup'; queries: TagTranslationLookup[] }
  | { id: number; type: 'rebuild' }

export type TagTranslationWorkerResponse =
  | {
      id: number
      type: 'lookup-complete'
      results: Array<{ key: string; resolution: TagResolution | null }>
    }
  | { id: number; type: 'rebuild-progress'; completed: number; total: number }
  | { id: number; type: 'rebuild-complete'; count: number }
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
