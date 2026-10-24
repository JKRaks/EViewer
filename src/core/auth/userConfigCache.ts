import { userInfoBusi } from './userInfoBusi'
import { userConfigInput } from '../model/auth/userConfigInput'
import { userConfigOutput, type userConfigData } from '../model/auth/userConfigOutput'
import { connectionSettings } from '@/core/connector/connectionSettings'

const cachePrefix = 'eviewer:user-config-cache:v1:'
const cacheVersion = 1
const cacheTtlMs = 30 * 60 * 1000

export interface FavoriteCategoryOption {
  index: number
  name: string
}

interface UserConfigCacheRecord {
  version: number
  memberId: string
  selectedProfileSlot: string
  data?: userConfigData
  favoriteCategories: FavoriteCategoryOption[]
  updatedAt: number
}

export interface UserConfigCacheStatus {
  available: boolean
  memberId: string
  selectedProfileSlot?: string
  favoriteCategoryCount: number
  updatedAt?: number
}

const memoryCache = new Map<string, UserConfigCacheRecord>()
const pendingRequests = new Map<string, Promise<userConfigOutput>>()
let cacheGeneration = 0

export async function getUserConfigWithCache(
  memberId: string,
  forceRefresh = false,
): Promise<userConfigOutput> {
  const normalizedMemberId = memberId.trim()
  const cached = readCache(normalizedMemberId)
  if (!forceRefresh && cached?.data) {
    if (Date.now() - cached.updatedAt > cacheTtlMs) {
      void refreshUserConfigCache(normalizedMemberId).catch((error) => {
        console.warn('后台刷新用户配置缓存失败:', error)
      })
    }
    return createCachedOutput(cached.data)
  }

  const refreshed = await refreshUserConfigCache(normalizedMemberId)
  if (!refreshed.isSuccess && cached?.data) return createCachedOutput(cached.data)
  return refreshed
}

export async function getFavoriteCategoryOptionsCached(
  memberId: string,
): Promise<FavoriteCategoryOption[]> {
  const normalizedMemberId = memberId.trim()
  const cached = readCache(normalizedMemberId)
  if (cached?.favoriteCategories.length) {
    if (Date.now() - cached.updatedAt > cacheTtlMs) {
      void refreshUserConfigCache(normalizedMemberId).catch((error) => {
        console.warn('后台刷新收藏分类缓存失败:', error)
      })
    }
    return cloneCategories(cached.favoriteCategories)
  }

  const result = await getUserConfigWithCache(normalizedMemberId)
  if (!result.isSuccess || !result.data) {
    throw new Error(result.msg || '收藏分类获取失败')
  }
  return createFavoriteCategories(result.data)
}

export function updateUserConfigCache(memberId: string, data: userConfigData) {
  const normalizedMemberId = memberId.trim()
  if (!normalizedMemberId) return

  writeCache({
    version: cacheVersion,
    memberId: normalizedMemberId,
    selectedProfileSlot: data.selectedProfileSlot,
    data: cloneConfig(data),
    favoriteCategories: createFavoriteCategories(data),
    updatedAt: Date.now(),
  })
}

export function seedFavoriteCategoryCache(memberId: string, categories: FavoriteCategoryOption[]) {
  const normalizedMemberId = memberId.trim()
  const normalizedCategories = categories
    .filter((category) => Number.isInteger(category.index) && category.index >= 0)
    .map((category) => ({ index: category.index, name: category.name.trim() }))
    .filter((category) => category.name)
    .sort((left, right) => left.index - right.index)
  if (!normalizedMemberId || normalizedCategories.length === 0) return

  const current = readCache(normalizedMemberId)
  const currentData = current?.data ? cloneConfig(current.data) : undefined
  if (currentData) {
    for (const category of normalizedCategories) {
      if (category.index < currentData.favorites.names.length) {
        currentData.favorites.names[category.index] = category.name
      }
    }
  }
  writeCache({
    version: cacheVersion,
    memberId: normalizedMemberId,
    selectedProfileSlot: current?.selectedProfileSlot ?? '',
    data: currentData,
    favoriteCategories: normalizedCategories,
    updatedAt: Date.now(),
  })
}

