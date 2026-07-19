import { R } from '../R'

/**
 * Hath 特权页面请求参数
 */
export class userHathPerksInput extends R {
  /**
   * Hath 特权页面地址
   */
  url(): string {
    return '/hathperks.php'
  }
}
