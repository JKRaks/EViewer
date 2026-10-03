import { bookInfoOutput, userComment } from '../model/book/bookInfoOutput'
import { bookInfoInput } from '../model/book/bookInfoInput'
import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { parseTagCollections } from '../common/tagParser'
import type { tagCollection } from '../model/book/tag'

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
      const bookInfo = bodyParser.getElementBySelector(['div.gm'])
      if (!bookInfo) {
        result.isSuccess = false
        result.msg = '解析失败'
      }
      result.bookId = param.bookId
      result.bookName = bookInfo.getElementBySelector(['div#gd2', 'h1#gn']).text
      result.coverImage =
        bookInfo
          .getElementBySelector(['div#gleft', 'div#gd1', 'div'])
          .attribute('style')
          .match(/url\(([^)]+)\)/)?.[1] || ''
      const bookInfos = bookInfo.getElementsBySelector(['div#gdd', 'table', 'tbody', 'tr'])
      bookInfos.forEach((trs) => {
        const propertyName: string = trs.getElementBySelector(['td.gdt1']).text
        const propertyValue: string = trs.getElementBySelector(['td.gdt2']).text

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

      result.uploader = bookInfo.getElementBySelector(['div#gmid', 'div#gd3', 'div#gdn', 'a']).text

      result.category = bookInfo.getElementBySelector([
        'div#gmid',
        'div#gd3',
        'div#gdc',
        'div.cs',
      ]).text

      const favoriteLinkText = bookInfo.getElementBySelector('a#favoritelink').text.trim()
      if (favoriteLinkText) {
        result.personalFavoriteStatus = /^Add to Favorites$/i.test(favoriteLinkText)
          ? 'none'
          : 'favorited'
      }

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
          .text.replace('Average:', '')
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
          .text.trim() || '',
      )
      result.tags = this.getTags(bookInfo)

      result.data = this.getImageIds(bodyParser)
      result.userComments = this.getUserComments(bodyParser)
      result.lastPageIndex = Math.ceil(result.imageCount / 20)
      result.isSuccess = true
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }

  /**
   * 获取 tags
   * @param element 元素
   * @returns tags
   */
  private getTags(element: parserClass): tagCollection[] {
    const rows = element.getElementsBySelector([
      'div#gmid',
      'div#gd4',
      'div#taglist',
      'table',
      'tbody',
      'tr',
    ])

    return parseTagCollections(rows)
  }

  /**
   * 获取页中 imgIds
   * @param element 元素
   * @returns imgIds
   */
  private getImageIds(element: parserClass): string[] {
    const result: string[] = []
    element.getElementsBySelector(['div#gdt', 'a']).forEach((a) => {
      const match = a.attribute('href').match(/\/s\/([^\/]+\/[^\/]+)/)
      if (match && match[1]) {
        result?.push(match[1])
      }
    })
    return result
  }
  /**
   * 获取用户评论
   * @param bodyParser 页面解析对象
   * @returns 用户评论
   */
  private getUserComments(bodyParser: parserClass): userComment[] {
    const result: userComment[] = []
    const userComments = bodyParser.getElementsBySelector(['#cdiv', '.c1'])
    for (const commentElement of userComments) {
      const comment = new userComment()
      const dateStr = commentElement.getElementBySelector(['.c2', '.c3']).text
      const dateMatch = dateStr?.match(/Posted on (\d{1,2} \w+ \d{4}, \d{2}:\d{2}) by:/)
      if (dateMatch && dateMatch[1]) {
        comment.date = new Date(dateMatch[1])
      }
      comment.username = commentElement.getElementBySelector(['.c2', '.c3', 'a:first-child']).text
      comment.comment = commentElement.getElementBySelector(['.c6']).text
      comment.contentHtml = commentElement.getElementBySelector(['.c6']).element?.innerHTML ?? ''
      comment.isUploader =
        commentElement.getElementBySelector(['.c2', '.c4']).text == 'Uploader Comment'
      result.push(comment)
    }
    return result
  }
}
