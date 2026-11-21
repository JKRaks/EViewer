import { httpClass } from '../common/httpClass'
import { parserClass } from '../common/parserClass'
import { bookItem } from '../model/book/bookOutput'
import { tagCollection, tagItem } from '../model/book/tag'
import { toplistInput } from '../model/book/toplistInput'
import {
  getToplistKind,
  toplistDetailOutput,
  type contributorToplistEntry,
  type galleryToplistEntry,
  type toplistEntry,
  type toplistOverviewSection,
  toplistOverviewOutput,
} from '../model/book/toplistOutput'

export class toplistBusi {
  /**
   * 获取包含全部 7 个分区、4 个周期的排行榜总览。
   * @returns 每个榜单前 10 名的结构化数据
   */
  async getOverview(): Promise<toplistOverviewOutput> {
    const result = new toplistOverviewOutput()
    result.data = []
    const htmlResult = await httpClass.sendRequest(new toplistInput())

    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg || '获取排行总览失败'
      result.ipRestricted = htmlResult.ipRestricted
      return result
    }

    const bodyParser = parserClass.loadBody(htmlResult.data)
    result.data = this.parseOverview(bodyParser)
    result.isSuccess = result.data.length > 0
    result.msg = result.isSuccess ? '获取排行总览成功' : '未解析到排行总览数据'
    return result
  }

  /**
   * 获取指定分区、周期和页码的完整排行榜。
   * @param param tl 榜单编码；page 为从 0 开始的源站页码
   * @returns 画册榜单或贡献者榜单，以及分页信息
   */
  async getDetail(param: toplistInput): Promise<toplistDetailOutput> {
    const result = new toplistDetailOutput()
    result.tl = param.tl ?? 15
    result.kind = getToplistKind(result.tl)
    result.currentPage = (param.page ?? 0) + 1
    result.data = []
    const htmlResult = await httpClass.sendRequest(param)

    if (!htmlResult.isSuccess || !htmlResult.data) {
      result.msg = htmlResult.msg || '获取排行榜失败'
      result.ipRestricted = htmlResult.ipRestricted
      return result
    }

    const bodyParser = parserClass.loadBody(htmlResult.data)
    result.data =
      result.kind === 'gallery'
        ? this.parseGalleryDetail(bodyParser)
        : this.parseContributorDetail(bodyParser)
    result.totalPages = this.parseTotalPages(bodyParser)
    result.isSuccess = result.data.length > 0
    result.msg = result.isSuccess ? '获取排行榜成功' : '未解析到排行榜数据'
    return result
  }

  private parseOverview(bodyParser: parserClass): toplistOverviewSection[] {
    const sections: toplistOverviewSection[] = []

    for (const sectionElement of bodyParser.getElementsBySelector('div.tdo')) {
      const listLink = sectionElement.getElementBySelector('p a[href*="toplist.php?tl="]')
      const tl = this.parseToplistCode(listLink.attribute('href'))
      if (!tl) continue

      const kind = getToplistKind(tl)
      const entries: toplistEntry[] = []
      for (const row of sectionElement.getElementsBySelector('table tr')) {
        const rank = this.parseNumber(row.getElementBySelector('td.pso').text)
        const entryLink = row.getElementBySelector('a[href]')
        const sourceUrl = entryLink.attribute('href')
        const name = entryLink.text
        if (!rank || !sourceUrl || !name) continue

        if (kind === 'gallery') {
          const book = this.createBookIdentity(name, sourceUrl)
          entries.push({ kind, rank, book })
        } else {
          entries.push({ kind, rank, username: name, sourceUrl })
        }
      }

      sections.push({
        tl,
        category: Math.floor(tl / 10),
        period: tl % 10,
        kind,
        entries,
      })
    }

    return sections
  }

  private parseGalleryDetail(bodyParser: parserClass): galleryToplistEntry[] {
    const entries: galleryToplistEntry[] = []
    const rows = bodyParser.getElementsBySelector('table.itg.gltc > tbody > tr')

    for (const row of rows) {
      const rank = this.parseNumber(row.getElementBySelector('td:first-child p:first-child').text)
      const score = this.parseNumber(row.getElementBySelector('td:first-child p:nth-child(2)').text)
      const bookLink = row.getElementBySelector('td.gl3c > a[href]')
      const bookTitle = row.getElementBySelector('td.gl3c div.glink').text
      const bookUrl = bookLink.attribute('href')
      if (!rank || !bookTitle || !bookUrl) continue

      const book = this.createBookIdentity(bookTitle, bookUrl)
      book.thumbnailUrl = row.getElementBySelector('td.gl2c img').attribute('src')
      book.category = row.getElementBySelector('td.gl1c div.cn').text
      book.publishDate = this.parseDate(row.getElementBySelector('td.gl2c [id^="posted_"]').text)
      book.downloadUrl = row.getElementBySelector('td.gl2c div.gldown a').attribute('href')
      book.tags = this.parseGalleryTags(row)
      book.uploader = row.getElementBySelector('td.gl4c a').text
      book.imgCount = this.parseNumber(row.getElementBySelector('td.gl4c > div:last-child').text)
      entries.push({ kind: 'gallery', rank, score, book })
    }

    return entries
  }

  private parseContributorDetail(bodyParser: parserClass): contributorToplistEntry[] {
    const entries: contributorToplistEntry[] = []

    for (const row of bodyParser.getElementsBySelector('table.itg > tbody > tr')) {
      const ranks = row.getElementsBySelector('td.dr')
      const scores = row.getElementsBySelector('td.ds')
      const users = row.getElementsBySelector('td.du')
      for (let index = 0; index < users.length; index++) {
        const userLink = users[index]?.getElementBySelector('a[href]')
        const rank = this.parseNumber(ranks[index]?.text ?? '')
        const username = userLink?.text ?? ''
        const sourceUrl = userLink?.attribute('href') ?? ''
        if (!rank || !username || !sourceUrl) continue

        entries.push({
          kind: 'contributor',
          rank,
          score: this.parseNumber(scores[index]?.text ?? ''),
          username,
          sourceUrl,
        })
      }
    }

    return entries.sort((left, right) => left.rank - right.rank)
  }

  private parseGalleryTags(row: parserClass): tagCollection[] {
    const collections = new Map<string, tagCollection>()

    for (const tagElement of row.getElementsBySelector('td.gl3c div.gt, td.gl3c div.gtl')) {
      const rawTag = tagElement.attribute('title')
      const separatorIndex = rawTag.indexOf(':')
      if (separatorIndex <= 0) continue

      const collectionName = rawTag.slice(0, separatorIndex).trim()
      const name = rawTag.slice(separatorIndex + 1).trim()
      if (!name) continue

      let collection = collections.get(collectionName)
      if (!collection) {
        collection = new tagCollection()
        collection.collection = collectionName
        collections.set(collectionName, collection)
      }

      const tag = new tagItem()
      tag.name = name
      tag.official = tagElement.attribute('class').split(/\s+/).includes('gt')
      collection.items.push(tag)
    }

    return Array.from(collections.values())
  }

  private parseTotalPages(bodyParser: parserClass): number {
    let totalPages = 1
    for (const link of bodyParser.getElementsBySelector('table.ptt a')) {
      totalPages = Math.max(totalPages, this.parseNumber(link.text))
    }
    for (const cell of bodyParser.getElementsBySelector('table.ptt td[onclick*="Jump to page"]')) {
      const match = cell.attribute('onclick').match(/Jump to page: \(1-(\d+)\)/)
      if (match?.[1]) totalPages = Math.max(totalPages, Number(match[1]))
    }
    return totalPages
  }

  private createBookIdentity(title: string, url: string): bookItem {
    const book = new bookItem()
    book.bookTitle = title
    book.bookUrl = url
    const match = url.match(/\/g\/([^/]+)\/([^/]+)/)
    book.bookId = match ? `${match[1]}-${match[2]}` : ''
    return book
  }

  private parseToplistCode(url: string): number {
    try {
      return Number(new URL(url, 'https://e-hentai.org').searchParams.get('tl')) || 0
    } catch {
      return 0
    }
  }

  private parseNumber(value: string): number {
    return Number.parseInt(value.replace(/[^\d]/g, ''), 10) || 0
  }

  private parseDate(value: string): Date | undefined {
    if (!value) return undefined
    const date = new Date(value.replace(' ', 'T'))
    return Number.isNaN(date.getTime()) ? undefined : date
  }
}
