import { P } from '../P'

export class bookInfoOutput extends P<string[]> {
  coverImage: string = ''
  imageCount: number = 0
  bookName: string = ''
  favorited: number = 0
  language: string = ''
  totalSize: string = ''
  publishDate: Date | undefined = undefined
  rating: string = ''
  ratingCount: number = 0
  tags: string[] = []
  visible: string = ''
  pageIndex: number = 0
  lastPageIndex: number = 0
  category: string = ''
  uploader: string = ''
}
