import { P } from '../P'

export class userDonationOutput extends P<userDonationData> {}

export class userDonationData {
  /**
   * 未消耗
   */
  unspent: string = ''
  /**
   * 总共历年捐款
   */
  totalDonated: string = ''

  /**
   * 总认领服务器天数
   */
  totalAdoptServerDay: number = 0

  /**
   * 捐赠等级
   */
  donationLevel: number = 0
}
