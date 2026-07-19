import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import type { userDonationInput } from '../model/auth/userDonationInput'
import { userDonationData, userDonationOutput } from '../model/auth/userDonationOutput'
import type { userHathPerksInput } from '../model/auth/userHathPerksInput'
import {
  userHathPerkData,
  userHathPerksData,
  userHathPerksOutput,
} from '../model/auth/userHathPerksOutput'
import type { userOverviewInput } from '../model/auth/userOverviewInput'
import { userOverviewData, userOverviewOutput } from '../model/auth/userOverviewOutput'

export class userInfoBusi {
  /**
   * 获取用户基础信息
   * @param param
   * @returns
   */
  async getUserOverview(param: userOverviewInput): Promise<userOverviewOutput> {
    const result: userOverviewOutput = new userOverviewOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      const userInfoElement = bodyParser.getElementBySelector(['div.stuffbox'])
      if (userInfoElement.invalid) {
        result.isSuccess = false
        result.msg = '解析失败'
        return result
      }
      result.data = new userOverviewData()

      const limitElement = userInfoElement.getElementBySelector('div.homebox:nth-of-type(1)')
      result.data.imageLimit.usage = Number.parseFloat(
        limitElement.getElementBySelector('strong:nth-child(1)').text,
      )
      result.data.imageLimit.limit = Number.parseFloat(
        limitElement.getElementBySelector('strong:nth-child(2)').text.replace(',', ''),
      )

      const gpElement = userInfoElement.getElementBySelector('div.homebox:nth-of-type(3)')
      result.data.gpGained.galleryVisits = Number.parseFloat(
        gpElement.getElementBySelector(['tr:nth-child(1)', 'td:nth-child(1)']).text,
      )
      result.data.gpGained.torrentCompletions = Number.parseFloat(
        gpElement.getElementBySelector(['tr:nth-child(2)', 'td:nth-child(1)']).text,
      )
      result.data.gpGained.archiveDownloads = Number.parseFloat(
        gpElement.getElementBySelector(['tr:nth-child(3)', 'td:nth-child(1)']).text,
      )
      result.data.gpGained.hentaiHome = Number.parseFloat(
        gpElement.getElementBySelector(['tr:nth-child(4)', 'td:nth-child(1)']).text,
      )

      const moderationElement = userInfoElement.getElementBySelector([
        'div.homebox:nth-of-type(5)',
        'tr',
      ])
      result.data.moderationPower.currentMp = Number.parseFloat(
        moderationElement.getElementBySelector(['td:nth-child(1)', 'div:nth-child(2)']).text,
      )
      const mpBaseElement = moderationElement.getElementBySelector(['td:nth-child(2)'])
      result.data.moderationPower.base = Number.parseFloat(
        mpBaseElement.getElementBySelector([
          'td:nth-child(2)',
          'tr:nth-child(1)',
          'td:nth-child(2)',
        ]).text,
      )
      result.data.moderationPower.awards = Number.parseFloat(
        mpBaseElement.getElementBySelector([
          'td:nth-child(2)',
          'tr:nth-child(2)',
          'td:nth-child(2)',
        ]).text,
      )
      result.data.moderationPower.tagging = Number.parseFloat(
        mpBaseElement.getElementBySelector([
          'td:nth-child(2)',
          'tr:nth-child(3)',
          'td:nth-child(2)',
        ]).text,
      )
      const mpExtElement = moderationElement.getElementBySelector(['td:nth-child(3)'])
      result.data.moderationPower.level = Number.parseFloat(
        mpExtElement.getElementBySelector(['tr:nth-child(1)', 'td:nth-child(2)']).text,
      )
      result.data.moderationPower.forumActivity = Number.parseFloat(
        mpExtElement.getElementBySelector(['tr:nth-child(2)', 'td:nth-child(2)']).text,
      )
      result.data.moderationPower.donations = Number.parseFloat(
        mpExtElement.getElementBySelector(['tr:nth-child(3)', 'td:nth-child(2)']).text,
      )
      result.data.moderationPower.uploadHH = Number.parseFloat(
        mpExtElement.getElementBySelector(['tr:nth-child(4)', 'td:nth-child(2)']).text,
      )
      result.data.moderationPower.accountAge = Number.parseFloat(
        mpExtElement.getElementBySelector(['tr:nth-child(5)', 'td:nth-child(2)']).text,
      )

      result.isSuccess = true
    }

