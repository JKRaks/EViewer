import { P } from '../P'
import { bookInfoOutput } from './bookInfoOutput'

export class bookAllInfoOutput extends P<bookInfoOutput[]> {
  bookData: bookInfoOutput = new bookInfoOutput()
  allImgIds: string[] = []
}
