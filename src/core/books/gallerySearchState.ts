import {
  createGallerySearchCriteria,
  type gallerySearchCriteria,
  type selectedGalleryTag,
} from '@/core/model/book/gallerySearchCriteria'
import type { tagItem } from '@/core/model/book/tag'
import { serializeGallerySearchCriteria } from './gallerySearchCompiler'

/** 标签入口与高级搜索共用结构化条件；译名仅用于展示，不参与源站查询。 */
export function createGalleryTagSearchRoute(
  namespace: string,
  tag: tagItem,
  displayName = tag.name,
) {
  const criteria = createGallerySearchCriteria({
    includeTags: [
      {
        namespace: namespace.trim().toLowerCase(),
        master: tag.name.trim(),
        displayName,
        source: tag.official ? 'official' : 'unofficial',
      },
    ],
  })
  return { name: 'booklist', query: { criteria: serializeGallerySearchCriteria(criteria) } }
}

export function galleryTagKey(tag: Pick<selectedGalleryTag, 'namespace' | 'master'>) {
  return `${tag.namespace.trim().toLowerCase()}\u0000${tag.master.trim().toLowerCase()}`
}

export function cloneGalleryCriteria(criteria: gallerySearchCriteria) {
  return createGallerySearchCriteria({
    ...criteria,
    includeTags: criteria.includeTags.map((tag) => ({ ...tag })),
    excludeTags: criteria.excludeTags.map((tag) => ({ ...tag })),
  })
}

export function selectGalleryTag(
  include: selectedGalleryTag[],
  exclude: selectedGalleryTag[],
  tag: selectedGalleryTag,
  mode: 'include' | 'exclude',
) {
  const key = galleryTagKey(tag)
  const own = mode === 'include' ? include : exclude
  const selected = own.some((item) => galleryTagKey(item) === key)
  const nextOwn = selected
    ? own.filter((item) => galleryTagKey(item) !== key)
    : [...own, { ...tag }]
  const nextOther = (mode === 'include' ? exclude : include).filter(
    (item) => galleryTagKey(item) !== key,
  )
  return mode === 'include'
    ? { includeTags: nextOwn, excludeTags: nextOther }
    : { includeTags: nextOther, excludeTags: nextOwn }
}
