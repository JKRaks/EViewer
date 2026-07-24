import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { P } from '../model/P'
import {
  favoriteActionInput,
  favoriteListInput,
  favoriteSortInput,
  galleryFavoriteInput,
  galleryFavoriteUpdateInput,
} from '../model/book/favoriteInput'
import {
  favoriteBookItem,
  favoriteCategoryData,
  favoriteOutput,
  galleryFavoriteStateData,
  galleryFavoriteStateOutput,
} from '../model/book/favoriteOutput'
import { bookListBusi } from './bookListBusi'

export class favoriteBusi {
  /**
   * 获取并解析当前用户的收藏页。
   * @param param 分类、搜索和分页参数
   * @returns 收藏分类、画册列表和分页信息
   */
  async getFavoriteList(param: favoriteListInput): Promise<favoriteOutput> {
    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      const result = new favoriteOutput()
      result.msg = htmlResult.msg || '收藏夹获取失败'
      return result
    }
    return this.parseFavoritePage(htmlResult.data, param.category)
  }

  /**
   * 修改原站收藏列表的排序偏好。
   * @param param 发布时间或收藏时间排序
   * @returns 原站是否接受请求
   */
  async updateFavoriteSort(param: favoriteSortInput): Promise<P<void>> {
    const result = new P<void>()
    const htmlResult = await httpClass.sendRequest(param)
    result.isSuccess =
      htmlResult.isSuccess && Boolean(htmlResult.data) && this.isFavoritePage(htmlResult.data!)
    result.msg = htmlResult.isSuccess ? '收藏排序已更新' : htmlResult.msg || '收藏排序更新失败'
    if (!result.isSuccess && htmlResult.isSuccess) result.msg = '登录状态已失效，请重新维护认证信息'
    return result
  }

  /**
   * 批量移动或删除收藏画册。
   * @param param 操作类型及原站 gallery id 列表
   * @returns 原站是否接受请求
   */
  async updateFavorites(param: favoriteActionInput): Promise<P<void>> {
    const result = new P<void>()
    if (param.galleryIds.length === 0) {
      result.msg = '请先选择画册'
      return result
    }

    const htmlResult = await httpClass.sendRequest(param)
    result.isSuccess =
      htmlResult.isSuccess && Boolean(htmlResult.data) && this.isFavoritePage(htmlResult.data!)
    result.msg = htmlResult.isSuccess ? '收藏夹已更新' : htmlResult.msg || '收藏夹更新失败'
    if (!result.isSuccess && htmlResult.isSuccess) result.msg = '登录状态已失效，请重新维护认证信息'
    return result
  }

  /**
   * 获取单个画册的实时收藏状态和源站提交字段。
   * @param param 画册 gid/token
   * @returns 当前分类、备注、删除值及弹窗中的分类兜底数据
   */
  async getGalleryFavoriteState(param: galleryFavoriteInput): Promise<galleryFavoriteStateOutput> {
    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      const result = new galleryFavoriteStateOutput()
      result.msg = htmlResult.msg || '画册收藏状态获取失败'
      return result
    }
    return this.parseGalleryFavoritePopup(htmlResult.data)
  }

  /**
   * 新增、移动或取消单个画册收藏，并回读源站确认最终状态。
   * @param param 画册、目标分类以及弹窗原始备注/提交值
   * @returns 源站确认后的实时收藏状态
   */
  async updateGalleryFavorite(
    param: galleryFavoriteUpdateInput,
  ): Promise<galleryFavoriteStateOutput> {
    const htmlResult = await httpClass.sendRequest(param)
    if (!htmlResult.isSuccess || !htmlResult.data) {
      const result = new galleryFavoriteStateOutput()
      result.msg = htmlResult.msg || '画册收藏更新失败'
      return result
    }

    if (/This page requires you to log on/i.test(htmlResult.data)) {
      const result = new galleryFavoriteStateOutput()
      result.authenticationRequired = true
      result.msg = '登录状态已失效，请重新维护认证信息'
      return result
    }

    const verified = await this.getGalleryFavoriteState(new galleryFavoriteInput(param.bookId))
    if (!verified.isSuccess || !verified.data) return verified

    const expectedCategory = Number.parseInt(param.categoryValue, 10)
    const removing =
      param.categoryValue === verified.data.removeValue || !Number.isFinite(expectedCategory)
    const verifiedState = verified.data.status
    const matchesExpected = removing
      ? verifiedState === 'none'
      : verifiedState === 'favorited' && verified.data.selectedCategoryIndex === expectedCategory
    if (!matchesExpected) {
      verified.isSuccess = false
      verified.msg = '源站未确认收藏状态变更'
    }
    return verified
  }

  /**
   * 将收藏页 HTML 转换为页面所需的完整数据。
   * @param html 原站收藏页 HTML
   * @param requestedCategory 本次请求的分类
   * @returns 结构化收藏页数据
   */
  private parseFavoritePage(
    html: string,
    requestedCategory: favoriteListInput['category'],
  ): favoriteOutput {
    const result = new favoriteOutput()
    const bodyParser = parserClass.loadBody(html)
    const heading = bodyParser.getElementBySelector('h1').text
    if (!/^Favorites$/i.test(heading)) {
      result.authenticationRequired = true
      result.msg = '登录状态已失效，请重新维护认证信息'
      return result
    }

    const listParser = new bookListBusi()
    const rows = bodyParser.getElementsBySelector('table.itg.glte > tbody > tr')
    result.data = []
    for (const row of rows) {
      const baseItem = listParser.parseBookItem(row)
      if (!baseItem) continue

      const item = Object.assign(new favoriteBookItem(), baseItem)
      const galleryMatch = item.bookUrl.match(/\/g\/(\d+)\//)
      item.galleryId = galleryMatch?.[1] ?? ''
      const postedElement = row.getElementBySelector('div.gl3e > div[id^="posted_"]')
      item.favoriteCategoryName = postedElement.attribute('title')

      const paragraphs = row.getElementsBySelector('div.gl3e > div > p')
      const favoritedLabelIndex = paragraphs.findIndex((paragraph) =>
        /^Favorited:/i.test(paragraph.text),
      )
      const favoritedText = paragraphs[favoritedLabelIndex + 1]?.text ?? ''
      if (favoritedText) {
        const parsedDate = new Date(`${favoritedText.replace(' ', 'T')}:00`)
        if (!Number.isNaN(parsedDate.getTime())) item.favoritedAt = parsedDate
      }
      result.data.push(item)
    }

    result.categories = this.parseCategories(bodyParser)
    result.currentCategory = requestedCategory
    result.totalCount = result.categories.reduce((total, category) => total + category.count, 0)
    result.nextPage = this.getPageCursor(bodyParser, 'a#dnext', 'next')
    result.previousPage = this.getPageCursor(bodyParser, 'a#dprev, a#dlast', 'prev')
    const selectedSort = bodyParser
      .getElementBySelector('select[onchange*="inline_set=fs_"] option[selected]')
      .attribute('value')
    result.sortMode = selectedSort === 'f' ? 'favorited' : 'published'
    result.isSuccess = true
    result.msg = '收藏夹获取成功'
    return result
  }

  private parseCategories(bodyParser: parserClass): favoriteCategoryData[] {
    const categories: favoriteCategoryData[] = []
    for (const element of bodyParser.getElementsBySelector('div.fp')) {
      const categoryMatch = element.attribute('onclick').match(/favcat=(\d)/)
      if (!categoryMatch?.[1]) continue

      const index = Number(categoryMatch[1])
      const children = element.getElementsBySelector(':scope > div')
      const count = children
        .map((child) => Number.parseInt(child.text.replace(/,/g, ''), 10))
        .find((value) => Number.isFinite(value))
      const titledName = element.getElementBySelector('[title]').attribute('title')
      const visibleName = [...children]
        .reverse()
        .map((child) => child.text.trim())
        .find((text) => text && !/^\d[\d,]*$/.test(text))

      const category = new favoriteCategoryData()
      category.index = index
      category.name = titledName || visibleName || `Favorites ${index}`
      category.count = count ?? 0
      categories.push(category)
    }
    return categories.sort((left, right) => left.index - right.index)
  }

  private parseGalleryFavoritePopup(html: string): galleryFavoriteStateOutput {
    const result = new galleryFavoriteStateOutput()
    const bodyParser = parserClass.loadBody(html)
    const categoryInputs = bodyParser.getElementsBySelector('input[name="favcat"]')
    if (categoryInputs.length === 0) {
      result.authenticationRequired = /requires you to log on|ipb_login_form/i.test(html)
      result.msg = result.authenticationRequired
        ? '登录状态已失效，请重新维护认证信息'
        : '画册收藏弹窗解析失败'
      return result
    }

    const data = new galleryFavoriteStateData()
    const labels = bodyParser.getElementsBySelector('label[for]')
    const labelByInputId = new Map(
      labels.map((label) => [label.attribute('for'), label.text.trim()]),
    )
    const applyValue = bodyParser
      .getElementBySelector('input[name="apply"]')
      .attribute('value')
      .trim()
    const selectedInput = categoryInputs.find((input) => input.hasAttribute('checked'))
    const removeInput = categoryInputs.find((input) => !/^\d+$/.test(input.attribute('value')))

    for (const input of categoryInputs) {
      const value = input.attribute('value')
      if (!/^\d+$/.test(value)) continue
      const index = Number(value)
      const category = new favoriteCategoryData()
      category.index = index
      category.name =
        labelByInputId.get(input.attribute('id')) ||
        input.attribute('title') ||
        `Favorites ${index}`
      data.categories.push(category)
    }

    data.categories.sort((left, right) => left.index - right.index)
    data.applyValue = applyValue || 'Apply Changes'
    data.removeValue = removeInput?.attribute('value') ?? 'favdel'
    data.note = bodyParser.getElementBySelector('textarea[name="favnote"]').text
    data.status = /^Add to Favorites$/i.test(data.applyValue) ? 'none' : 'favorited'
    if (data.status === 'favorited' && selectedInput) {
      const selectedIndex = Number.parseInt(selectedInput.attribute('value'), 10)
      if (Number.isFinite(selectedIndex)) data.selectedCategoryIndex = selectedIndex
    }

    result.data = data
    result.isSuccess = data.categories.length > 0
    result.msg = result.isSuccess ? '画册收藏状态获取成功' : '收藏分类解析失败'
    return result
  }

  private getPageCursor(
    bodyParser: parserClass,
    selector: string,
    parameter: 'next' | 'prev',
  ): string | undefined {
    const url = bodyParser.getElementBySelector(selector).attribute('href')
    if (!url) return undefined
    try {
      return new URL(url, 'https://e-hentai.org').searchParams.get(parameter) || undefined
    } catch {
      return undefined
    }
  }

  private isFavoritePage(html: string): boolean {
    return /^Favorites$/i.test(parserClass.loadBody(html).getElementBySelector('h1').text)
  }
}
