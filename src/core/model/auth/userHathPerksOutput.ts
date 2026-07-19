import { P } from '../P'

/**
 * Hath 特权页面请求结果
 */
export class userHathPerksOutput extends P<userHathPerksData> {}

/**
 * 用户的 Hath 余额及特权列表
 */
export class userHathPerksData {
  /** 当前可用的 Hath 数量 */
  balance: number = 0

  /** 页面中展示的 Hath 特权 */
  perks: userHathPerkData[] = []
}

/**
 * 单项 Hath 特权信息
 */
export class userHathPerkData {
  /** 特权名称 */
  name: string = ''

  /** 特权效果说明 */
  description: string = ''

  /** 免费解锁该特权所需的捐赠条件 */
  donationRequirement: string = ''

  /** 购买该特权所需的 Hath */
  cost: number = 0

  /** 当前账户是否已获得该特权 */
  obtained: boolean = false

  /** 当前账户是否可以直接购买该特权 */
  purchasable: boolean = false

  /** 是否因前置特权未满足而处于锁定状态 */
  locked: boolean = false

  /** 是否为上一项主特权的子特权 */
  isSubPerk: boolean = false
}
