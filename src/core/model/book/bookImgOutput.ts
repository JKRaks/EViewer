import { P } from '../P'

export class bookImgOutput extends P<string> {
  imageName: string = ''
  index: number = 0
  totalCount: number = 0
  prevImageId: string = ''
  nextImageId: string = ''
  imageSize: string = ''
  fileSize: string = ''
  bookName: string = ''
}
