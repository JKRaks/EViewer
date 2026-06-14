import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export class bookInfoInput extends R {
  /**
   * 请求URL
   * @returns 请求相对URL
   */
  url(): string {
    return `/g/${this.bookId}`
  }
  /**
   * 画册ID
   */
  bookId: string = ''

  /**
   * 页码
   */
  @jsonClass.property('p')
  page: number = 0

  @jsonClass.property('nw')
  readonly nw: string = this.page != 0 ? '' : 'always'

  shouldSerializeProperty(propertyKey: string): boolean {
    if (propertyKey === 'nw' && this.page > 0) {
      return false
    }
    return true
  }
}
