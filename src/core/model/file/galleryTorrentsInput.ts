import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'

export class galleryTorrentsInput extends R {
  url(): string {
    return `/gallerytorrents.php`
  }
  /**
   * 画册ID
   */
  @jsonClass.property('gid')
  gallery: string = ''

  /**
   * 页码
   */
  @jsonClass.property('t')
  tid: string = ''
}
