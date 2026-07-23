import { jsonClass } from '@/core/common/decorator/jsonProperty'
import { R } from '../R'
import type { userConfigData } from './userConfigOutput'

/** 用户配置页面读取参数 */
export class userConfigInput extends R {
  url(): string {
    return '/uconfig.php'
  }
}

/** 用户配置主体表单更新参数 */
export class userConfigUpdateInput extends R {
  requestData: Record<string, unknown> | undefined

  constructor(public data: userConfigData) {
    super()
  }

  url(): string {
    return '/uconfig.php'
  }

  getMethod(): 'POST' {
    return 'POST'
  }

  getRequestData(): Record<string, unknown> | undefined {
    return this.requestData
  }
}

export type userConfigProfileAction = 'switch' | 'rename' | 'create' | 'default' | 'delete'

/** Profile 切换和管理表单参数 */
export class userConfigProfileInput extends R {
  @jsonClass.property('profile_action')
  profileAction: string = ''

  @jsonClass.property('profile_name')
  profileName: string = ''

  @jsonClass.property('profile_set')
  profileSlot: string = ''

  constructor(action: userConfigProfileAction, profileSlot: string, profileName: string = '') {
    super()
    this.profileAction = action === 'switch' ? '' : action
    this.profileSlot = profileSlot
    this.profileName = profileName
  }

  url(): string {
    return '/uconfig.php'
  }

  getMethod(): 'POST' {
    return 'POST'
  }
}
