import { R } from '../R'

export class bookImgInput extends R {
  url(): string {
    return `/s/${this.imageId}`
  }
  imageId: string = ''
}
