import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export class popularInput extends R {
  url(): string {
    return '/popular'
  }

  @jsonClass.property('inline_set')
  readonly showType: string = 'dm_e'
}
