import { P } from '../model/P'
import axios, {
  type AxiosInstance,
  type AxiosProgressEvent,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import type { R, requestEncoding } from '../model/R'
import { jsonClass } from './decorator/jsonProperty'

export interface HttpRequestOptions {
  signal?: AbortSignal
  timeout?: number
  onUploadProgress?: (loaded: number, total?: number) => void
}

export class httpClass {
  // 创建全局 axios 实例
  private static axiosInstance: AxiosInstance = axios.create({
    withCredentials: true,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 30000,
    maxRedirects: 0,
    validateStatus: () => true,
    // 添加这个配置，明确告诉 axios 不要跟随重定向
    beforeRedirect: () => {
      throw new Error('Should not auto-redirect')
    },
  })

  static async sendRequest<T extends R>(
    param: T,
    options: HttpRequestOptions = {},
  ): Promise<P<string>> {
    const url = this.getUrl(param)
    const method = param.getMethod()
    const result: P<string> = new P<string>()

    try {
      let response: AxiosResponse<string>

      if (method === 'GET') {
        const queryString = this.buildParam(param)
        const fullUrl = queryString ? `${url}?${queryString}` : url
        console.log('发送 GET 请求:', fullUrl)
        response = await this.followRedirects(
          fullUrl,
          'GET',
          undefined,
          param.getRequestEncoding(),
          options,
        )
      } else {
        const data = param.getRequestData() ?? jsonClass.serialize(param)
        console.log('发送 POST 请求:', url)
        response = await this.followRedirects(
          url,
          'POST',
          data,
          param.getRequestEncoding(),
          options,
        )
      }

      // console.log('最终响应状态:', response.status)
      // console.log('最终响应 Cookie:', response.headers['set-cookie'])

      result.data = response.data
      result.isSuccess = true
    } catch (error: unknown) {
      if (!axios.isCancel(error)) console.error('请求失败:', error)
      result.msg = (error as Error).message
    }
    return result
  }

  // 手动处理重定向，确保携带 cookies
  private static async followRedirects(
    url: string,
    method: 'GET' | 'POST',
    data: Record<string, unknown> | FormData | undefined,
    encoding: requestEncoding,
    options: HttpRequestOptions,
    maxRedirects: number = 10,
  ): Promise<AxiosResponse<string>> {
    let currentUrl = url
    let currentMethod = method
    let currentData = data
    let redirectCount = 0
    let accumulatedCookies: string[] = []

    while (redirectCount < maxRedirects) {
      // console.log(`\n========== [重定向 #${redirectCount}] ==========`)
      // console.log('请求 URL:', currentUrl)
      // console.log('当前累积的 Cookies:', accumulatedCookies.join('; '))

      const config: AxiosRequestConfig = {
        headers: {
          ...(accumulatedCookies.length > 0 && {
            Cookie: accumulatedCookies.join('; '),
          }),
        },
        maxRedirects: 0,
        validateStatus: () => true, // 接受所有状态码
        signal: options.signal,
        timeout: options.timeout,
        onUploadProgress: options.onUploadProgress
          ? (event: AxiosProgressEvent) => options.onUploadProgress?.(event.loaded, event.total)
          : undefined,
      }

      let response: AxiosResponse<string>

      try {
        if (currentMethod === 'POST') {
          const requestBody = this.buildRequestBody(currentData, encoding)
          if (encoding === 'urlencoded') {
            config.headers = {
              ...config.headers,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            }
          } else if (encoding === 'json') {
            config.headers = { ...config.headers, 'Content-Type': 'application/json' }
          }
          response = await this.axiosInstance.post<string>(currentUrl, requestBody, config)
        } else {
          // console.log('发送 GET 请求')
          response = await this.axiosInstance.get<string>(currentUrl, config)
        }
      } catch (error) {
        if (!axios.isCancel(error)) console.error('请求错误:', error)
        throw error
      }

      // console.log('响应状态:', response.status)
      // console.log('响应头 Set-Cookie:', response.headers['set-cookie'])
      // console.log('响应头 Location:', response.headers.location)

      // 收集 Set-Cookie
      if (response.headers['set-cookie']) {
        const newCookies = this.parseCookies(response.headers['set-cookie'])
        // console.log('解析出的新 Cookies:', newCookies)
        accumulatedCookies = this.mergeCookies(accumulatedCookies, newCookies)
        // console.log('更新后的累积 Cookies:', accumulatedCookies.join('; '))
      }

      // 检查是否是重定向 (3xx 状态码)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location
        if (!location) {
          // console.log('重定向响应但没有 Location 头，返回当前响应')
          return response
        }

        // console.log('检测到重定向，Location:', location)

        // 处理相对路径和绝对路径
        currentUrl = this.resolveUrl(currentUrl, location)
        if ([301, 302, 303].includes(response.status)) {
          currentMethod = 'GET'
          currentData = undefined
        }
        redirectCount++

        // console.log('跟随重定向到:', currentUrl)
        // console.log(`========== [重定向 #${redirectCount - 1}] 结束 ==========\n`)
        continue
      }

      // 检查状态码是否成功
      if (response.status >= 400) {
        console.error('请求失败，状态码:', response.status)
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      // 不是重定向，返回最终响应
      // console.log('收到最终响应 (非重定向)，停止')
      // console.log(`========== 完成，共 ${redirectCount} 次重定向 ==========\n`)
      return response
    }

    throw new Error(`超过最大重定向次数 (${maxRedirects})`)
  }

  // 解析 Set-Cookie 头，提取 cookie 键值对
  private static parseCookies(setCookieHeaders: string | string[]): string[] {
    // 处理可能是字符串或数组的情况
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]

    return headers
      .map((cookie) => {
        // 只取第一个分号前的部分 (name=value)
        const nameValue = cookie.split(';')[0]?.trim()
        return nameValue || ''
      })
      .filter(Boolean) // 过滤空字符串
  }

  // 合并 cookies，新的覆盖旧的
  private static mergeCookies(existing: string[], newCookies: string[]): string[] {
    const cookieMap = new Map<string, string>()

    // 先添加现有的
    existing.forEach((cookie) => {
      const [name] = cookie.split('=')
      if (name) cookieMap.set(name.trim(), cookie)
    })

    // 新的覆盖旧的
    newCookies.forEach((cookie) => {
      const [name] = cookie.split('=')
      if (name) cookieMap.set(name.trim(), cookie)
    })

    return Array.from(cookieMap.values())
  }

  // 解析 URL（处理相对路径和绝对路径）
  private static resolveUrl(currentUrl: string, location: string): string {
    if (location.startsWith('http://') || location.startsWith('https://')) {
      return location
    }

    const url = new URL(currentUrl)
    if (location.startsWith('/')) {
      // 绝对路径
      return `${url.origin}${location}`
    } else {
      // 相对路径
      const pathParts = url.pathname.split('/')
      pathParts.pop()
      pathParts.push(location)
      return `${url.origin}${pathParts.join('/')}`
    }
  }

  private static getUrl<T extends R>(param: T): string {
    return `${param.getHost()}${param.url()}`
  }

  // 构建 URL 查询字符串（用于 GET 请求）
  private static buildParam<T extends R>(param: T): string {
    const serialized = jsonClass.serialize(param)

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(serialized)) {
      if (value !== null && value !== undefined) {
        params.append(key, String(value))
      }
    }

    return params.toString()
  }

  private static buildRequestBody(
    data: Record<string, unknown> | FormData | undefined,
    encoding: requestEncoding,
  ): Record<string, unknown> | FormData | URLSearchParams | undefined {
    if (!data || data instanceof FormData || encoding !== 'urlencoded') {
      return data
    }

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue
      const values = Array.isArray(value) ? value : [value]
      values.forEach((item) => params.append(key, String(item)))
    }
    return params
  }
}
