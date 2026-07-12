import { P } from '../P'
import { tagCollection } from './tag'

export class bookOutput extends P<bookItem[]> {
  nxtPage: number | undefined = undefined
  prvPage: number | undefined = undefined
  totalCount: number | undefined = undefined
}
export class bookItem {
  /**
   * 画册地址
   */
  bookUrl: string = ''
  /**
   * 画册Id
   */
  bookId: string = ''
  /**
   * 画册标题
   */
  bookTitle: string = ''
  /**
   * 画册分类
   */
  category: string = ''
  /**
   * 发布时间
   */
  publishDate: Date | undefined = undefined
  /**
   * 缩略图
   */
  thumbnailUrl: string = ''
  /**
   * 标签列表
   */
  tags: tagCollection[] = []
  /**
   * 上传者
   */
  uploader: string = ''
  /**
   * 图片数量
   */
  imgCount: number = 0
  /**
   * 下载地址
   */
  downloadUrl: string = ''
  /**
   * 评分
   */
  rate: number = 0
}
