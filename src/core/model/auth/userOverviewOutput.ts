import { P } from '../P'

export class userOverviewOutput extends P<userOverviewData> {}

export class userOverviewData {
  /**
   * 图片下载限制
   */
  imageLimit: userOverviewImageLimit = new userOverviewImageLimit()
  /**
   * 获得的GP
   */
  gpGained: userOverviewGPGained = new userOverviewGPGained()

  /**
   * 版务权限
   */
  moderationPower: userOverviewModerationPower = new userOverviewModerationPower()
}

export class userOverviewImageLimit {
  /**
   * 当前已使用的图片数量
   */
  usage: number = 0
  /**
   * 可下载的图片数量上限
   */
  limit: number = 0
}

export class userOverviewGPGained {
  /**
   * 画廊访问
   */
  galleryVisits: number = 0
  /**
   * 种子下载
   */
  torrentCompletions: number = 0
  /**
   * 存档下载
   */
  archiveDownloads: number = 0
  /**
   * 来自Hentai@Home
   */
  hentaiHome: number = 0
}

export class userOverviewModerationPower {
  /**
   * 当前MP capped to 25
   */
  currentMp: number = 0
  /**
   * 基础值
   */
  base: number = 0
  /**
   * 奖励值
   */
  awards: number = 0
  /**
   * 标签维护
   */
  tagging: number = 0
  /**
   * 等级权限
   */
  level: number = 0
  /**
   * 论坛活跃度
   */
  forumActivity: number = 0
  /**
   * 捐赠
   */
  donations: number = 0
  /**
   * Hentai@Home上传
   */
  uploadHH: number = 0
  /**
   * 账户年限
   */
  accountAge: number = 0
}
