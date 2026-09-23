import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import type { ShareQrSource } from '@/core/share/shareSettings'

export interface BookShareLink {
  type: ShareQrSource
  label: string
  description: string
  url: string
}

/** 生成画册在本站与源站的可公开分享地址。 */
export function buildBookShareLinks(book: Pick<bookInfoOutput, 'bookId'>): BookShareLink[] {
  const bookId = book.bookId.trim()
  const normalizedBookId = bookId.replace('-', '/')
  const siteUrl = new URL(`${normalizedBasePath()}bookinfo`, window.location.origin)
  siteUrl.searchParams.set('bookId', bookId)

  return [
    {
      type: 'site',
      label: '本站链接',
      description: '通过 EViewer 打开画册详情',
      url: siteUrl.toString(),
    },
    {
      type: 'source',
      label: '源站链接',
      description: '直接前往 E-Hentai 画册页面',
      url: `https://e-hentai.org/g/${normalizedBookId}`,
    },
  ]
}

export function getBookShareUrl(
  book: Pick<bookInfoOutput, 'bookId'>,
  source: ShareQrSource,
): string {
  return buildBookShareLinks(book).find((link) => link.type === source)?.url ?? ''
}

function normalizedBasePath(): string {
  const basePath = import.meta.env.BASE_URL || '/'
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}
