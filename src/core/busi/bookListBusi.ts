import { categoryEnum } from '../common/enum/categoryEnum'
import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { bookInput } from '../model/book/bookInput'
import { bookOutput, bookItem } from '../model/book/bookOutput'

export class bookListBusi {
  /**
   * 获取画册列表
   * @param param 画册列表参数
   * @returns 画册列表
   */
  async getBookPageList(param: bookInput): Promise<bookOutput> {
    const result: bookOutput = new bookOutput()
    result.data = []
    const queryParams = Object.create(param)
    if (!queryParams.showHide) {
      queryParams.showHide = undefined
    }
    if (queryParams.category !== categoryEnum.All) {
      queryParams.category = categoryEnum.All - queryParams.category
    }
    const htmlResult = await httpClass.sendRequest(queryParams)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      //解析画册列表
      const elements = bodyParser.getElementsBySelector([
        'div.ido',
        'div',
        'table.itg.glte',
        '>tbody',
        '>tr',
      ])
      for (const element of elements) {
        const item = new bookItem()
        item.bookTitle = this.getBookTitle(element)
        item.bookUrl = this.getBookUrl(element)
        const urlParts = item.bookUrl.match(/\/g\/(.+)$/)
        item.bookId = (urlParts ? urlParts[1] || '' : '').replace('/', '-')
        item.thumbnailUrl = this.getThumbnailUrl(element)
        item.category = this.getCategory(element)
        item.downloadUrl = this.getDownloadUrl(element)
        item.imgCount = this.getPicCount(element)
        item.publishDate = this.getPublishDate(element)
        item.rate = 0
        item.tags = this.getTags(element)
        item.uploader = this.getUploader(element)
        if (!this.validBookItem(item)) {
          continue
        }
        result.data.push(item)
      }
      result.nxtPage = this.getNextPage(bodyParser)
      result.prvPage = this.getLastPage(bodyParser)
      result.totalCount = this.getTotalCount(bodyParser)
      result.isSuccess = true
      result.msg = '获取画册列表成功'
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }

  /**
   * 验证画册信息有效性
   * @param item 画册信息
   * @returns 有效状态
   */
  private validBookItem(item: bookItem): boolean {
    if (!item.bookTitle || item.bookTitle.trim() === '') {
      return false
    }
    if (!item.bookUrl || item.bookUrl.trim() === '') {
      return false
    }
    return true
  }

  /**
   * 解析标题
   * @param element
   * @returns
   */
  private getBookTitle(element: parserClass): string {
    const selectElement = element.getElementBySelector([
      'td.gl2e',
      'div',
      'a',
      'div.gl4e.glname',
      'div.glink',
    ])
    return selectElement.text
  }

  /**
   * 解析 URL
   * @param element
   * @returns
   */
  private getBookUrl(element: parserClass): string {
    const selectElement = element.getElementBySelector(['td.gl2e>', 'div>', 'a'])
    return selectElement.attribute('href')
  }

  /**
   * 解析缩略图 URL
   * @param element
   * @returns
   */
  private getThumbnailUrl(element: parserClass): string {
    const selectElement = element.getElementBySelector(['td.gl1e', 'div', 'img'])
    return selectElement.attribute('src') ?? ''
  }

  /**
   * 获取分类
   * @param element
   * @returns
   */
  private getCategory(element: parserClass): string {
    const selectElement = element.getElementBySelector(['td.gl2e', 'div', 'div.gl3e', 'div.cn'])
    return selectElement.text
  }

  /**
   * 获取发布日期
   * @param element
   * @returns
   */
  private getPublishDate(element: parserClass): Date {
    const selectElement = element.getElementBySelector([
      'td.gl2e',
      'div',
      'div.gl3e',
      'div[onclick][id]',
    ])
    const dateStr = selectElement.text
    return dateStr ? new Date(dateStr) : new Date()
  }

  /**
   * 获取下载地址
   * @param element
   * @returns
   */
  private getDownloadUrl(element: parserClass): string {
    const selectElement = element.getElementBySelector([
      'td.gl2e',
      'div',
      'div.gl3e',
      'div.gldown',
      'a',
    ])
    let text = selectElement.attribute('href')
    text = decodeURI(text)
    return text
  }

  /**
   * 获取图片数量
   * @param element
   * @returns
   */
  private getPicCount(element: parserClass): number {
    let result = 0
    const selectElements = element.getElementsBySelector(['td.gl2e', 'div', 'div.gl3e', 'div'])
    for (const selectElement of selectElements) {
      const text = selectElement.text
      if (text.includes('pages')) {
        result = Number.parseInt(text.replace(' pages', '').trim())
      }
    }
    return result
  }

  /**
   * 获取上传者
   * @param element
   * @returns
   */
  private getUploader(element: parserClass): string {
    const selectElement = element.getElementBySelector(['td.gl2e', 'div', 'div.gl3e', 'div', 'a'])
    const text = selectElement.text
    return text
  }

  /**
   * 获取 tags
   * @param element
   * @returns
   */
  private getTags(element: parserClass): string[] {
    const result: string[] = []
    const selectElement = element.getElementsBySelector([
      'td.gl2e',
      'div',
      'a',
      'div.gl4e.glname',
      'div',
      'table',
      'tbody',
      'tr',
      'td',
      'div.gt',
    ])

    selectElement.push(
      ...element.getElementsBySelector([
        'td.gl2e',
        'div',
        'a',
        'div.gl4e.glname',
        'div',
        'table',
        'tbody',
        'tr',
        'td',
        'div.gtl',
      ]),
    )
    for (const tagElement of selectElement) {
      const text = tagElement.attribute('title')
      result.push(text)
    }
    return result
  }

  /**
   * 获取下一页页码
   * @param bodyParser
   * @returns
   */
  private getNextPage(bodyParser: parserClass): number {
    const selectElement = bodyParser.getElementBySelector([
      'div.ido',
      'div',
      'div.searchnav',
      'div',
      'a#dnext',
    ])
    const url = selectElement.attribute('href')
    const urlObj = new URL(url)
    const nxt = urlObj.searchParams.get('next') ?? ''
    if (nxt) {
      return parseInt(nxt)
    } else {
      return 0
    }
  }

  /**
   * 获取上一页页码
   * @param bodyParser
   * @returns
   */
  private getLastPage(bodyParser: parserClass): number {
    const selectElement = bodyParser.getElementBySelector([
      'div.ido',
      'div',
      'div.searchnav',
      'div',
      'a#dlast',
    ])
    const url = selectElement.attribute('href')
    const urlObj = new URL(url)
    const nxt = urlObj.searchParams.get('prev') ?? ''
    if (nxt) {
      return parseInt(nxt)
    } else {
      return 0
    }
  }

  /**
   * 获取总数
   * @param bodyParser
   * @returns
   */
  private getTotalCount(bodyParser: parserClass): number {
    const selectElement = bodyParser.getElementBySelector(['div.ido', 'div', 'div.searchtext', 'p'])
    const text = selectElement.text
    let number = 0
    if (text) {
      const match = text.match(/Found(?: about)? ([\d,]+) results/)
      if (match && match[1]) {
        const numberStr = match[1].replace(/,/g, '')
        number = parseInt(numberStr)
      }
    }
    return number
  }
}
