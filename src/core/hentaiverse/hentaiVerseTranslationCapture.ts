import { reactive, watch } from 'vue'
import { openCacheDatabase } from '../cache/indexedDb'

export type TranslationDomain = 'label' | 'description' | 'battleLog'
export interface TranslationCandidate {
  key: string
  domain: TranslationDomain
  section: string
  pattern: string
  translated: string
  status: 'unmatched' | 'partial' | 'resolved'
  count: number
  firstSeen: number
  lastSeen: number
  sourceVersions: string[]
  samples: string[]
  rulesVersion: number
}
interface CaptureContext {
  section: string
  version: string
  names: string[]
  seen: Set<string>
}

const settingKey = 'eviewer:hv-translation-capture'
const recordKey = 'hv-translation-candidates-v1'
const rulesVersion = 6
const limit = 1000
const candidates = new Map<string, TranslationCandidate>()
let context: CaptureContext | undefined
let loading: Promise<void> | undefined
let initialized = false
let suppress = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let writes = Promise.resolve()
const outsideSeen = new Set<string>()
let enabled = false
try {
  enabled = localStorage.getItem(settingKey) === 'true'
} catch {
  /* Storage is optional. */
}
export const translationCapture = reactive({
  enabled,
  count: 0,
  partial: 0,
  resolved: 0,
  memoryOnly: false,
})

function updateCounts() {
  const records = [...candidates.values()]
  translationCapture.count = records.filter((entry) => entry.status !== 'resolved').length
  translationCapture.partial = records.filter((entry) => entry.status === 'partial').length
  translationCapture.resolved = records.filter((entry) => entry.status === 'resolved').length
}

export function loadTranslationCandidates(): Promise<void> {
  if (initialized) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    try {
      const record = await (await openCacheDatabase()).get('meta', recordKey)
      const stored = Array.isArray(record?.value) ? (record.value as TranslationCandidate[]) : []
      for (const entry of stored.slice(-limit)) {
        if (
          !entry ||
          typeof entry.key !== 'string' ||
          typeof entry.pattern !== 'string' ||
          !Array.isArray(entry.samples)
        )
          continue
        const current = candidates.get(entry.key)
        candidates.set(
          entry.key,
          current
            ? {
                ...current,
                count: current.count + entry.count,
                firstSeen: Math.min(current.firstSeen, entry.firstSeen),
                samples: [...new Set([...entry.samples, ...current.samples])].slice(0, 3),
              }
            : entry,
        )
      }
      while (candidates.size > limit) candidates.delete(candidates.keys().next().value!)
    } catch {
      translationCapture.memoryOnly = true
    }
    initialized = true
    updateCounts()
  })()
  return loading
}

export function flushTranslationCandidates(): Promise<void> {
  clearTimeout(saveTimer)
  saveTimer = undefined
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      await loadTranslationCandidates()
      if (translationCapture.memoryOnly) return
      try {
        await (
          await openCacheDatabase()
        ).put('meta', { key: recordKey, value: [...candidates.values()] })
      } catch {
        translationCapture.memoryOnly = true
      }
    })
  return writes
}

watch(
  () => translationCapture.enabled,
  (value) => {
    try {
      localStorage.setItem(settingKey, String(value))
    } catch {
      /* Session-only setting. */
    }
    if (value) void loadTranslationCandidates()
    else if (initialized) void flushTranslationCandidates()
  },
)
if (enabled) void loadTranslationCandidates()
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (initialized) void flushTranslationCandidates()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && initialized) void flushTranslationCandidates()
  })
}

/** Scope one parsed response; nested translation calls and repeated fragments share its dedupe set. */
export function withTranslationCapture<T>(section: string, html: string, run: () => T): T {
  if (!translationCapture.enabled || suppress) return run()
  const previous = context
  context = {
    section,
    version: html.match(/\/z\/([a-z0-9._-]+)\/(?:hv|riddle)/i)?.[1] || '',
    names: [],
    seen: new Set(),
  }
  try {
    return run()
  } finally {
    context = previous
  }
}

export function protectTranslationNames(names: string[]) {
  if (context) context.names.push(...names.filter(Boolean))
}

export function withoutTranslationCapture<T>(run: () => T): T {
  const previous = suppress
  suppress = true
  try {
    return run()
  } finally {
    suppress = previous
  }
}

function sanitize(value: string, maskNumbers = true, translatedNames = false): string {
  let result = value.replace(/\s+/g, ' ').trim()
  for (const name of [...(context?.names || [])].sort((a, b) => b.length - a.length)) {
    result = result.split(name).join('{actor}')
    if (translatedNames) {
      // Term replacement can translate only one word of a custom name.
      for (const word of name.match(/[a-z]{3,}/gi) || [])
        result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), '{actor}')
    }
  }
  result = result
    .replace(/https?:\/\/\S+/gi, '{url}')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '{email}')
    .replace(/\b(?:MID|UID|GID)\s*=\s*\d+/gi, '{id}')
    .replace(/\b[a-f0-9]{16,}\b/gi, '{id}')
  if (maskNumbers) result = result.replace(/\b\d+(?:[,.]\d+)*\b/g, '{n}')
  return result.slice(0, 600)
}

