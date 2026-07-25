import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export class toplistInput extends R {
  @jsonClass.property('tl')
  tl: number | undefined = undefined

  @jsonClass.property('p')
  page: number | undefined = undefined

  constructor(tl?: number, page?: number) {
    super()
    this.tl = tl
    this.page = page
  }

  url(): string {
    return '/toplist.php'
  }
}
