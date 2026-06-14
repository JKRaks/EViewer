import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { bookImgInput } from '../model/book/bookImgInput'
import { bookImgOutput } from '../model/book/bookImgOutput'

export class bookImageBusi {
  /**
   * 获取单页画册图片
   * @param param
   * @returns
   */
  async getBookImage(param: bookImgInput): Promise<bookImgOutput> {
    const result: bookImgOutput = new bookImgOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      const imageInfo = bodyParser.getElementBySelector(['div#i1'])
      if (!imageInfo) {
        result.isSuccess = false
        result.msg = '解析失败'
      }

      result.bookName = imageInfo.getElementBySelector(['h1']).text

      const pageElement = imageInfo.getElementsBySelector(['div#i2', 'div.sn', 'div', 'span']) || []
      if (pageElement.length >= 2) {
        result.index = parseInt(pageElement[0]?.text || '0') || 0
        result.totalCount = parseInt(pageElement[1]?.text || '0') || 0
      }

      const prevLink = imageInfo
        .getElementBySelector(['div#i2', 'div.sn', 'a#prev'])
        .attribute('href')
      const prevMatch = prevLink.match(/\/s\/([^\/]+\/[^\/]+)/)
      result.prevImageId = prevMatch ? prevMatch[1] || '' : ''

      const nextLink = imageInfo
        .getElementBySelector(['div#i2', 'div.sn', 'a#prev'])
        .attribute('href')
      const nextMatch = nextLink.match(/\/s\/([^\/]+\/[^\/]+)/)
      result.nextImageId = nextMatch ? nextMatch[1] || '' : ''

      const lastDiv = imageInfo.getElementBySelector(['div#i2', 'div:last-child']).text

      if (lastDiv) {
        const match = lastDiv.match(/^(.+?)\s+::\s+(\d+\s+x\s+\d+)\s+::\s+(.+)$/)
        if (match) {
          result.imageName = match[1]?.trim() || ''
          result.imageSize = match[2]?.trim() || ''
          result.fileSize = match[3]?.trim() || ''
        } else {
          result.imageName = ''
          result.imageSize = ''
          result.fileSize = ''
        }
      }

      result.data = imageInfo.getElementBySelector(['div#i3', 'a', 'img#img']).attribute('src')

      result.isSuccess = true
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }
}