    return result
  }

  /**
   * 获取捐赠信息
   * @param param
   * @returns
   */
  async getUserDonation(param: userDonationInput): Promise<userDonationOutput> {
    const result: userDonationOutput = new userDonationOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      const donationElement = bodyParser.getElementBySelector(['div.stuffbox'])
      if (donationElement.invalid) {
        result.isSuccess = false
        result.msg = '解析失败'
        return result
      }
      result.data = new userDonationData()

      const cashElement = donationElement.getElementBySelector('div#bal')
      result.data.unspent = cashElement.getElementBySelector(['div:nth-child(1)', 'strong']).text
      result.data.totalDonated = cashElement.getElementBySelector([
        'div:nth-child(2)',
        'strong',
      ]).text
      result.data.totalAdoptServerDay = Number(
        cashElement.getElementBySelector(['div:nth-child(3)', 'strong']).text,
      )
      const levelElement = donationElement.getElementsBySelector(['table#tdon', 'tr'])
      levelElement.findIndex((element, index) => {
        if (element.attribute('id') == 'dlvl') {
          result.data!.donationLevel = index - 1
        }
      })
      result.isSuccess = true
    }

    return result
  }
  /**
   * 获取用户道具
   * @param param
   * @returns
   */
  async getUserHathPerks(param: userHathPerksInput): Promise<userHathPerksOutput> {
    const result = new userHathPerksOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg
      return result
    }

    const normalizeText = (value: string | null | undefined): string =>
      value?.replace(/\s+/g, ' ').trim() ?? ''
    const bodyParser = parserClass.loadBody(htmlResult.data)
    const hathPerksElement = bodyParser.getElementBySelector('div.stuffbox')
    const balanceElement = hathPerksElement.getElementBySelector([
      'div:first-of-type',
      'p:last-child',
      'span',
    ])
    const tableElement = hathPerksElement.getElementBySelector('table')
    const balance = Number.parseInt(balanceElement.text.replace(/,/g, ''), 10)

    if (
      hathPerksElement.invalid ||
      balanceElement.invalid ||
      tableElement.invalid ||
      !Number.isFinite(balance)
    ) {
      result.msg = '解析失败'
      return result
    }

    const data = new userHathPerksData()
    data.balance = balance

    for (const row of tableElement.getElementsBySelector(['tbody', 'tr'])) {
      const cells = row.getElementsBySelector('td')
      if (cells.length !== 3) continue

      const [nameElement, descriptionCell, statusCell] = cells
      if (!nameElement || !descriptionCell || !statusCell) continue

      const name = normalizeText(nameElement.text)
      const costMatch = statusCell.text.match(/([\d,]+)\s+Hath/i)
      if (!name || !costMatch?.[1]) continue

      const perk = new userHathPerkData()
      const paddingLeft = Number.parseFloat(
        nameElement.attribute('style').match(/padding-left\s*:\s*([\d.]+)px/i)?.[1] ?? '0',
      )
      let description = descriptionCell.text
      const donationElements = descriptionCell
        .getElementsBySelector('span')
        .filter((element) => /donation/i.test(element.text))
      for (const donationElement of donationElements) {
        description = description.replace(donationElement.text, '')
      }
      perk.description = normalizeText(description)
      perk.donationRequirement = normalizeText(
        donationElements.map((element) => element.text).join(' '),
      )

      const purchaseElement = statusCell.getElementBySelector('input[name="purchase"]')
      perk.name = name
      perk.cost = Number.parseInt(costMatch[1].replace(/,/g, ''), 10)
      perk.obtained = /^Obtained$/i.test(statusCell.getElementBySelector('p').text)
      perk.purchasable = !purchaseElement.invalid && !purchaseElement.hasAttribute('disabled')
      perk.locked = /opacity\s*:/i.test(row.attribute('style'))
      perk.isSubPerk = paddingLeft > 5
      data.perks.push(perk)
    }

    if (data.perks.length === 0) {
      result.msg = '解析失败'
      return result
    }

    result.data = data
    result.isSuccess = true
    return result
  }
}
