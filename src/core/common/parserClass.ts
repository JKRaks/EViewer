export class parserClass {
  rawHtml: string = ''
  element: Element | null = null
  invalid: boolean = false

  constructor(html: Element | null = null) {
    if (html) {
      this.rawHtml = html.outerHTML
      this.element = html
    } else {
      this.invalid = true
    }
  }

  /**
   * 获取文档内容
   * @param this 文档元素
   * @returns 内容
   */
  get text(): string {
    if (this.invalid) {
      return ''
    } else {
      return this?.element?.textContent?.trim() || ''
    }
  }

  /**
   * 获取文档属性值
   * @param key 键值
   * @returns 结果
   */
  attribute(key: string): string {
    if (this.invalid) {
      return ''
    } else {
      return this?.element?.getAttribute(key)?.trim() || ''
    }
  }

  /**
   * 通过选择器获取文档元素
   * @param selector 选择器
   * @returns 文档元素
   */
  getElementBySelector(selector: string | string[]): parserClass {
    let result: parserClass | null = null
    let target: Element | null | undefined
    if (Array.isArray(selector)) {
      target = this.element?.querySelector(selector.join(' '))
    } else {
      target = this.element?.querySelector(selector)
    }
    if (target) {
      result = new parserClass(target)
    } else {
      result = new parserClass()
    }
    return result
  }

  /**
   * 通过选择器获取文档元素集合
   * @param selector 选择器
   * @returns 文档元素集合
   */
  getElementsBySelector(selector: string | string[]): parserClass[] {
    const result: parserClass[] = []
    if (this.invalid) {
      return result
    }
    let elements: NodeListOf<Element> | undefined
    if (Array.isArray(selector)) {
      elements = this.element?.querySelectorAll(selector.join(' '))
    } else {
      elements = this.element?.querySelectorAll(selector)
    }
    if (elements) {
      elements.forEach((el) => {
        result.push(new parserClass(el))
      })
    }
    return result
  }

  private static getBody(html: string): Element | null {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return doc.body
  }

  private static getHeader(html: string): Element | null {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return doc.head
  }

  static loadBody(html: string): parserClass {
    const body = this.getBody(html)
    if (body) {
      return new parserClass(body)
    } else {
      throw new Error('Failed to parse HTML body.')
    }
  }

  static loadHeader(html: string): parserClass {
    const head = this.getHeader(html)
    if (head) {
      return new parserClass(head)
    } else {
      throw new Error('Failed to parse HTML head.')
    }
  }
}
