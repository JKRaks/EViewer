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
import type {
  userConfigInput,
  userConfigProfileInput,
  userConfigUpdateInput,
} from '../model/auth/userConfigInput'
import {
  userConfigCategoryDefinitions,
  userConfigData,
  userConfigExcludedLanguageData,
  userConfigLanguageDefinitions,
  userConfigOutput,
  userConfigProfileData,
} from '../model/auth/userConfigOutput'

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

  /**
   * 获取当前用户及当前 Profile 的原站配置。
   * @param param 用户配置页 GET 请求参数
   * @returns 完整的 Profile 与配置快照
   */
  async getUserConfig(param: userConfigInput): Promise<userConfigOutput> {
    const result = new userConfigOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg || '用户配置获取失败'
      return result
    }

    return this.parseUserConfigResult(htmlResult.data)
  }

  /**
   * 校验并提交当前 Profile 的完整配置快照。
   * @param param 包含编辑后完整配置的 POST 请求参数
   * @returns 服务端保存后重新解析的配置快照
   */
  async updateUserConfig(param: userConfigUpdateInput): Promise<userConfigOutput> {
    const result = new userConfigOutput()
    try {
      this.validateUserConfig(param.data)
      param.requestData = this.buildUserConfigForm(param.data)
    } catch (error) {
      result.msg = error instanceof Error ? error.message : '用户配置校验失败'
      return result
    }

    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg || '用户配置保存失败'
      return result
    }

    const parsedResult = this.parseUserConfigResult(htmlResult.data)
    if (
      parsedResult.isSuccess &&
      !/Settings were updated/i.test(parserClass.loadBody(htmlResult.data).text)
    ) {
      parsedResult.isSuccess = false
      parsedResult.msg = '原站未确认配置已保存'
    }
    return parsedResult
  }

  /**
   * 切换、重命名、创建、设为默认或删除原站 Profile。
   * @param param Profile 操作及目标槽位
   * @returns 操作后重新解析的完整配置快照
   */
  async updateUserConfigProfile(param: userConfigProfileInput): Promise<userConfigOutput> {
    const result = new userConfigOutput()
    if (!param.profileSlot || (param.profileAction === 'rename' && !param.profileName.trim())) {
      result.msg = 'Profile 参数不完整'
      return result
    }
    if (param.profileAction === 'create' && !param.profileName.trim()) {
      result.msg = '请输入新 Profile 名称'
      return result
    }

    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg || 'Profile 操作失败'
      return result
    }
    return this.parseUserConfigResult(htmlResult.data)
  }

  private parseUserConfigResult(html: string): userConfigOutput {
    const result = new userConfigOutput()
    try {
      const bodyParser = parserClass.loadBody(html)
      const forms = bodyParser.getElementsBySelector('form')
      const profileForm = forms.find(
        (form) => !form.getElementBySelector('select[name="profile_set"]').invalid,
      )
      const settingsForm = forms.find(
        (form) => !form.getElementBySelector('input[name="apply"]').invalid,
      )
      if (!profileForm || !settingsForm) {
        result.msg = '用户配置页面解析失败，请确认认证信息仍然有效'
        return result
      }

      const data = new userConfigData()
      const profileSelect = profileForm.getElementBySelector('select[name="profile_set"]')
      for (const option of profileSelect.getElementsBySelector('option')) {
        const profile = new userConfigProfileData()
        profile.slot = option.attribute('value')
        profile.displayName = option.text
        profile.isDefault = /\s*\(Default\)\s*$/i.test(profile.displayName)
        profile.name = profile.displayName.replace(/\s*\(Default\)\s*$/i, '').trim()
        profile.selected = option.hasAttribute('selected')
        data.profiles.push(profile)
      }
      const selectedProfile = data.profiles.find((profile) => profile.selected) ?? data.profiles[0]
      data.selectedProfileSlot = selectedProfile?.slot ?? ''
      data.profileCapabilities.canRename = !bodyParser.getElementBySelector(
        'input[onclick*="do_profile_rename"]',
      ).invalid
      data.profileCapabilities.canCreate = !bodyParser.getElementBySelector(
        'input[onclick*="do_profile_create"]',
      ).invalid
      data.profileCapabilities.canDelete = !bodyParser.getElementBySelector(
        'input[onclick*="do_profile_delete"]',
      ).invalid
      data.profileCapabilities.canSetDefault = !bodyParser.getElementBySelector(
        'input[onclick*="do_profile_set_default"]',
      ).invalid

      const radioValue = (name: string, fallback: string): string => {
        const checked = settingsForm.getElementBySelector(`input[name="${name}"][checked]`)
        return checked.invalid ? fallback : checked.attribute('value')
      }
      const fieldValue = (name: string, fallback: string = ''): string => {
        const field = settingsForm.getElementBySelector(`[name="${name}"]`)
        if (field.invalid) return fallback
        const selectedOption = field.getElementBySelector('option[selected]')
        if (!selectedOption.invalid) return selectedOption.attribute('value')
        if (field.hasAttribute('value')) return field.attribute('value')
        return field.text
      }
      const isChecked = (name: string): boolean =>
        !settingsForm.getElementBySelector(`input[name="${name}"][checked]`).invalid

      data.imageLoad.hathMode = radioValue('uh', '0')
      data.imageLoad.region = fieldValue('co')
      data.imageSize.resolution = radioValue('xr', '0')
      data.imageSize.originalMode = radioValue('oi', '0')
      data.imageSize.maxWidth = fieldValue('rx', '0')
      data.imageSize.maxHeight = fieldValue('ry', '0')
      data.gallery.titleMode = radioValue('tl', '0')
      data.gallery.archiverMode = radioValue('ar', '0')
      data.gallery.commentSort = radioValue('cs', '0')
      data.gallery.commentVotes = radioValue('sc', '0')
      data.gallery.tagSort = radioValue('tb', '0')
      data.gallery.thumbnailLabel = radioValue('pn', '0')
      data.search.displayMode = radioValue('dm', '2')
      data.search.rangeIndicator = radioValue('pp', '0')
      data.search.thumbnailSelectorEnabled = isChecked('xn_0')
      data.search.resultCount = radioValue('rc', '0')
      for (const definition of userConfigCategoryDefinitions) {
        data.search.categories[definition.key] = fieldValue(definition.field, '0') === '0'
      }
      data.favorites.names = Array.from({ length: 10 }, (_, index) =>
        fieldValue(`favorite_${index}`, `Favorites ${index}`),
      )
      data.favorites.sortMode = radioValue('fs', '0')
      data.thumbnails.loadMode = radioValue('lt', '0')
      data.thumbnails.sizeMode = radioValue('ts', '0')
      data.thumbnails.rows = radioValue('tr', '0')
      data.thumbnails.coverScale = fieldValue('tp')
      data.filters.ratingColors = fieldValue('ru').toUpperCase()
      data.filters.watchedThreshold = fieldValue('wt', '0')
      data.filters.filteringThreshold = fieldValue('ft', '0')
      data.filters.showFilteredCount = radioValue('tf', '0')
      data.filters.excludedUploaders = fieldValue('xu')
      const exclusionMatch = settingsForm.text.match(
        /currently using\s+(\d+)\s+of\s+(\d+)\s+exclusion slots/i,
      )
      data.filters.usedUploaderExclusions = Number(exclusionMatch?.[1] ?? 0)
      data.filters.maxUploaderExclusions = Number(exclusionMatch?.[2] ?? 0)
      data.filters.excludedLanguages = userConfigLanguageDefinitions.map((definition) => {
        const language = new userConfigExcludedLanguageData()
        language.key = definition.key
        language.sourceName = definition.sourceName
        language.base = definition.base
        language.originalAvailable = definition.originalAvailable
        language.original = definition.originalAvailable && isChecked(`xl_${definition.base}`)
        language.translated = isChecked(`xl_${definition.base + 1024}`)
        language.rewrite = isChecked(`xl_${definition.base + 2048}`)
        return language
      })
      data.appearance.viewportOverride = fieldValue('vp')

      const optionFields = [
        'uh',
        'co',
        'xr',
        'oi',
        'tl',
        'ar',
        'dm',
        'pp',
        'fs',
        'rc',
        'lt',
        'ts',
        'tr',
        'tf',
        'cs',
        'sc',
        'tb',
        'pn',
      ]
      for (const name of optionFields) {
        const disabledValues = settingsForm
          .getElementsBySelector(
            `[name="${name}"][disabled], select[name="${name}"] option[disabled]`,
          )
          .map((option) => option.attribute('value'))
          .filter(Boolean)
        if (disabledValues.length) data.disabledOptions[name] = disabledValues
      }

      result.data = data
      result.isSuccess = true
    } catch (error) {
      console.error('解析用户配置失败:', error)
      result.msg = error instanceof Error ? error.message : '用户配置页面解析失败'
    }
    return result
  }

  private validateUserConfig(data: userConfigData): void {
    const requireInteger = (value: string, label: string, min: number, max?: number) => {
      if (!/^-?\d+$/.test(value)) throw new Error(`${label}必须为整数`)
      const numberValue = Number(value)
      if (numberValue < min || (max !== undefined && numberValue > max)) {
        throw new Error(`${label}超出允许范围`)
      }
    }
    const allowedValues: Record<string, [string, readonly string[]]> = {
      uh: [data.imageLoad.hathMode, ['0', '1', '2', '3']],
      co: [data.imageLoad.region, ['', 'NL', 'US', 'BR', 'JP', 'AU', 'CN']],
      xr: [data.imageSize.resolution, ['0', '1', '3', '4', '5']],
      oi: [data.imageSize.originalMode, ['0', '1']],
      tl: [data.gallery.titleMode, ['0', '1']],
      ar: [data.gallery.archiverMode, ['0', '1', '2', '3', '4', '5']],
      dm: [data.search.displayMode, ['0', '1', '2', '3', '4']],
      pp: [data.search.rangeIndicator, ['0', '1']],
      fs: [data.favorites.sortMode, ['0', '1']],
      rc: [data.search.resultCount, ['0', '1', '2']],
      lt: [data.thumbnails.loadMode, ['0', '1']],
      ts: [data.thumbnails.sizeMode, ['0', '1', '2']],
      tr: [data.thumbnails.rows, ['0', '1', '2', '3']],
      tf: [data.filters.showFilteredCount, ['0', '1']],
      cs: [data.gallery.commentSort, ['0', '1', '2']],
      sc: [data.gallery.commentVotes, ['0', '1']],
      tb: [data.gallery.tagSort, ['0', '1']],
      pn: [data.gallery.thumbnailLabel, ['0', '1', '2']],
    }
    for (const [field, [value, allowed]] of Object.entries(allowedValues)) {
      if (!allowed.includes(value)) throw new Error(`配置项 ${field} 的值无效`)
      if (data.disabledOptions[field]?.includes(value)) {
        throw new Error(`配置项 ${field} 当前账户尚未解锁`)
      }
    }

    requireInteger(data.imageSize.maxWidth, '图片最大宽度', 0)
    requireInteger(data.imageSize.maxHeight, '图片最大高度', 0)
    if (data.favorites.names.some((name) => name.length > 20)) {
      throw new Error('收藏分类名称不能超过 20 个字符')
    }
    if (data.thumbnails.coverScale) {
      requireInteger(data.thumbnails.coverScale, '封面缩放比例', 75, 150)
    }
    if (data.filters.ratingColors && !/^[RGBY]{5}$/i.test(data.filters.ratingColors)) {
      throw new Error('评分颜色必须由 5 个 R、G、B 或 Y 字母组成')
    }
    requireInteger(data.filters.watchedThreshold, '关注标签阈值', 0, 9999)
    requireInteger(data.filters.filteringThreshold, '过滤标签阈值', -9999, 0)
    if (data.appearance.viewportOverride) {
      requireInteger(data.appearance.viewportOverride, '移动端虚拟宽度', 0, 9999)
    }
    const uploaderCount = data.filters.excludedUploaders
      .split(/\r?\n/)
      .filter((name) => name.trim()).length
    if (
      data.filters.maxUploaderExclusions > 0 &&
      uploaderCount > data.filters.maxUploaderExclusions
    ) {
      throw new Error(`排除上传者不能超过 ${data.filters.maxUploaderExclusions} 个`)
    }
  }

  private buildUserConfigForm(data: userConfigData): Record<string, unknown> {
    const form: Record<string, unknown> = {
      uh: data.imageLoad.hathMode,
      co: data.imageLoad.region,
      xr: data.imageSize.resolution,
      oi: data.imageSize.originalMode,
      rx: data.imageSize.maxWidth,
      ry: data.imageSize.maxHeight,
      tl: data.gallery.titleMode,
      ar: data.gallery.archiverMode,
      dm: data.search.displayMode,
      pp: data.search.rangeIndicator,
      fs: data.favorites.sortMode,
      rc: data.search.resultCount,
      lt: data.thumbnails.loadMode,
      ts: data.thumbnails.sizeMode,
      tr: data.thumbnails.rows,
      tp: data.thumbnails.coverScale,
      ru: data.filters.ratingColors.toUpperCase(),
      wt: data.filters.watchedThreshold,
      ft: data.filters.filteringThreshold,
      tf: data.filters.showFilteredCount,
      xu: data.filters.excludedUploaders,
      vp: data.appearance.viewportOverride,
      cs: data.gallery.commentSort,
      sc: data.gallery.commentVotes,
      tb: data.gallery.tagSort,
      pn: data.gallery.thumbnailLabel,
      apply: 'Apply',
    }
    for (const definition of userConfigCategoryDefinitions) {
      form[definition.field] = data.search.categories[definition.key] ? '0' : '1'
    }
    data.favorites.names.forEach((name, index) => {
      form[`favorite_${index}`] = name
    })
    if (data.search.thumbnailSelectorEnabled) form.xn_0 = 'on'
    for (const language of data.filters.excludedLanguages) {
      if (language.originalAvailable && language.original) form[`xl_${language.base}`] = 'on'
      if (language.translated) form[`xl_${language.base + 1024}`] = 'on'
      if (language.rewrite) form[`xl_${language.base + 2048}`] = 'on'
    }
    return form
  }
}
