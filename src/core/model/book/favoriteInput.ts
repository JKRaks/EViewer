import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export type favoriteCategoryValue = 'all' | `${number}`
export type favoriteSortMode = 'published' | 'favorited'
export type favoriteAction = 'delete' | `fav${number}`

/** 收藏页读取参数 */
export class favoriteListInput extends R {
  @jsonClass.property('favcat')
  category: favoriteCategoryValue = 'all'

  @jsonClass.property('f_search')
  keyword: string | undefined = undefined

  @jsonClass.property('next')
  pageNext: string | undefined = undefined

  @jsonClass.property('prev')
  pagePrevious: string | undefined = undefined

  @jsonClass.property('inline_set')
  readonly displayMode: string = 'dm_e'

  url(): string {
    return '/favorites.php'
  }
}

/** 原站收藏排序切换参数 */
export class favoriteSortInput extends R {
  @jsonClass.property('inline_set')
  inlineSet: string

  constructor(sortMode: favoriteSortMode) {
    super()
    this.inlineSet = sortMode === 'favorited' ? 'fs_f' : 'fs_p'
  }

  url(): string {
    return '/favorites.php'
  }
}

/** 收藏批量移动或删除参数 */
export class favoriteActionInput extends R {
  constructor(
    public action: favoriteAction,
    public galleryIds: string[],
  ) {
    super()
  }

  url(): string {
    return '/favorites.php'
  }

  getMethod(): 'POST' {
    return 'POST'
  }

  getRequestData(): Record<string, unknown> {
    return {
      ddact: this.action,
      'modifygids[]': this.galleryIds,
    }
  }
}

/** 单个画册收藏弹窗读取参数。 */
export class galleryFavoriteInput extends R {
  constructor(public bookId: string) {
    super()
  }

  url(): string {
    const [galleryId, token] = normalizeFavoriteBookId(this.bookId)
    return `/gallerypopups.php?gid=${encodeURIComponent(galleryId)}&t=${encodeURIComponent(token)}&act=addfav`
  }
}

/** 单个画册收藏新增、移动或取消参数。 */
export class galleryFavoriteUpdateInput extends galleryFavoriteInput {
  constructor(
    bookId: string,
    public categoryValue: string,
    public note: string,
    public applyValue: string,
  ) {
    super(bookId)
  }

  getMethod(): 'POST' {
    return 'POST'
  }

  getRequestData(): Record<string, unknown> {
    return {
      favcat: this.categoryValue,
      favnote: this.note,
      apply: this.applyValue,
    }
  }
}

function normalizeFavoriteBookId(bookId: string): [string, string] {
  const [galleryId = '', token = ''] = bookId.trim().replace('-', '/').split('/')
  return [galleryId, token]
}