function hasUntranslatedWords(value: string) {
  // Masked character names and the product name are intentionally kept verbatim.
  if (/^(?:The\s+)?\{actor\}$/i.test(value.trim())) return false
  return /\b[a-z]{2,}\b/i.test(
    value
      .replace(/\{[^}]+\}/g, '')
      .replace(/\b(?:HentaiVerse|HV|HP|MP|SP|EXP|GP|Hath|UTC|N\/A)\b/gi, ''),
  )
}

export function recordTranslationCandidate(
  domain: TranslationDomain,
  source: string,
  translated: string,
) {
  if (!translationCapture.enabled || suppress || !source || source.length > 2000) return
  // Capture display text only; credentials, markup and verification content never become samples.
  if (
    /<\/?[a-z][^>]*>|ipb_|cookie|pass_hash|battle_token|riddle|captcha|select all ponies|choose the right answer/i.test(
      source,
    )
  )
    return
  const pattern = sanitize(source)
  const result = sanitize(translated, true, true)
  const sample = sanitize(source, false)
  if (!hasUntranslatedWords(result) || !hasUntranslatedWords(pattern)) return
  if (/^[a-z0-9_-]{24,}$/i.test(pattern)) return
  const key = `${domain}:${context?.section || 'other'}:${pattern}`
  const seen = context?.seen || outsideSeen
  if (seen.has(key)) return
  seen.add(key)
  if (!context && outsideSeen.size > limit) outsideSeen.delete(outsideSeen.values().next().value!)
  const now = Date.now()
  const entry = candidates.get(key)
  const version = context?.version
  if (entry) {
    entry.count++
    entry.lastSeen = now
    entry.translated = result
    entry.status = /[\u3400-\u9fff]/.test(result) ? 'partial' : 'unmatched'
    if (version && !entry.sourceVersions.includes(version))
      entry.sourceVersions = [...entry.sourceVersions, version].slice(-8)
    if (!entry.samples.includes(sample)) entry.samples = [...entry.samples, sample].slice(0, 3)
    candidates.delete(key)
    candidates.set(key, entry)
  } else {
    if (candidates.size >= limit) candidates.delete(candidates.keys().next().value!)
    candidates.set(key, {
      key,
      domain,
      section: context?.section || 'other',
      pattern,
      translated: result,
      status: /[\u3400-\u9fff]/.test(result) ? 'partial' : 'unmatched',
      count: 1,
      firstSeen: now,
      lastSeen: now,
      sourceVersions: version ? [version] : [],
      samples: [sample],
      rulesVersion,
    })
  }
  updateCounts()
  void loadTranslationCandidates()
  if (!saveTimer) saveTimer = setTimeout(() => void flushTranslationCandidates(), 1000)
}

export async function reviewTranslationCandidates(
  translate: (domain: TranslationDomain, source: string) => string,
) {
  await loadTranslationCandidates()
  const previousContext = context
  const previousSuppress = suppress
  suppress = true
  try {
    for (const entry of candidates.values()) {
      // Translation rules identify actor/custom skill names while replaying each sample.
      context = { section: entry.section, version: '', names: [], seen: new Set() }
      const translated = sanitize(
        translate(entry.domain, entry.samples[0] || entry.pattern),
        true,
        true,
      )
      entry.translated = translated
      entry.status = hasUntranslatedWords(translated)
        ? /[\u3400-\u9fff]/.test(translated)
          ? 'partial'
          : 'unmatched'
        : 'resolved'
      entry.rulesVersion = rulesVersion
    }
  } finally {
    context = previousContext
    suppress = previousSuppress
  }
  updateCounts()
  await flushTranslationCandidates()
}

export async function exportTranslationCandidates() {
  await loadTranslationCandidates()
  await flushTranslationCandidates()
  let appRevision: string | null = null
  try {
    const response = await fetch('/deployment.json')
    if (response.ok) {
      const deployment = await response.json()
      if (/^[a-f0-9]{40}$/.test(deployment.revision)) appRevision = deployment.revision
    }
  } catch {
    /* ZIP and local development may not include deployment metadata. */
  }
  return {
    schema: 1,
    rulesVersion,
    appRevision,
    exportedAt: new Date().toISOString(),
    candidates: [...candidates.values()].sort((a, b) => b.count - a.count),
  }
}

export async function clearTranslationCandidates() {
  await loadTranslationCandidates()
  candidates.clear()
  outsideSeen.clear()
  updateCounts()
  await flushTranslationCandidates()
}
