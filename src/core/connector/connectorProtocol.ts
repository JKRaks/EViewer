import { galleryOrigin } from './connectionSettings'
export const CONNECTOR_PROTOCOL = 1
export const CONNECTOR_CHANNEL = 'eviewer-browser-assistant'
export const MANIFEST_PATH = '/auth/bridge/assistant-manifest.json'
export const ASSISTANT_SETTINGS = '/settings#browser-assistant'
export type AssistantFlavor = 'tampermonkey' | 'userscripts'
export interface ConnectorIdentity {
  instance: string
  flavor: AssistantFlavor
  scriptVersion: string
  buildVersion: string
  protocolVersion: number
  origin: string
  manager: string
  managerVersion: string
  available: boolean
  capabilities: string[]
}
export interface AssistantRelease {
  version: string
  protocolVersion: number
  installPath: string
}
export interface AssistantManifest {
  schema: 1
  environment: 'production' | 'preview' | 'development'
  revision: string | null
  productionOrigin: string | null
  scripts: Record<AssistantFlavor, AssistantRelease>
}
export interface MultipartEntry {
  name: string
  value?: string
  base64?: string
  filename?: string
  type?: string
}
export interface ConnectorRequest {
  url: string
  method: 'GET' | 'POST'
  timeout?: number
  binary?: boolean
  contentType?: string
  body?: { kind: 'text'; text: string } | { kind: 'multipart'; entries: MultipartEntry[] }
}
export interface ConnectorResult {
  status: number
  finalUrl: string
  text: string
  base64: string
  mimeType: string
}

export function assistantPath(flavor: AssistantFlavor) {
  return `/auth/bridge/eviewer-assistant.${flavor}.user.js`
}

export function readAssistantManifest(value: unknown): AssistantManifest {
  const manifest = value as AssistantManifest
  if (
    manifest?.schema !== 1 ||
    !['production', 'preview', 'development'].includes(manifest.environment)
  )
    throw new Error('INVALID_MANIFEST')
  for (const flavor of ['tampermonkey', 'userscripts'] as const) {
    const release = manifest.scripts?.[flavor]
    if (
      !release ||
      !/^\d+\.\d+\.\d+(?:[-.][\w.]+)?$/.test(release.version) ||
      !Number.isInteger(release.protocolVersion) ||
      release.installPath !== assistantPath(flavor)
    )
      throw new Error('INVALID_MANIFEST')
  }
  if (manifest.productionOrigin) {
    const url = new URL(manifest.productionOrigin)
    if (url.protocol !== 'https:' || url.origin !== manifest.productionOrigin)
      throw new Error('INVALID_MANIFEST')
  }
  return manifest
}

/** Preserve existing query fields (gallerypopups) and repeated form fields. */
export function galleryTarget(path: string, query = '') {
  const origin = galleryOrigin(path)
  const target = new URL(path, origin)
  if (target.origin !== origin) throw new Error('TARGET_NOT_ALLOWED')
  for (const [name, value] of new URLSearchParams(query)) target.searchParams.append(name, value)
  if (target.pathname === '/image-lookup') {
    target.hostname = 'upload.e-hentai.org'
    target.pathname = '/image_lookup.php'
  }
  return target.href
}
