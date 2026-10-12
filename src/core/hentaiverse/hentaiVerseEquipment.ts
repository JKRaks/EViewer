import type { HentaiVerseEquipmentDetail } from './model/hentaiVerse'
import { translateHentaiVerseText } from './hentaiVerseTranslations'

const EQUIPMENT_SOURCE = /^\/dynjs\/\d{1,20}\/[a-zA-Z0-9_-]{1,64}\/equip-[1-9]\d{0,19}\.js$/

export function readEquipmentSources(document: Document): string[] {
  const sources = new Set<string>()
  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((script) => {
    try {
      const url = new URL(script.getAttribute('src') || '', 'https://hentaiverse.org')
      if (
        url.origin === 'https://hentaiverse.org' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        EQUIPMENT_SOURCE.test(url.pathname)
      )
        sources.add(url.pathname)
    } catch {
      // Ignore unrelated or malformed source assets.
    }
  })
  return [...sources]
}

function text(node: Element | null | undefined) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim()
}

function translate(value: string) {
  return translateHentaiVerseText(value)
    .replace(/([\d.]+%)\s+chance/gi, '触发概率 $1')
    .replace(/\((\d+) turns?\)/gi, '（持续 $1 回合）')
}

function metric(node: Element) {
  const children = [...node.children]
  if (children.length < 2) return
  const label = translate(text(children[0]))
  const value = children.slice(1).map(text).join('').trim().replace(/x$/, '×')
  if (!label || !value) return
  return {
    label,
    value,
    base: node.getAttribute('title')?.match(/\bBase:\s*([+-]?[\d,.]+)/i)?.[1],
  }
}

/** Read the source's JSON assignment without executing its JavaScript or rendering raw HTML. */
export function parseEquipmentData(script: string): Record<string, HentaiVerseEquipmentDetail> {
  const assignment = script.match(
    /^\s*(?:var|let|const)\s+dynjs_equip\s*=\s*(\{[\s\S]*\})\s*;?\s*$/,
  )?.[1]
  if (!assignment) throw new Error('无法读取源站装备属性数据')
  const raw: unknown = JSON.parse(assignment)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('源站装备属性数据格式不正确')
  const result: Record<string, HentaiVerseEquipmentDetail> = {}
  const parser = new DOMParser()
  for (const [id, entry] of Object.entries(raw)) {
    if (!/^\d{1,12}$/.test(id) || !entry || typeof entry !== 'object') continue
    const data = entry as { t?: unknown; d?: unknown }
    if (typeof data.d !== 'string' || typeof data.t !== 'string') continue
    const document = parser.parseFromString(data.d, 'text/html')
    document.querySelectorAll('script, style, iframe, object').forEach((node) => node.remove())
    const root = document.querySelector('.eq')
    if (!root) continue
    const groups: HentaiVerseEquipmentDetail['groups'] = []
    root.querySelectorAll(':scope > .ex, :scope > .ep').forEach((group) => {
      const rows = [...group.children]
      const title = group.classList.contains('ex') ? '装备属性' : translate(text(rows.shift()))
      const metrics = rows.flatMap((row) => {
        const parsed = metric(row)
        return parsed ? [parsed] : []
      })
      if (metrics.length) groups.push({ title, metrics })
    })
    const effects = [...root.children]
      .filter((node) => !node.matches('.eqt, .eqr, .eqc, .ex, .ep'))
      .map((node) => {
        const value = translate(text(node))
        const base = node.getAttribute('title')?.match(/\bBase:\s*([+-]?[\d,.]+)/i)?.[1]
        return base ? `${value}（基础值 ${base}）` : value
      })
      .filter(Boolean)
    result[id] = {
      id,
      name: translate(text(parser.parseFromString(data.t, 'text/html').body)),
      summary: translate(text(root.querySelector(':scope > .eqt'))),
      status: [...root.querySelectorAll(':scope > .eqr, :scope > .eqc')].map((node) =>
        translate(text(node)),
      ),
      effects,
      groups,
    }
  }
  return result
}
