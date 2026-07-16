import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import type { galleryTorrentsInput } from '../model/file/galleryTorrentsInput'
import { galleryTorrentItem, galleryTorrentsOutput } from '../model/file/galleryTorrentsOutput'

export class bookFileBusi {
  /**
   * 获取种子下载链接
   * @param param
   * @returns
   */
  async getBookImage(param: galleryTorrentsInput): Promise<galleryTorrentsOutput> {
    const result: galleryTorrentsOutput = new galleryTorrentsOutput()
    const htmlResult = await httpClass.sendRequest(param)
    if (htmlResult.isSuccess) {
      const bodyParser = parserClass.loadBody(htmlResult.data!)
      const imageInfo = bodyParser.getElementBySelector(['div#torrentinfo'])
      if (imageInfo.invalid) {
        result.isSuccess = false
        result.msg = '解析失败'
        return result
      }

      result.bookName = imageInfo.getElementBySelector(['h1']).text
      result.data = []
      const pageElement = imageInfo.getElementsBySelector('form') || []
      for (const page of pageElement) {
        const torrentItem = new galleryTorrentItem()
        torrentItem.gtid = page.getElementBySelector(['input[name="gtid"]']).attribute('value')

        const header = page.getElementBySelector('tr:nth-child(1)')
        const headerCells = header.getElementsBySelector('td')
        torrentItem.posted = new Date(this.getFieldValue(headerCells, 'Posted'))
        torrentItem.size = this.getFieldValue(headerCells, 'Size')
        torrentItem.seeds = Number(this.getFieldValue(headerCells, 'Seeds')) || 0
        torrentItem.peers = Number(this.getFieldValue(headerCells, 'Peers')) || 0
        torrentItem.downloads = Number(this.getFieldValue(headerCells, 'Downloads')) || 0
        torrentItem.uploader = this.getFieldValue(
          page.getElementBySelector('tr:nth-child(2)').getElementsBySelector('td'),
          'Uploader',
        )
        torrentItem.fileName = page.getElementBySelector(['tr:nth-child(3)', 'a']).text
        torrentItem.downloadUrl = page
          .getElementBySelector(['tr:nth-child(3)', 'a'])
          .attribute('href')
        result.data.push(torrentItem)
      }

      result.isSuccess = true
    } else {
      result.msg = htmlResult.msg
    }
    return result
  }

  private getFieldValue(elements: parserClass[], label: string): string {
    const prefix = `${label}:`
    const text = elements.find((element) => element.text.startsWith(prefix))?.text ?? ''
    return text.slice(prefix.length).trim()
  }
}
