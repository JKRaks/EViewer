import { P } from '../P'
import { tagCollection } from './tag'
import type { galleryFavoriteStatus } from './favoriteOutput'

export class bookInfoOutput extends P<string[]> {
  contentWarning?: string[]
  /**
   * 画册ID
   */
  bookId: string = ''
  /**
   * 画册封面图片链接
   */
  coverImage: string = ''
  /**
   * 图片数量
   */
  imageCount: number = 0
  /**
   * 画册名称
   */
  bookName: string = ''
  /**
   * 被收藏次数
   */
  favorited: number = 0
  /** 当前登录用户对该画册的收藏状态；不会写入公共详情缓存。 */
  personalFavoriteStatus: galleryFavoriteStatus = 'unknown'
  /** 当前登录用户选择的收藏分类。 */
  personalFavoriteCategoryIndex: number | undefined = undefined
  /**
   * 画册语言
   */
  language: string = ''
  /**
   * 画册大小
   */
  totalSize: string = ''
  /**
   * 画册发布日期
   */
  publishDate: Date | undefined = undefined
  /**
   * 画册评分
   */
  rating: string = ''
  /**
   * 评分人数
   */
  ratingCount: number = 0
  /**
   * 画册标签
   */
  tags: tagCollection[] = []
  /**
   * 画册是否可见
   */
  visible: string = ''
  /**
   * 当前页数
   */
  pageIndex: number = 0
  /**
   * * 最大页数
   */
  lastPageIndex: number = 0
  category: string = ''
  /**
   * 上传者
   */
  uploader: string = ''
  /**
   * 用户评论
   */
  userComments: userComment[] | undefined = undefined
}

export class userComment {
  username: string = ''
  comment: string = ''
  /** 源站评论正文 HTML；展示时必须经过白名单转换。 */
  contentHtml?: string
  date: Date | undefined = undefined
  score: number = 0
  isUploader: boolean = false
}
