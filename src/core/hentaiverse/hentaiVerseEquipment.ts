import {
  withTranslationCapture,
  withoutTranslationCapture,
  recordTranslationCandidate,
} from './hentaiVerseTranslationCapture'
import { formatSystemMessage, rememberSourceText } from '@/i18n'
import type { HentaiVerseEquipmentDetail } from './model/hentaiVerse'
import { translateHentaiVerseText } from './hentaiVerseTranslations'

const EQUIPMENT_SOURCE =
  /^\/(?:isekai\/)?dynjs\/\d{1,20}\/[a-zA-Z0-9_-]{1,64}\/equip-[1-9]\d{0,19}\.js$/

/** Pick meaningful comparison stats for each equipment family, independently of source row order. */
export function getEquipmentHighlights(detail: HentaiVerseEquipmentDetail) {
  const kind = `${detail.summary} ${detail.name}`
  const staff = /Staff|法杖/i.test(kind)
  const armor = /\b(?:Armor|Shield|Cloth|Light|Heavy)\b|布甲|轻甲|重甲|盾牌/i.test(kind)
  const offense = staff
    ? /Magic (?:Damage|Base Damage|Accuracy|Crit)|Spell (?:Damage|Crit)|魔法(?:伤害|命中|暴击)|(?:基础)?法术(?:伤害|暴击)/i
    : /Attack (?:Damage|Base Damage|Accuracy|Crit)|(?:Slashing|Crushing|Piercing|Void) Damage|物理(?:伤害|命中|暴击)|基础物理伤害|(?:斩击|打击|穿刺|虚空)伤害/i
  const defense =
    /(?:Physical|Magical|Phys\.|Mag\.) (?:Defense|Mitigation)|Block|Parry|Evade|Resist|物理防御|魔法防御|物理减伤|魔法减伤|格挡|招架|闪避|回避|抵抗/i
  const tradeoffs = /^(?:Burden|Interference|负重|干涉)$/i
  const affinity =
    /(?:Proficiency|熟练度|Spell Damage|法术伤害加成|(?:Fire|Cold|Elec|Wind|Holy|Dark) Damage|(?:火焰|冰冷|雷电|风|神圣|黑暗)伤害)/i
  return detail.groups.flatMap((group) =>
    group.metrics
      .filter((metric) => {
        if (tradeoffs.test(metric.label)) return !/^[+-]?0(?:\.0+)?%?$/.test(metric.value.trim())
        const mitigation = /Mitigation|伤害减免|减伤/i.test(group.title)
        const affinityGroup = /Proficiency|Spell Damage|熟练度|法术伤害/i.test(group.title)
        if (armor)
          return (
            defense.test(metric.label) || mitigation || affinity.test(metric.label) || affinityGroup
          )
        return (
          offense.test(metric.label) ||
          defense.test(metric.label) ||
          (staff && (affinity.test(metric.label) || affinityGroup))
        )
      })
      .map((metric) => ({ ...metric, group: group.title })),
  )
}

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
  const translated = withoutTranslationCapture(() => translateHentaiVerseText(value))
    .replace(/([\d.]+%)\s+chance/gi, '触发概率 $1')
    .replace(/\((\d+) turns?\)/gi, '（持续 $1 回合）')
  recordTranslationCandidate('description', value, translated)
  return rememberSourceText(translated, value)
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

/** Read an equipment tooltip shared by dynamic equipment data and inline source panels. */
export function parseEquipmentElement(
  root: Element,
  id: string,
  name: string,
): HentaiVerseEquipmentDetail {
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
    .filter((node) => !node.matches('.eqt, .eqr, .eqc, .ex, .ep, script, style, iframe, object'))
    .map((node) => {
      const value = translate(text(node))
      const base = node.getAttribute('title')?.match(/\bBase:\s*([+-]?[\d,.]+)/i)?.[1]
      return base ? formatSystemMessage('{p0}（基础值 {p1}）', { p0: value, p1: base }) : value
    })
    .filter(Boolean)
  return {
    id,
    name: translate(name),
    summary: translate(text(root.querySelector(':scope > .eqt'))),
    status: [...root.querySelectorAll(':scope > .eqr, :scope > .eqc')].map((node) =>
      translate(text(node)),
    ),
    effects,
    groups,
  }
}

/** Read the source's JSON assignment without executing its JavaScript or rendering raw HTML. */
export function parseEquipmentData(script: string): Record<string, HentaiVerseEquipmentDetail> {
  return withTranslationCapture('equipment', '', () => {
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
      result[id] = parseEquipmentElement(
        root,
        id,
        text(parser.parseFromString(data.t, 'text/html').body),
      )
    }
    return result
  })
}
