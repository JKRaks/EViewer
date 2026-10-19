import { categoryEnum } from '@/core/common/enum/categoryEnum'

export const gallerySearchCategories = [
  ['同人志', categoryEnum.Doujinshi],
  ['漫画', categoryEnum.Manga],
  ['艺术家 CG', categoryEnum.ArtistCG],
  ['游戏 CG', categoryEnum.GameCG],
  ['西方', categoryEnum.Western],
  ['非 H', categoryEnum.NonH],
  ['图像集', categoryEnum.ImageSet],
  ['Cosplay', categoryEnum.Cosplay],
  ['亚洲色情', categoryEnum.AsianPorn],
  ['杂项', categoryEnum.Misc],
] as const

export interface selectedGalleryTag {
  namespace: string
  master: string
  displayName: string
  source: 'official' | 'unofficial'
}

export interface gallerySearchCriteria {
  freeText: string
  titleTerms: string[]
  uploader: string
  uploaderUid: string
  includeTags: selectedGalleryTag[]
  excludeTags: selectedGalleryTag[]
  tagMode: 'all' | 'any'
  categories: categoryEnum[]
  minRating?: number
  minPages?: number
  maxPages?: number
  requireTorrent: boolean
  browseExpunged: boolean
  disableCustomFilters: {
    language: boolean
    uploader: boolean
    tags: boolean
  }
}

export function createGallerySearchCriteria(
  initial: Partial<gallerySearchCriteria> = {},
): gallerySearchCriteria {
  return {
    freeText: initial.freeText ?? '',
    titleTerms: [...(initial.titleTerms ?? [])],
    uploader: initial.uploader ?? '',
    uploaderUid: initial.uploaderUid ?? '',
    includeTags: [...(initial.includeTags ?? [])],
    excludeTags: [...(initial.excludeTags ?? [])],
    tagMode: initial.tagMode === 'any' ? 'any' : 'all',
    categories: [...(initial.categories ?? [])],
    minRating: initial.minRating,
    minPages: initial.minPages,
    maxPages: initial.maxPages,
    requireTorrent: initial.requireTorrent ?? false,
    browseExpunged: initial.browseExpunged ?? false,
    disableCustomFilters: {
      language: initial.disableCustomFilters?.language ?? false,
      uploader: initial.disableCustomFilters?.uploader ?? false,
      tags: initial.disableCustomFilters?.tags ?? false,
    },
  }
}
