import { bookInfoOutput } from '../model/book/bookInfoOutput'
import { bookInfoInput } from '../model/book/bookInfoInput'
import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { bookAllInfoInput } from '../model/book/bookAllInfoInput'
import { bookAllInfoOutput } from '../model/book/bookAllInfoOutput'

export class bookInfoBusi {
  /**
   * 获取单页画册详情
   * @param param 画册信息
   * @returns 画册页详情
   */
  async getBookInfo(param: bookInfoInput): Promise<bookInfoOutput> {
    const result: bookInfoOutput = new bookInfoOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      let bookInfo = bodyParser.getElementBySelector(['div.gm'])
      if (!bookInfo) {
        result.isSuccess = false
        result.msg = '解析失败'
      }
      bookInfo = bookInfo!
      result.bookName =
        bookInfo.getElementBySelector(['div#gd2', 'h1#gn'])?.element?.textContent?.trim() || ''
      result.coverImage =
        bookInfo
          .getElementBySelector(['div#gleft', 'div#gd1', 'div'])
          ?.element?.getAttribute('style')
          ?.match(/url\(([^)]+)\)/)?.[1] || ''
      const bookInfos = bookInfo.getElementsBySelector(['div#gdd', 'table', 'tbody', 'tr'])
      bookInfos.forEach((trs) => {
        const propertyName: string =
          trs.getElementBySelector(['td.gdt1'])?.element?.textContent?.trim() || ''
        const propertyValue: string =
          trs.getElementBySelector(['td.gdt2'])?.element?.textContent?.trim() || ''

        if (!propertyName || !propertyValue) {
          return
        }

        result.pageIndex = param.page

        switch (propertyName) {
          case 'Posted:':
            result.publishDate = new Date(propertyValue)
            break
          case 'Visible:':
            result.visible = propertyValue
            break
          case 'Language:':
            result.language = propertyValue
            break
          case 'File Size:':
            result.totalSize = propertyValue
            break
          case 'Length:':
            result.imageCount = parseInt(propertyValue.replace('pages', '')) || 0
            break
          case 'Favorited:':
            result.favorited = parseInt(propertyValue.replace('times', '')) || 0
            break
        }
      })

      result.uploader =
        bookInfo
          .getElementBySelector(['div#gmid', 'div#gd3', 'div#gdn', 'a'])
          ?.element?.textContent?.trim() || ''

      result.category =
        bookInfo
          .getElementBySelector(['div#gmid', 'div#gd3', 'div#gdc', 'div.cs'])
          ?.element?.textContent?.trim() || ''

      result.rating =
        bookInfo
          .getElementBySelector([
            'div#gmid',
            'div#gd3',
            'div#gdr',
            'table',
            'tbody',
            'tr',
            'td#rating_label',
          ])
          ?.element?.textContent?.replace('Average:', '')
          ?.trim() || ''
      result.ratingCount = parseInt(
        bookInfo
          .getElementBySelector([
            'div#gmid',
            'div#gd3',
            'div#gdr',
            'table',
            'tbody',
            'tr',
            'td#grt3',
            'span#rating_count',
          ])
          ?.element?.textContent?.trim() || '',
      )
      result.tags = this.getTags(bookInfo)

      result.data = this.getImageIds(bodyParser)

      result.lastPageIndex = Math.ceil(result.imageCount / 20)
      result.isSuccess = true
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }

  /**
   * 获取全部画册详情
   * @param param 画册信息
   * @returns 画册所有页详情
   */
  async getAllBookInfo(param: bookAllInfoInput): Promise<bookAllInfoOutput> {
    const result: bookAllInfoOutput = new bookAllInfoOutput()
    result.allImgIds = []
    const defultParam: bookInfoInput = new bookInfoInput()
    defultParam.bookId = param.bookId
    defultParam.page = 0
    result.bookData = await this.getBookInfo(defultParam)
    if (result.bookData.isSuccess) {
      result.isSuccess = true
      result.msg = '获取画册信息成功'
      result.data?.push(result.bookData)
      result.allImgIds = result.allImgIds.concat(result.bookData.data || [])
      for (let pageIndex = 1; pageIndex <= result.bookData.lastPageIndex; pageIndex++) {
        const pageParam: bookInfoInput = new bookInfoInput()
        pageParam.bookId = param.bookId
        pageParam.page = pageIndex
        const pageData = await this.getBookInfo(pageParam)
        if (pageData.isSuccess) {
          result.data?.push(pageData)
          result.allImgIds = result.allImgIds.concat(pageData.data || [])
        } else {
          result.isSuccess = false
          console.log(`获取第 ${pageIndex} 页画册信息失败，原因：${pageData.msg}`)
          result.msg = `获取第 ${pageIndex} 页画册信息失败，原因：${pageData.msg}`
          return result
        }
      }
    } else {
      result.isSuccess = false
      result.msg = result.bookData.msg
      return result
    }
    return result
  }

  /**
   * 获取 tags
   * @param element 元素
   * @returns tags
   */
  private getTags(element: parserClass): string[] {
    const tags: string[] = []
    element
      .getElementsBySelector(['div#gmid', 'div#gd4', 'div#taglist', 'table', 'tbody', 'tr'])
      .forEach((tr) => {
        const tag = tr.getElementBySelector(['td.tc'])?.element?.textContent?.trim() || ''
        if (!tag) {
          return
        }

        tr.getElementsBySelector(['td', 'div']).forEach((tagDiv) => {
          const name = tagDiv.element?.textContent?.trim()
          if (name) {
            tags.push(`${tag}${name}`)
          }
        })
      })
    return tags
  }

  /**
   * 获取页中 imgIds
   * @param element 元素
   * @returns imgIds
   */
  private getImageIds(element: parserClass): string[] {
    const result: string[] = []
    element.getElementsBySelector(['div#gdt', 'a']).forEach((a) => {
      const href = a.element?.getAttribute('href') || ''
      const match = href.match(/\/s\/([^\/]+\/[^\/]+)/)
      if (match && match[1]) {
        result?.push(match[1])
      }
    })
    return result
  }
}
