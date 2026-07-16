import { P } from '../P'

export class galleryTorrentsOutput extends P<galleryTorrentItem[]> {
  /**
   * 画册名称
   */
  bookName: string = ''
}

export class galleryTorrentItem {
  /**
   * 画册种子ID
   */
  gtid: string = ''

  /**
   * 发布时间
   */
  posted: Date | undefined = undefined

  /**
   * 文件大小
   */
  size: string = ''

  /**
   * 种子文件做种数
   */
  seeds: number = 0

  /**
   * 种子文件种子数
   */
  peers: number = 0

  /**
   * 下载次数
   */
  downloads: number = 0

  /**
   * 上传者
   */
  uploader: string = ''

  /**
   * 种子文件名称
   */
  fileName: string = ''

  /**
   * 种子文件下载地址
   */
  downloadUrl: string = ''
}
