import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export class bookInfoInput extends R {
  url(): string {
    return `/g/${this.bookId}`
  }
  bookId: string = ''
  @jsonClass.property('p')
  page: number = 0
}
