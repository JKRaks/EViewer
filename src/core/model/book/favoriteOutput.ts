import { P } from '../P'
import { bookItem } from './bookOutput'
import type { favoriteCategoryValue, favoriteSortMode } from './favoriteInput'

export class favoriteCategoryData {
  index: number = 0
  name: string = ''
  count: number = 0
}

export class favoriteBookItem extends bookItem {
  galleryId: string = ''
  favoriteCategoryName: string = ''
  favoritedAt: Date | undefined = undefined
}

export class favoriteOutput extends P<favoriteBookItem[]> {
  categories: favoriteCategoryData[] = []
  currentCategory: favoriteCategoryValue = 'all'
  sortMode: favoriteSortMode = 'published'
  nextPage: string | undefined = undefined
  previousPage: string | undefined = undefined
  totalCount: number = 0
  authenticationRequired: boolean = false
}

export type galleryFavoriteStatus = 'unknown' | 'none' | 'favorited'

export class galleryFavoriteStateData {
  status: galleryFavoriteStatus = 'unknown'
  selectedCategoryIndex: number | undefined = undefined
  note: string = ''
  applyValue: string = ''
  removeValue: string = ''
  categories: favoriteCategoryData[] = []
}

export class galleryFavoriteStateOutput extends P<galleryFavoriteStateData> {
  authenticationRequired: boolean = false
}
