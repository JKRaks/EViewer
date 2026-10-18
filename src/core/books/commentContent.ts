import { t } from '@/i18n'

/** 只接受普通网页地址；相对地址以源站为基准。 */
export function resolveCommentLink(value: string): { url: string; bookId?: string } | undefined {
  try {
    const url = new URL(value, 'https://e-hentai.org/')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
    const gallery = url.pathname.match(/^\/g\/(\d+)\/([a-zA-Z0-9]+)\/?$/)
    const isGallery =
      ['e-hentai.org', 'exhentai.org'].includes(url.hostname) && !url.port && gallery
    return { url: url.href, bookId: isGallery ? `${gallery[1]}/${gallery[2]}` : undefined }
  } catch {
    return undefined
  }
}

/** 重建允许的正文节点，不继承源站属性、样式或可执行内容。 */
export function renderCommentHtml(html: string | undefined, plainText: string): string {
  const source = document.createElement('template')
  if (html === undefined) source.content.append(document.createTextNode(plainText))
  else source.innerHTML = html
  const output = document.createElement('div')
  const allowed = new Set([
    'BR',
    'P',
    'DIV',
    'SPAN',
    'STRONG',
    'B',
    'EM',
    'I',
    'U',
    'S',
    'DEL',
    'BLOCKQUOTE',
    'UL',
    'OL',
    'LI',
    'PRE',
    'CODE',
    'HR',
    'SUB',
    'SUP',
  ])
  const dropped = new Set([
    'SCRIPT',
    'STYLE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'TEMPLATE',
    'FORM',
    'INPUT',
    'BUTTON',
    'SELECT',
    'TEXTAREA',
  ])

  function appendNodes(sourceNode: Node, target: Node, insideLink = false) {
    for (const node of sourceNode.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (insideLink) {
          target.appendChild(document.createTextNode(text))
          continue
        }
        let offset = 0
        for (const match of text.matchAll(/https?:\/\/[^\s<>"'，。！？；）】]+/gi)) {
          const address = match[0].replace(/[.,;!?:)\]]+$/, '')
          const link = resolveCommentLink(address)
          if (!link) continue
          target.appendChild(document.createTextNode(text.slice(offset, match.index)))
          const anchor = document.createElement('a')
          anchor.href = link.url
          anchor.textContent = address
          target.appendChild(anchor)
          offset = match.index + address.length
        }
        target.appendChild(document.createTextNode(text.slice(offset)))
      } else if (node instanceof HTMLElement && !dropped.has(node.tagName)) {
        if (node.tagName === 'IMG') {
          // 外部图片不直接加载，保留替代文字及可复制的图片地址。
          const link = resolveCommentLink(node.getAttribute('src') ?? '')
          if (link && node.getAttribute('src')) {
            const anchor = document.createElement('a')
            anchor.href = link.url
            anchor.textContent = node.getAttribute('alt') || t('[图片链接]')
            target.appendChild(anchor)
          }
          continue
        }
        const link =
          node.tagName === 'A' && node.getAttribute('href')
            ? resolveCommentLink(node.getAttribute('href')!)
            : undefined
        const element = document.createElement(
          link ? 'a' : allowed.has(node.tagName) ? node.tagName.toLowerCase() : 'span',
        )
        if (link) element.setAttribute('href', link.url)
        appendNodes(node, element, insideLink || !!link)
        target.appendChild(element)
      }
    }
  }
  appendNodes(source.content, output)
  return output.innerHTML
}
