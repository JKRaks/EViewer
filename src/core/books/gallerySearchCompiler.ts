import { categoryEnum } from '@/core/common/enum/categoryEnum'
import { bookInput } from '@/core/model/book/bookInput'
import {
  createGallerySearchCriteria,
  type gallerySearchCriteria,
  type selectedGalleryTag,
} from '@/core/model/book/gallerySearchCriteria'

const maxQueryLength = 200
const maxIncludeTerms = 5
const maxExcludeTerms = 10

export class gallerySearchValidationError extends Error {
  constructor(public messages: string[]) {
    super(messages.join('\n'))
  }
}

/** 将界面搜索条件编译为源站参数，并在发起请求前校验源站限制。 */
export function compileGallerySearch(criteria: gallerySearchCriteria): bookInput {
  const errors: string[] = []
  const includeTags = deduplicateTags(criteria.includeTags)
  const excludeTags = deduplicateTags(criteria.excludeTags).filter(
    (tag) => !includeTags.some((included) => tagKey(included) === tagKey(tag)),
  )
  const titles = criteria.titleTerms.map((value) => value.trim()).filter(Boolean)

  if (includeTags.length + titles.length > maxIncludeTerms) {
    errors.push(`标题和包含标签合计最多 ${maxIncludeTerms} 项`)
  }
  if (excludeTags.length > maxExcludeTerms) {
    errors.push(`排除标签最多 ${maxExcludeTerms} 项`)
  }
  if (criteria.minPages !== undefined && criteria.minPages < 0) {
    errors.push('最少页数不能小于 0')
  }
  if (criteria.maxPages !== undefined && criteria.maxPages < 0) {
    errors.push('最多页数不能小于 0')
  }
  if (
    criteria.minPages !== undefined &&
    criteria.maxPages !== undefined &&
    criteria.minPages > criteria.maxPages
  ) {
    errors.push('最少页数不能大于最多页数')
  }

  const queryParts = [criteria.freeText.trim()]
  titles.forEach((value) => queryParts.push(`title:${quoteSearchValue(value)}`))
  if (criteria.uploader.trim()) {
    queryParts.push(`uploader:${quoteSearchValue(criteria.uploader)}`)
  }
  if (criteria.uploaderUid.trim()) {
    if (!/^\d+$/.test(criteria.uploaderUid.trim())) errors.push('上传者 UID 只能包含数字')
    queryParts.push(`uploaduid:${criteria.uploaderUid.trim()}`)
  }
  includeTags.forEach((tag) => {
    const prefix = criteria.tagMode === 'any' ? '~' : ''
    queryParts.push(`${prefix}${tag.namespace}:${quoteSearchValue(tag.master)}$`)
  })
  excludeTags.forEach((tag) => {
    queryParts.push(`-${tag.namespace}:${quoteSearchValue(tag.master)}$`)
  })

  const query = queryParts.filter(Boolean).join(' ')
  if (query.length > maxQueryLength) {
    errors.push(`搜索表达式为 ${query.length} 个字符，源站上限为 ${maxQueryLength}`)
  }
  if (errors.length) throw new gallerySearchValidationError(errors)

  const input = new bookInput()
  input.keyword = query || undefined
  input.category = (
    criteria.categories.length
      ? criteria.categories.reduce<number>((mask, category) => mask | category, 0)
      : categoryEnum.All
  ) as categoryEnum
  input.minRating = criteria.minRating
  input.minRatingEnabled = criteria.minRating === undefined ? undefined : 'on'
  input.minPages = criteria.minPages
  input.maxPages = criteria.maxPages
  input.pageRangeEnabled =
    criteria.minPages === undefined && criteria.maxPages === undefined ? undefined : 'on'
  input.requireTorrent = criteria.requireTorrent ? 'on' : undefined
  input.showHide = criteria.browseExpunged ? 'on' : undefined
  input.disableLanguageFilter = criteria.disableCustomFilters.language ? 'on' : undefined
  input.disableUploaderFilter = criteria.disableCustomFilters.uploader ? 'on' : undefined
  input.disableTagFilter = criteria.disableCustomFilters.tags ? 'on' : undefined
  return input
}

export function cloneBookInput(source: bookInput): bookInput {
  return Object.assign(new bookInput(), source)
}

export function serializeGallerySearchCriteria(criteria: gallerySearchCriteria): string {
  return JSON.stringify(criteria)
}

export function deserializeGallerySearchCriteria(
  value: unknown,
  legacyKeyword?: unknown,
  uploader?: unknown,
): gallerySearchCriteria {
  const serialized = Array.isArray(value) ? value[0] : value
  if (typeof serialized === 'string' && serialized) {
    try {
      const parsed = JSON.parse(serialized) as Partial<gallerySearchCriteria>
      return createGallerySearchCriteria(parsed)
    } catch {
      // 兼容旧链接，解析失败时退回 keyword/uploader。
    }
  }
  const keywordValue = Array.isArray(legacyKeyword) ? legacyKeyword[0] : legacyKeyword
  const uploaderValue = Array.isArray(uploader) ? uploader[0] : uploader
  return createGallerySearchCriteria({
    freeText: typeof keywordValue === 'string' ? keywordValue : '',
    uploader: typeof uploaderValue === 'string' ? uploaderValue : '',
  })
}

function quoteSearchValue(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
  return `"${sanitized}"`
}

function deduplicateTags(tags: selectedGalleryTag[]) {
  return [...new Map(tags.map((tag) => [tagKey(tag), tag])).values()]
}

function tagKey(tag: Pick<selectedGalleryTag, 'namespace' | 'master'>) {
  return `${tag.namespace.trim().toLowerCase()}\u0000${tag.master.trim().toLowerCase()}`
}