export async function rebuildUserConfigCache(memberId: string): Promise<userConfigOutput> {
  return refreshUserConfigCache(memberId.trim())
}

export function getUserConfigCacheStatus(memberId: string): UserConfigCacheStatus {
  const normalizedMemberId = memberId.trim()
  const cached = readCache(normalizedMemberId)
  return {
    available: Boolean(cached?.data || cached?.favoriteCategories.length),
    memberId: normalizedMemberId,
    selectedProfileSlot: cached?.selectedProfileSlot || undefined,
    favoriteCategoryCount: cached?.favoriteCategories.length ?? 0,
    updatedAt: cached?.updatedAt,
  }
}

export function clearUserConfigCache(memberId?: string) {
  cacheGeneration += 1
  pendingRequests.clear()

  if (memberId?.trim()) {
    const normalizedMemberId = memberId.trim()
    memoryCache.delete(normalizedMemberId)
    try {
      localStorage.removeItem(`${cachePrefix}${normalizedMemberId}`)
    } catch (error) {
      console.warn('清除用户配置缓存失败:', error)
    }
    return
  }

  memoryCache.clear()
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(cachePrefix)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch (error) {
    console.warn('清除全部用户配置缓存失败:', error)
  }
}

async function refreshUserConfigCache(memberId: string): Promise<userConfigOutput> {
  if (!memberId) {
    if (connectionSettings.mode === 'local')
      return new userInfoBusi().getUserConfig(new userConfigInput())
    const result = new userConfigOutput()
    result.msg = '当前用户信息无效'
    return result
  }

  const pending = pendingRequests.get(memberId)
  if (pending) return pending

  const requestGeneration = cacheGeneration
  const request = new userInfoBusi()
    .getUserConfig(new userConfigInput())
    .then((result) => {
      if (result.isSuccess && result.data && requestGeneration === cacheGeneration) {
        updateUserConfigCache(memberId, result.data)
      }
      return result
    })
    .finally(() => {
      if (pendingRequests.get(memberId) === request) pendingRequests.delete(memberId)
    })
  pendingRequests.set(memberId, request)
  return request
}

function readCache(memberId: string): UserConfigCacheRecord | undefined {
  if (!memberId) return undefined
  const memoryRecord = memoryCache.get(memberId)
  if (memoryRecord) return memoryRecord

  try {
    const stored = localStorage.getItem(`${cachePrefix}${memberId}`)
    if (!stored) return undefined
    const parsed = JSON.parse(stored) as UserConfigCacheRecord
    if (parsed.version !== cacheVersion || parsed.memberId !== memberId) {
      localStorage.removeItem(`${cachePrefix}${memberId}`)
      return undefined
    }
    parsed.favoriteCategories = cloneCategories(parsed.favoriteCategories ?? [])
    memoryCache.set(memberId, parsed)
    return parsed
  } catch (error) {
    console.warn('读取用户配置缓存失败:', error)
    return undefined
  }
}

function writeCache(record: UserConfigCacheRecord) {
  const storedRecord: UserConfigCacheRecord = {
    ...record,
    data: record.data ? cloneConfig(record.data) : undefined,
    favoriteCategories: cloneCategories(record.favoriteCategories),
  }
  memoryCache.set(record.memberId, storedRecord)
  try {
    localStorage.setItem(`${cachePrefix}${record.memberId}`, JSON.stringify(storedRecord))
  } catch (error) {
    console.warn('保存用户配置缓存失败:', error)
  }
}

function createCachedOutput(data: userConfigData): userConfigOutput {
  const result = new userConfigOutput()
  result.data = cloneConfig(data)
  result.isSuccess = true
  result.msg = '已读取用户配置缓存'
  return result
}

function createFavoriteCategories(data: userConfigData): FavoriteCategoryOption[] {
  return data.favorites.names.map((name, index) => ({
    index,
    name: name.trim() || `Favorites ${index}`,
  }))
}

function cloneConfig(data: userConfigData): userConfigData {
  return JSON.parse(JSON.stringify(data)) as userConfigData
}

function cloneCategories(categories: FavoriteCategoryOption[]): FavoriteCategoryOption[] {
  return categories.map((category) => ({ ...category }))
}
