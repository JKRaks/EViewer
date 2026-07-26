import type {
  HentaiVerseAttribute,
  HentaiVerseBattleAction,
  HentaiVerseBattleMode,
  HentaiVerseBattleMonster,
  HentaiVerseBattleSnapshot,
  HentaiVerseEncounter,
  HentaiVerseFormAction,
  HentaiVerseFormBlock,
  HentaiVerseFormControl,
  HentaiVerseFormSection,
  HentaiVersePage,
  HentaiVersePageTarget,
  HentaiVersePersona,
} from './model/hentaiVerse'
import { getHentaiVerseSection } from './hentaiVerseProtocol'
import {
  decodeHentaiVerseGlyphs,
  getAttributeLabel,
  translateHentaiVerseText,
} from './hentaiVerseTranslations'

const parser = new DOMParser()

export function parseHentaiVersePage(html: string, target: HentaiVersePageTarget): HentaiVersePage {
  const document = parser.parseFromString(html, 'text/html')
  decodeHentaiVerseGlyphs(document)
  const bodyText = cleanText(document.body?.textContent)
  const authenticated = !/you must be logged on|requires you to log on|please log on/i.test(bodyText)
  const scriptText = Array.from(document.scripts, (script) => script.textContent || '').join('\n')
  const section = getHentaiVerseSection(target)
  const personaName = readScriptString(scriptText, 'current_persona_name')

  return {
    section,
    title: translateHentaiVerseText(document.querySelector('h1, #mainpane h2, title')?.textContent || 'HentaiVerse'),
    characterName: readCharacterName(document, personaName),
    personaName,
    authenticated,
    usableExperience: Number(matchValue(scriptText, /usable_exp\s*=\s*([0-9]+)/) || 0),
    metrics: parseMetrics(document, scriptText),
    attributes: parseAttributes(scriptText),
    personas: parsePersonas(document, personaName),
    forms: parseForms(document, section),
    notices: parseNotices(document),
  }
}

export function parseEncounterFromGalleryHtml(html: string): HentaiVerseEncounter | undefined {
  if (!html.includes('eventpane') || !html.includes('hentaiverse.org')) return
  const document = parser.parseFromString(html, 'text/html')
  const anchor = document.querySelector<HTMLAnchorElement>('#eventpane a[href*="hentaiverse.org"]')
  if (!anchor) return
  try {
    const url = new URL(anchor.href)
    const token = url.searchParams.get('encounter') || ''
    if (url.hostname !== 'hentaiverse.org' || !token) return
    return { url: url.href, token, foundAt: Date.now() }
  } catch {
    return
  }
}

