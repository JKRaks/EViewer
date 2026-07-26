import type {
  HentaiVerseAttribute,
  HentaiVerseBattleAction,
  HentaiVerseBattleMode,
  HentaiVerseBattleMonster,
  HentaiVerseBattleSnapshot,
  HentaiVerseEncounter,
  HentaiVerseAbility,
  HentaiVerseAbilityActionName,
  HentaiVerseAbilityPage,
  HentaiVerseAbilitySlot,
  HentaiVerseAbilityTree,
  HentaiVerseEquipmentCandidate,
  HentaiVerseEquipmentPage,
  HentaiVerseEquipmentSet,
  HentaiVerseEquipmentSlot,
  HentaiVerseFormAction,
  HentaiVerseFormBlock,
  HentaiVerseFormControl,
  HentaiVerseFormSection,
  HentaiVersePage,
  HentaiVersePageTarget,
  HentaiVersePersona,
  HentaiVerseTrainingPage,
  HentaiVerseTrainingOption,
  HentaiVerseInventoryItem,
  HentaiVerseInventoryPage,
  HentaiVerseInventorySlot,
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
  const authenticated = !/you (?:must|have to) (?:be logged on|log on)|requires you to log on|please log on|log on with an EH account/i.test(bodyText)
  const scriptText = Array.from(document.scripts, (script) => script.textContent || '').join('\n')
  const section = getHentaiVerseSection(target)
  const personaName = readScriptString(scriptText, 'current_persona_name')
  const equipment = section === 'equipment' ? parseEquipment(document, scriptText, target) : undefined
  const abilities = section === 'abilities' ? parseAbilities(document, scriptText, target) : undefined
  const training = section === 'training' ? parseTraining(document) : undefined
  const inventory = section === 'inventory' ? parseInventory(document) : undefined

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
    equipment,
    abilities,
    training,
    inventory,
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

function parseEquipment(
  document: Document,
  scriptText: string,
  target: HentaiVersePageTarget,
): HentaiVerseEquipmentPage {
  const selectedSlot = target.equip_slot || readNamedValue(document.body?.innerHTML || '', 'equip_slot')
  const sets = new Map<string, HentaiVerseEquipmentSet>()
  document.querySelectorAll<HTMLElement>(
    'select[name="equip_set"] option, [data-equip-set], [onclick*="equip_set"], a[href*="equip_set="]',
  ).forEach((node, index) => {
    const option = node instanceof HTMLOptionElement ? node : undefined
    const source = getActionSource(node)
    const id = option?.value || node.dataset.equipSet || readNamedValue(source, 'equip_set') || String(index + 1)
    const label = readNodeLabel(node) || `套装 ${id}`
    sets.set(id, {
      id,
      label,
      active: Boolean(option?.selected || node.matches('.active, .selected, [aria-current="true"]')),
    })
  })

  const slots = new Map<string, HentaiVerseEquipmentSlot>()
  document.querySelectorAll<HTMLElement>(
    '#eqch_outer [data-equip-slot], #eqch_outer [id*="equip_slot"], #eqch_outer a[href*="equip_slot="], [onclick*="equip_slot"]',
  ).forEach((node) => {
    const source = getActionSource(node)
    const id = node.dataset.equipSlot || readNamedValue(source, 'equip_slot') || matchValue(node.id, /equip_slot[_-]?(\d+)/i)
    if (!id) return
    const equipmentId = readEquipmentId(node)
    const equipmentName = readNodeLabel(node)
    slots.set(id, {
      id,
      label: readEquipmentSlotLabel(id, node),
      equipmentId,
      equipmentName: equipmentName && equipmentName !== readEquipmentSlotLabel(id, node) ? equipmentName : '',
      description: cleanText(node.getAttribute('title') || node.dataset.description),
      active: id === selectedSlot || node.matches('.active, .selected, [aria-current="true"]'),
    })
  })

  const candidates = new Map<string, HentaiVerseEquipmentCandidate>()
  document.querySelectorAll<HTMLElement>(
    '#equiplist tr, .equiplist tr, #eqch_outer [data-eid], #eqch_outer [id^="e"][onclick]',
  ).forEach((node) => {
    const id = readEquipmentId(node)
    const name = readEquipmentName(node)
    if (!id || !name) return
    const rowText = cleanText(node.textContent)
    candidates.set(id, {
      id,
      name,
      description: cleanText(node.getAttribute('title') || node.dataset.description || rowText.replace(name, '')),
      locked: node.dataset.locked === '1' || /(?:^|\s)(?:locked|il)(?:\s|$)/i.test(node.className),
      equipped: node.dataset.equipped === '1' || /equipped|current/i.test(`${node.className} ${rowText}`),
    })
  })

  const postToken = document.querySelector<HTMLInputElement>('input[name="postoken"]')?.value
    || readScriptString(scriptText, 'postoken')
    || matchValue(scriptText, /postoken\s*[:=]\s*['"]([^'"]+)/i)
  return {
    sets: Array.from(sets.values()),
    slots: Array.from(slots.values()),
    candidates: Array.from(candidates.values()),
    selectedSlot,
    postToken,
  }
}

function parseAbilities(
  document: Document,
  scriptText: string,
  target: HentaiVersePageTarget,
): HentaiVerseAbilityPage {
  const trees = new Map<string, HentaiVerseAbilityTree>()
  document.querySelectorAll<HTMLElement>(
    '#ability_treelist > div, #ability_treelist a, [data-ability-tree], a[href*="tree="]',
  ).forEach((node, index) => {
    const source = getActionSource(node)
    const id = node.dataset.abilityTree || node.dataset.tree || readNamedValue(source, 'tree')
      || matchValue(`${node.id} ${source}`, /(?:ability_)?tree[_-]?([a-z0-9]+)/i)
      || String(index)
    const label = readNodeLabel(node)
    if (!label) return
    trees.set(id, {
      id,
      label,
      active: id === target.tree || node.matches('.active, .selected, [aria-current="true"]') || /f[24][lr]a/.test(node.className),
    })
  })

  const abilities: HentaiVerseAbility[] = []
  document.querySelectorAll<HTMLElement>('#ability_treepane > div').forEach((row) => {
    const source = getActionSource(row, true)
    const parsedAction = readAbilityAction(source)
    const id = row.dataset.abilityId || row.dataset.ability || parsedAction?.value
      || matchValue(row.id, /(?:ability|ab)[_-]?(\d+)/i)
      || matchValue(row.querySelector<HTMLImageElement>('img[src*="/a/"]')?.src || '', /\/a\/(\d+)/i)
    const nameNode = row.querySelector<HTMLElement>(':scope > div:first-child, [data-ability-name], .ability-name')
    const name = readNodeLabel(nameNode || row)
    if (!id || !name) return
    const levelText = cleanText(row.dataset.level || row.querySelector<HTMLElement>('[data-level], .ability-level')?.textContent)
    const levelMatch = levelText.match(/(\d+)\s*\/\s*(\d+)/)
    const maxLevel = Number(row.dataset.maxLevel || levelMatch?.[2] || row.querySelector(':scope > div:nth-child(3)')?.children.length || 0)
    const level = Number(row.dataset.level || levelMatch?.[1] || countActiveAbilityLevels(row))
    const actionNode = row.querySelector<HTMLElement>('[onclick*="unlock_ability"], [onclick*="reset_ability"], [data-action]')
    abilities.push({
      id,
      name,
      description: cleanText(row.dataset.description || row.getAttribute('title') || row.querySelector<HTMLElement>('.ability-description')?.textContent),
      level,
      maxLevel,
      cost: cleanText(row.dataset.cost || row.querySelector(':scope > div:nth-child(4)')?.textContent),
      action: parsedAction?.name,
      actionLabel: parsedAction ? readNodeLabel(actionNode || row.querySelector<HTMLElement>(':scope > div:last-child') || row) : undefined,
      disabled: !parsedAction || Boolean(actionNode?.matches('.disabled, [aria-disabled="true"]')),
    })
  })

  const slots: HentaiVerseAbilitySlot[] = []
  document.querySelectorAll<HTMLElement>('.ability_slotbar > div, .ability_slotbox > div').forEach((node, index) => {
    const source = getActionSource(node, true)
    const action = readAbilityAction(source)
    const id = node.dataset.slot || node.dataset.abilitySlot || readNamedValue(source, 'equip_slot')
      || readNamedValue(source, 'unlock_slot') || String(index + 1)
    const abilityId = node.dataset.abilityId || readNamedValue(source, 'equip_ability')
      || matchValue(node.querySelector<HTMLImageElement>('img[src*="/a/"]')?.src || '', /\/a\/(\d+)/i)
    const abilityName = readNodeLabel(node)
    const locked = action?.name === 'unlock_slot' || node.matches('.locked, .disabled, [aria-disabled="true"]')
    slots.push({
      id,
      label: `槽位 ${Number(id) || index + 1}`,
      abilityId,
      abilityName: locked ? '' : abilityName,
      locked,
      action: action?.name,
    })
  })

  const topText = cleanText(document.querySelector('#ability_top')?.textContent)
  const abilityPoints = matchValue(topText, /Ability Points?\s*:?\s*([\d,]+)/i)
    || matchValue(scriptText, /(?:ability_points|available_ap)\s*[:=]\s*['"]?([\d,]+)/i)
  return {
    trees: Array.from(trees.values()),
    abilities,
    slots,
    selectedTree: target.tree || Array.from(trees.values()).find((tree) => tree.active)?.id || '',
    abilityPoints,
    canResetAll: Boolean(document.querySelector('[name="reset_all"], [onclick*="reset_all"]')),
  }
}

function parseTraining(document: Document): HentaiVerseTrainingPage {
  const progressPane = document.querySelector<HTMLElement>('#train_progress')
  const progress = cleanText(document.querySelector('#train_progcnt')?.textContent)
  const progressText = cleanText(progressPane?.textContent)
  const options: HentaiVerseTrainingOption[] = []
  document.querySelectorAll<HTMLElement>('#train_table tr').forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
    const source = getActionSource(row, true)
    const id = readNamedValue(source, 'start_train')
    if (!id || !cells[0]) return
    options.push({
      id,
      name: translateHentaiVerseText(cells[0]),
      description: cells[1] || '',
      level: cells[2] || '',
      cost: cells[3] || cells[4] || '',
      duration: cells[5] || cells[6] || '',
      canStart: !row.matches('.disabled, [aria-disabled="true"]') && !/unavailable|locked/i.test(row.className),
    })
  })
  return {
    activeName: cleanText(progressPane?.querySelector(':scope > div:nth-child(3)')?.textContent),
    progress,
    remaining: matchValue(progressText, /(?:Remaining|Time Left)\s*:?\s*(.+)$/i),
    canCancel: Boolean(document.querySelector('[name="cancel_train"], [onclick*="cancel_training"]')),
    options,
  }
}

function parseInventory(document: Document): HentaiVerseInventoryPage {
  const items = new Map<string, HentaiVerseInventoryItem>()
  document.querySelectorAll<HTMLElement>('#item_list tr, #item_list [data-item], .itemlist tr').forEach((row) => {
    const source = getActionSource(row, true)
    const id = row.dataset.item || readNamedValue(source, 'item') || matchValue(`${row.id} ${source}`, /(?:item|set_item)[_(\s'"-]*(\d+)/i)
    const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
    const name = readNodeLabel(row.querySelector<HTMLElement>('[data-item-name], td:first-child') || row)
    if (!id || !name) return
    items.set(id, {
      id,
      name,
      description: cleanText(row.getAttribute('title') || row.dataset.description || cells.slice(1, -1).join(' ')),
      quantity: cells.at(-1) || row.dataset.quantity || '',
      selected: row.matches('.active, .selected, [aria-current="true"]'),
    })
  })

  const slots: HentaiVerseInventorySlot[] = []
  document.querySelectorAll<HTMLElement>('#item_slots [data-slot], #item_slots [onclick], #item_slots > div > div').forEach((node, index) => {
    const source = getActionSource(node, true)
    const id = node.dataset.slot || readNamedValue(source, 'slot') || String(index + 1)
    const itemId = node.dataset.item || readNamedValue(source, 'item')
    const itemName = readNodeLabel(node)
    if (!itemId && !itemName) return
    slots.push({ id, label: `槽位 ${Number(id) || index + 1}`, itemId, itemName })
  })
  return { items: Array.from(items.values()), slots }
}

function parseForms(document: Document, pageSection: HentaiVersePage['section']): HentaiVerseFormBlock[] {
  if (['equipment', 'abilities', 'training', 'inventory'].includes(pageSection)) return []
  return Array.from(document.forms).map((form, index) => {
    const controls: HentaiVerseFormControl[] = []
    const hidden: Record<string, string> = {}
    const actions: HentaiVerseFormAction[] = []
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      'input[name], input[type="submit"], input[type="button"], select[name], textarea[name], button',
    ).forEach((element) => parseFormElement(form, element, controls, hidden, actions))
    if (!actions.length) {
      const clickAction = form.querySelector<HTMLElement>('[onclick*=".submit"], [onclick*="submit()"]')
      const label = readNodeLabel(clickAction)
      if (label) actions.push({ name: '', value: '', label })
    }
    const heading = form.querySelector('h2, h3, legend') || findPreviousHeading(form)
    return {
      id: form.id || `hv-form-${index}`,
      title: translateHentaiVerseText(heading?.textContent || form.getAttribute('name') || '操作'),
      description: cleanText(form.querySelector('.fd4, .fc4, p')?.textContent),
      section: inferFormSection(pageSection, controls, hidden, actions),
      hidden,
      controls,
      actions,
    }
  }).filter((form) => form.controls.length || form.actions.length)
}

function parseFormElement(
  form: HTMLFormElement,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement,
  controls: HentaiVerseFormControl[],
  hidden: Record<string, string>,
  actions: HentaiVerseFormAction[],
) {
  const name = element.name
  if (element instanceof HTMLButtonElement || (element instanceof HTMLInputElement && ['submit', 'button'].includes(element.type))) {
    const label = translateHentaiVerseText(element.textContent || element.value || name)
    if (!label) return
    actions.push({
      name,
      value: element.value || '1',
      label,
      danger: /reset|cancel|unequip|delete/i.test(`${name} ${element.value}`),
    })
    return
  }
  if (!name) return
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
  return Array.from(document.querySelectorAll<HTMLElement>(
    '.stuffbox, #messagebox, #message_box, [role="alert"], .notice, .errorbox',
  ))
    .map((node) => cleanText(node.textContent))
    .filter((value, index, values) => value && value.length <= 500 && values.indexOf(value) === index)
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

function getActionSource(node: HTMLElement, includeChildren = false) {
  const nodes = includeChildren
    ? [node, ...Array.from(node.querySelectorAll<HTMLElement>('[onclick], a[href], input[name], button[name], select[name]'))]
    : [node]
  return nodes.map((item) => [
    item.id,
    item.getAttribute('onclick'),
    item.getAttribute('href'),
    item.getAttribute('name') && `${item.getAttribute('name')}=${item.getAttribute('value') || ''}`,
    ...Object.entries(item.dataset).flat(),
  ].filter(Boolean).join(' ')).join(' ')
}

function readNamedValue(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`[?&]${escaped}=([^&#'"\\s)]+)`, 'i'),
    new RegExp(`${escaped}\\s*\\(\\s*['"]?([a-z0-9_-]+)`, 'i'),
    new RegExp(`${escaped}\\s*[:=,]\\s*['"]?([a-z0-9_-]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const value = matchValue(source, pattern)
    if (value) {
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
  return ''
}

function readNodeLabel(node?: HTMLElement | null) {
  if (!node) return ''
  const image = node.querySelector<HTMLImageElement>('img[alt], img[title]')
  return translateHentaiVerseText(cleanText(
    node.dataset.label
    || node.getAttribute('aria-label')
    || node.getAttribute('title')
    || image?.alt
    || image?.title
    || node.textContent,
  ))
}

function readEquipmentId(node: HTMLElement) {
  const source = getActionSource(node, true)
  return node.dataset.eid || node.dataset.equipId
    || readNamedValue(source, 'equip_id')
    || matchValue(source, /equips?\.set\s*\(\s*(\d+)/i)
    || matchValue(node.id, /^e(\d+)$/i)
}

function readEquipmentName(node: HTMLElement) {
  const nameNode = node.querySelector<HTMLElement>('[data-equip-name], .equip-name, td:first-child')
  return readNodeLabel(nameNode || node)
}

function readEquipmentSlotLabel(id: string, node: HTMLElement) {
  const explicit = cleanText(node.dataset.slotLabel || node.getAttribute('aria-label') || node.getAttribute('title'))
  if (explicit) return translateHentaiVerseText(explicit)
  const labels = ['武器', '副手', '头部', '身体', '手部', '腿部', '脚部']
  return labels[Number(id)] || `部位 ${id}`
}

function readAbilityAction(source: string): { name: HentaiVerseAbilityActionName; value: string } | undefined {
  const names: HentaiVerseAbilityActionName[] = ['unlock_ability', 'reset_ability', 'unlock_slot', 'equip_ability']
  for (const name of names) {
    const value = readNamedValue(source, name)
    if (value) return { name, value }
  }
  return
}

function countActiveAbilityLevels(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>(':scope > div:nth-child(3) > div'))
    .filter((node) => !node.matches('.disabled, .locked, [aria-disabled="true"]') && node.style.opacity !== '0.3')
    .length
}

function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function matchValue(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1] || ''
}
