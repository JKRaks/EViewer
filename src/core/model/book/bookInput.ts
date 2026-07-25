import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { categoryEnum } from '@/core/common/enum/categoryEnum'
import { R } from '../R'

export class bookInput extends R {
  url(): string {
    return '/'
  }

  @jsonClass.property('f_cats')
  category: categoryEnum = categoryEnum.All
  @jsonClass.property('f_search')
  keyword: string | undefined = undefined
  @jsonClass.property('next')
  pageNxt: number | undefined = undefined
  @jsonClass.property('prev')
  pagePrev: number | undefined = undefined
  @jsonClass.property('f_srdd')
  minRating: number | undefined = undefined
  @jsonClass.property('f_sr')
  minRatingEnabled: string | undefined = undefined
  @jsonClass.property('f_spf')
  minPages: number | undefined = undefined
  @jsonClass.property('f_spt')
  maxPages: number | undefined = undefined
  @jsonClass.property('f_sp')
  pageRangeEnabled: string | undefined = undefined
  @jsonClass.property('f_sto')
  requireTorrent: string | undefined = undefined
  @jsonClass.property('f_sh')
  showHide: string | undefined = undefined
  @jsonClass.property('f_sfl')
  disableLanguageFilter: string | undefined = undefined
  @jsonClass.property('f_sfu')
  disableUploaderFilter: string | undefined = undefined
  @jsonClass.property('f_sft')
  disableTagFilter: string | undefined = undefined
  @jsonClass.property('f_shash')
  fileHash: string | undefined = undefined
  @jsonClass.property('inline_set')
  readonly showType: string = 'dm_e'
}