export function parseBattlePage(html: string): HentaiVerseBattleSnapshot {
  const document = parser.parseFromString(html, 'text/html')
  decodeHentaiVerseGlyphs(document)
  const scripts = Array.from(document.scripts, (script) => script.textContent || '').join('\n')
  const token = readScriptString(scripts, 'battle_token') || matchValue(scripts, /battle_token\s*=\s*['"]([^'"]+)/)
  return parseBattleDocument(document, token)
}

export function isHentaiVerseBattleHtml(html: string) {
  return /battle_token\s*=/.test(html) || /id=["']pane_(?:battle|monster|completion)["']/.test(html)
}

export function parseBattleResponse(
  payload: Record<string, unknown>,
  previous: HentaiVerseBattleSnapshot,
): HentaiVerseBattleSnapshot {
  const document = parser.parseFromString('<!doctype html><body></body>', 'text/html')
  const paneNames = [
    'pane_completion',
    'pane_effects',
    'pane_action',
    'pane_vitals',
    'pane_quickbar',
    'table_skills',
    'table_magic',
    'pane_item',
    'pane_monster',
    'textlog',
  ]
  paneNames.forEach((name) => {
    const value = payload[name]
    if (typeof value !== 'string') return
    const wrapper = document.createElement(name.startsWith('table_') ? 'table' : 'div')
    wrapper.id = name
    wrapper.innerHTML = value
    document.body.appendChild(wrapper)
  })
  decodeHentaiVerseGlyphs(document)
  const parsed = parseBattleDocument(document, previous.token)
  return {
    ...previous,
    ...parsed,
    vitals: parsed.vitals.length ? parsed.vitals : previous.vitals,
    effects: parsed.effects.length ? parsed.effects : previous.effects,
    monsters: parsed.monsters.length ? parsed.monsters : previous.monsters,
    actions: parsed.actions.length ? parsed.actions : previous.actions,
    log: parsed.log.length ? parsed.log : previous.log,
  }
}

function parseAttributes(scriptText: string): HentaiVerseAttribute[] {
  const raw = matchValue(scriptText, /attr_current\s*=\s*(\{[^;]+\})/)
  let values: Record<string, number> = {}
  try {
    values = raw ? (JSON.parse(raw.replace(/'/g, '"')) as Record<string, number>) : {}
  } catch {
    values = Object.fromEntries(
      (['str', 'dex', 'agi', 'end', 'int', 'wis'] as const).map((key) => [
        key,
        Number(matchValue(raw, new RegExp(`["']?${key}["']?\\s*:\\s*(\\d+)`)) || 0),
      ]),
    )
  }
  return (['str', 'dex', 'agi', 'end', 'int', 'wis'] as const).map((key) => ({
    key,
    label: getAttributeLabel(key),
    value: Number(values[key] ?? 0),
    delta: 0,
  }))
}

function parseMetrics(document: Document, scriptText: string) {
  const metrics = new Map<string, string>()
  const scripted: Array<[string, string]> = [
    ['可用经验', 'usable_exp'],
    ['总经验', 'total_exp'],
  ]
  scripted.forEach(([label, key]) => {
    const value = matchValue(scriptText, new RegExp(`${key}\\s*=\\s*([0-9]+)`))
    if (value) metrics.set(label, Number(value).toLocaleString('zh-CN'))
  })
  document.querySelectorAll('tr, .fc2, .fc3, #pane_vitals > div').forEach((node) => {
    const text = cleanText(node.textContent)
    const match = text.match(/^(Level|Credits|Experience|Health|Magic|Spirit)\s*:?\s*(.+)$/i)
    if (match) metrics.set(translateHentaiVerseText(match[1] ?? ''), match[2] ?? '')
  })
  return Array.from(metrics, ([label, value]) => ({ label, value }))
}

function parsePersonas(document: Document, currentName: string): HentaiVersePersona[] {
  const personas = new Map<string, HentaiVersePersona>()
  document.querySelectorAll<HTMLOptionElement>('select[name="persona_set"] option').forEach((option) => {
    const name = cleanText(option.textContent)
    personas.set(option.value, { id: option.value, name, active: option.selected || name === currentName })
  })
  document.querySelectorAll<HTMLElement>('[data-persona], [onclick*="persona_set"]').forEach((node) => {
    const onclick = node.getAttribute('onclick') || ''
    const id = node.dataset.persona || matchValue(onclick, /persona_set[^0-9]*(\d+)/)
    const name = cleanText(node.textContent)
    if (id && name) personas.set(id, { id, name, active: name === currentName })
  })
  return Array.from(personas.values())
}

function parseForms(document: Document, pageSection: HentaiVersePage['section']): HentaiVerseFormBlock[] {
  return Array.from(document.forms).map((form, index) => {
    const controls: HentaiVerseFormControl[] = []
    const hidden: Record<string, string> = {}
    const actions: HentaiVerseFormAction[] = []
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      'input[name], select[name], textarea[name], button[name]',
    ).forEach((element) => parseFormElement(form, element, controls, hidden, actions))
    const heading = form.querySelector('h2, h3, legend') || findPreviousHeading(form)
    return {
      id: form.id || `hv-form-${index}`,
      title: translateHentaiVerseText(heading?.textContent || form.getAttribute('name') || '操作'),
      description: cleanText(form.querySelector('.fd4, .fc4, p')?.textContent),
      section: inferFormSection(pageSection, controls, hidden, actions),
      hidden,
      controls,
      actions: actions.length ? actions : [{ name: '', value: '', label: '提交' }],
    }
  }).filter((form) => form.controls.length || Object.keys(form.hidden).length || form.actions.length)
}

function parseFormElement(
  form: HTMLFormElement,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement,
  controls: HentaiVerseFormControl[],
  hidden: Record<string, string>,
  actions: HentaiVerseFormAction[],
) {
  const name = element.name
  if (!name) return
  if (element instanceof HTMLButtonElement || (element instanceof HTMLInputElement && ['submit', 'button'].includes(element.type))) {
    actions.push({
      name,
      value: element.value || '1',
      label: translateHentaiVerseText(element.textContent || element.value || name),
      danger: /reset|cancel|unequip|delete/i.test(`${name} ${element.value}`),
    })
    return
  }
  if (element instanceof HTMLInputElement && element.type === 'hidden') {
    hidden[name] = element.value
    return
  }
  const inputType = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase()
  const type = normalizeControlType(inputType)
  const value = element instanceof HTMLSelectElement
    ? element.value
    : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value
      : ''
  controls.push({
    name,
    label: readControlLabel(form, element, name),
    type,
    value,
    checked: element instanceof HTMLInputElement ? element.checked : undefined,
    options: element instanceof HTMLSelectElement
      ? Array.from(element.options, (option) => ({ label: translateHentaiVerseText(option.text), value: option.value, selected: option.selected }))
      : undefined,
    min: element instanceof HTMLInputElement && element.min ? Number(element.min) : undefined,
    max: element instanceof HTMLInputElement && element.max ? Number(element.max) : undefined,
    step: element instanceof HTMLInputElement && element.step ? Number(element.step) : undefined,
  })
}

function parseBattleDocument(document: Document, token: string): HentaiVerseBattleSnapshot {
  const completionText = cleanText(document.querySelector('#pane_completion')?.textContent)
  return {
    token,
    title: translateHentaiVerseText(document.querySelector('#pane_battle h1, h1, title')?.textContent || 'HentaiVerse 战斗'),
    vitals: readTextRows(document.querySelector('#pane_vitals')),
    effects: readTextRows(document.querySelector('#pane_effects')),
    monsters: parseMonsters(document),
    actions: parseBattleActions(document),
    log: readTextRows(document.querySelector('#textlog')).slice(-40),
    completed: Boolean(completionText),
    completionText,
  }
}

function parseMonsters(document: Document): HentaiVerseBattleMonster[] {
  const monsters = new Map<number, HentaiVerseBattleMonster>()
  document.querySelectorAll<HTMLElement>('#pane_monster [id], #pane_monster tr').forEach((node, index) => {
    const idText = node.id || node.getAttribute('data-mid') || ''
    const id = Number(matchValue(idText, /(\d+)/) || index + 1)
    const name = cleanText(node.querySelector('.btm3, .monstername, strong')?.textContent || node.textContent)
    if (!name || monsters.has(id)) return
    monsters.set(id, { id, name, status: cleanText(node.textContent), defeated: /dead|defeated|0%/i.test(node.className + node.textContent) })
  })
  return Array.from(monsters.values())
}

function parseBattleActions(document: Document): HentaiVerseBattleAction[] {
  const actions = new Map<string, HentaiVerseBattleAction>()
  document.querySelectorAll<HTMLElement>('[onclick]').forEach((node) => {
    const onclick = node.getAttribute('onclick') || ''
    const match = onclick.match(/battleaction\s*\(\s*['"](attack|magic|items|spirit|defend|focus)['"]\s*(?:,\s*(\d+))?/i)
    if (!match) return
    const mode = match[1]?.toLowerCase() as HentaiVerseBattleMode
    const skill = Number(match[2] || 0)
    const label = translateHentaiVerseText(cleanText(node.textContent) || mode)
    actions.set(`${mode}:${skill}`, { label, mode, skill })
  })
  ;(['attack', 'defend', 'focus', 'spirit'] as HentaiVerseBattleMode[]).forEach((mode) => {
    if (!actions.has(`${mode}:0`)) actions.set(`${mode}:0`, { label: translateHentaiVerseText(mode), mode, skill: 0 })
  })
  return Array.from(actions.values())
}

function inferFormSection(
  pageSection: HentaiVersePage['section'],
  controls: HentaiVerseFormControl[],
  hidden: Record<string, string>,
  actions: HentaiVerseFormAction[],
): HentaiVerseFormSection {
  const names = [...controls.map((item) => item.name), ...Object.keys(hidden), ...actions.map((item) => item.name)].join(' ')
  if (/persona_/.test(names)) return 'persona'
  if (pageSection === 'character') return 'character'
  return pageSection as HentaiVerseFormSection
}

function readControlLabel(form: HTMLFormElement, element: HTMLElement, fallback: string) {
  const explicit = 'labels' in element ? (element.labels as NodeListOf<HTMLLabelElement> | null)?.item(0) : null
  const wrappingLabel = element.closest('label')
  const rowLabel = element.closest('tr')?.querySelector('td:first-child, th:first-child')
  return translateHentaiVerseText(explicit?.textContent || wrappingLabel?.textContent || rowLabel?.textContent || element.getAttribute('title') || fallback.replace(/_/g, ' '))
}

function normalizeControlType(type: string): HentaiVerseFormControl['type'] {
  if (type === 'select') return 'select'
  if (type === 'textarea') return 'textarea'
  if (type === 'number') return 'number'
  if (type === 'password') return 'password'
  if (type === 'checkbox') return 'checkbox'
  if (type === 'radio') return 'radio'
  return 'text'
}

function parseNotices(document: Document) {
  return Array.from(document.querySelectorAll<HTMLElement>('.stuffbox, .fd4, .fc4, #messagebox'))
    .map((node) => cleanText(node.textContent))
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 8)
}

function readCharacterName(document: Document, personaName: string) {
  return cleanText(document.querySelector('#character_name, .charname, h1')?.textContent) || personaName || 'HentaiVerse'
}

function readScriptString(source: string, key: string) {
  return matchValue(source, new RegExp(`${key}\\s*=\\s*['"]([^'"]*)`))
}

function findPreviousHeading(element: Element) {
  let current = element.previousElementSibling
  while (current) {
    if (/^H[1-4]$/.test(current.tagName)) return current
    current = current.previousElementSibling
  }
  return null
}

function readTextRows(element?: Element | null) {
  if (!element) return []
  const rows = Array.from(element.querySelectorAll('tr, li, :scope > div'))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)
  return rows.length ? Array.from(new Set(rows)) : [cleanText(element.textContent)].filter(Boolean)
}

function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function matchValue(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1] || ''
}
