import { eurlEnum } from '../common/enum/eurlEnum'

export abstract class R {
  abstract url(): string

  getMethod(): 'GET' | 'POST' {
    return 'GET'
  }

  getHost(): eurlEnum {
    return eurlEnum.EH
  }

  /**
   * 为包含动态字段的请求提供自定义表单数据。
   * @returns 自定义请求数据；返回 undefined 时继续使用装饰器序列化
   */
  getRequestData(): Record<string, unknown> | undefined {
    return undefined
  }
}
