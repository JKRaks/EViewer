import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { bookImgInput } from '../model/book/bookImgInput'
import type { bookImgListInput } from '../model/book/bookImgListInput'
import { bookImgListOutput } from '../model/book/bookImgListOutput'
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

      result.bookName = imageInfo?.getElementBySelector(['h1'])?.element?.textContent?.trim() || ''

      const pageElement =
        imageInfo?.getElementsBySelector(['div#i2', 'div.sn', 'div', 'span']) || []
      if (pageElement.length >= 2) {
        result.index = parseInt(pageElement[0]?.element?.textContent?.trim() || '0') || 0
        result.totalCount = parseInt(pageElement[1]?.element?.textContent?.trim() || '0') || 0
      }

      const prevLink = imageInfo
        ?.getElementBySelector(['div#i2', 'div.sn', 'a#prev'])
        ?.element?.getAttribute('href')
      const prevMatch = prevLink?.match(/\/s\/([^\/]+\/[^\/]+)/)
      result.prevImageId = prevMatch ? prevMatch[1] || '' : ''

      const nextLink = imageInfo
        ?.getElementBySelector(['div#i2', 'div.sn', 'a#prev'])
        ?.element?.getAttribute('href')
      const nextMatch = nextLink?.match(/\/s\/([^\/]+\/[^\/]+)/)
      result.nextImageId = nextMatch ? nextMatch[1] || '' : ''

      const lastDiv =
        imageInfo?.getElementBySelector(['div#i2', 'div:last-child'])?.element?.textContent || ''

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

      result.data =
        imageInfo?.getElementBySelector(['div#i3', 'a', 'img#img'])?.element?.getAttribute('src') ||
        ''

      result.isSuccess = true
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }

  /**
   * 单次获取全部画册图片
   * @param param
   * @returns
   */
  async getBookImages(param: bookImgListInput): Promise<bookImgListOutput> {
    const result: bookImgListOutput = new bookImgListOutput()
    result.data = []
    for (const imageId of param.imageIds) {
      const imgInput = new bookImgInput()
      imgInput.imageId = imageId
      const imgResult = await this.getBookImage(imgInput)
      if (imgResult.isSuccess) {
        result.data.push(imgResult)
      }
    }
    result.data.sort((a, b) => a.index - b.index)
    result.isSuccess = true
    result.msg = '获取画册图片列表成功'
    return result
  }
}
