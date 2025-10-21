export class parserClass {
  rawHtml: string = ''
  element: Element | null = null

  constructor(html: Element) {
    this.rawHtml = html.outerHTML
    this.element = html
  }

  /**
   * 通过选择器获取文档元素
   * @param selector 选择器
   * @returns 文档元素
   */
  getElementBySelector(selector: string | string[]): parserClass | null {
    let result: parserClass | null = null
    let target: Element | null | undefined
    if (Array.isArray(selector)) {
      target = this.element?.querySelector(selector.join(' '))
    } else {
      target = this.element?.querySelector(selector)
    }
    if (target) {
      result = new parserClass(target)
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
