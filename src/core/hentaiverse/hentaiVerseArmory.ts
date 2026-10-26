import type {
  HentaiVerseEquipmentDetail,
  HentaiVerseFormData,
  HentaiVersePageTarget,
} from './model/hentaiVerse'
import { parseEquipmentData, readEquipmentSources } from './hentaiVerseEquipment'
import {
  translateHentaiVerseDescription,
  translateHentaiVerseText,
} from './hentaiVerseTranslations'

export const HENTAIVERSE_ARMORY_SCREENS = [
  'organize',
  'modify',
  'repair',
  'soulbind',
  'purchase',
  'sell',
  'salvage',
] as const
export type HentaiVerseArmoryScreen = (typeof HENTAIVERSE_ARMORY_SCREENS)[number]
export interface ArmoryLink {
  label: string
  query: Record<string, string>
  active: boolean
}
export interface ArmoryMaterial {
  id: string
  name: string
  count: number
  owned: number
}
export interface ArmoryEquipment {
  id: string
  name: string
  category: string
  status: string
  disabled: boolean
  protected: boolean
  credits: number
  materials: ArmoryMaterial[]
}
export interface ArmoryControl {
  name: string
  label: string
  type: string
  value: string
  checked: boolean
  disabled: boolean
  options: Array<{ label: string; value: string; cp?: number; disabled?: boolean; help?: string }>
}
export interface ArmoryAction {
  name: string
  value: string
  label: string
  disabled: boolean
  help: string
  confirmation: string[]
  hidden: HentaiVerseFormData
  charm?: boolean
  blockedReason?: string
}
export interface ArmoryCharmState {
  slot: number
  maxCp: number
  otherCp: number
  currentCharm: number
  currentPouch: number
  worn: boolean
  torn: boolean
  pouchBroken: boolean
  charmMaterials: Record<string, Record<string, { c: number; n: string }>>
  pouchMaterials: Record<string, Record<string, { c: number; n: string }>>
}
export interface HentaiVerseArmoryPage {
  screen: HentaiVerseArmoryScreen
  tabs: ArmoryLink[]
  filters: ArmoryLink[]
  equipment: ArmoryEquipment[]
  selectedId: string
  equipmentSources: string[]
  inlineDetails: Record<string, HentaiVerseEquipmentDetail>
  hidden: HentaiVerseFormData
  controls: ArmoryControl[]
  actions: ArmoryAction[]
  descriptions: string[]
  balance: number
  modify: boolean
  sections: Array<{ title: string; lines: string[] }>
  modificationLinks: ArmoryLink[]
  charm?: ArmoryCharmState
}

const text = (node?: Element | null) => (node?.textContent || '').replace(/\s+/g, ' ').trim()
const translated = (value: string) => translateHentaiVerseText(value)

/** Only decode JSON data assignments; never evaluate source JavaScript. */
export function readArmoryJson(script: string, name: string): unknown {
  const match = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(script)
  if (!match) return undefined
  const start = match.index + match[0].length
  if (!['{', '['].includes(script[start] || '')) return undefined
  let depth = 0,
    quoted = false,
    escaped = false
  for (let index = start; index < script.length; index++) {
    const char = script[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') {
      depth--
      if (!depth) {
        try {
          return JSON.parse(script.slice(start, index + 1))
        } catch {
          return undefined
        }
      }
    }
  }
}

function readLinks(
  document: Document,
  selector: string,
  world?: HentaiVersePageTarget['world'],
): ArmoryLink[] {
  return [...document.querySelectorAll<HTMLAnchorElement>(selector)].flatMap((node) => {
    const url = new URL(
      node.getAttribute('href') || '',
      world === 'isekai' ? 'https://hentaiverse.org/isekai/' : 'https://hentaiverse.org/',
    )
    if (
      url.origin !== 'https://hentaiverse.org' ||
      !['/', '/isekai/'].includes(url.pathname) ||
      url.searchParams.get('s') !== 'Bazaar' ||
      url.searchParams.get('ss') !== 'am'
    )
      return []
    return [
      {
        label: translated(text(node)),
        query: {
          ...Object.fromEntries(url.searchParams),
          world: url.pathname === '/isekai/' ? 'isekai' : 'persistent',
        },
        active: !!node.querySelector('.armory_cur, .cfbs'),
      },
    ]
  })
}

function readArmoryControls(form: HTMLFormElement): ArmoryControl[] {
  const controls = new Map<string, ArmoryControl>()
  form
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('input[name]:not([type=hidden]):not([type=submit]),select[name]')
    .forEach((node) => {
      if (node.name === 'eqids[]') return
      const input = node as HTMLInputElement
      const radio = input.type === 'radio'
      const label = text(node.closest('label')) || node.name
      const choice = {
        value: node.value,
        label: translated(node.getAttribute('data-name') || label),
        cp: node.hasAttribute('data-cp') ? Number(node.getAttribute('data-cp')) : undefined,
        disabled: node.disabled || !!node.getAttribute('data-disabled'),
        help: translateHentaiVerseDescription(node.getAttribute('data-disabled') || ''),
      }
      const existing = controls.get(node.name)
      if (radio && existing) {
        existing.options.push(choice)
        existing.disabled = existing.disabled && node.disabled
        if (input.checked) existing.value = input.value
        return
      }
      const options =
        node.tagName === 'SELECT'
          ? [...(node as HTMLSelectElement).options].map((o) => ({
              label: translated(o.text),
              value: o.value,
            }))
          : radio
            ? [choice]
            : []
      controls.set(node.name, {
        name: node.name,
        label: translated(label),
        type: radio ? 'select' : input.type || 'select',
        value: node.value,
        checked: !!input.checked,
        disabled: node.disabled,
        options,
      })
    })
  const labels: Record<string, string> = {
    set_pinned: '置顶',
    set_stored: '存放',
    set_locked: '保护状态',
  }
  for (const control of controls.values()) {
    if (labels[control.name]) {
      control.label = labels[control.name]!
      control.options.forEach((o) => {
        o.label =
          (
            {
              '0': '保持不变',
              '-1': '清除',
              '1': control.name === 'set_locked' ? '保护' : '启用',
              '2': '锁定',
            } as Record<string, string>
          )[o.value] || o.value
      })
    }
  }
  return [...controls.values()]
}

function readModifyActions(form: HTMLFormElement, script: string): ArmoryAction[] {
  return [
    ...form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button[type=submit],input[type=submit]',
    ),
  ].map((button) => {
    const handler = button.getAttribute('onclick')?.match(/^\s*([a-zA-Z_][\w]*)\s*\(/)?.[1]
    const functionBody = handler
      ? script.match(
          new RegExp(`function\\s+${handler}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`),
        )?.[1] || ''
      : ''
    const template = functionBody.match(/innerHTML\s*=\s*`([\s\S]*?)`/)?.[1] || ''
    const confirmationDocument = new DOMParser().parseFromString(template, 'text/html')
    const confirmButton =
      confirmationDocument.querySelector<HTMLButtonElement>('button[type=submit]')
    const hidden: HentaiVerseFormData = {}
    confirmationDocument
      .querySelectorAll<HTMLInputElement>('input[type=hidden][name]')
      .forEach((node) => {
        hidden[node.name] = node.value
      })
    // These handlers create submit buttons in the official hveqc.js. Their action
    // values are fixed; all source availability/disabled checks remain in force.
    const handlerActions: Record<string, string> = {
      pop_upgrade: 'upgrade',
      pop_unequip: 'unequip',
      pop_rename: 'rename',
      pop_setcharm: 'setcharm',
    }
    const actionValue = handler ? handlerActions[handler] : undefined
    return {
      name: confirmButton?.name || button.name || (actionValue ? 'action' : ''),
      value: confirmButton?.value || button.value || actionValue || '',
      label: translated(button.tagName === 'INPUT' ? button.value : text(button)),
      disabled:
        button.disabled ||
        !!confirmButton?.disabled ||
        (!!handler && !confirmButton && !actionValue && button.name !== 'action'),
      help: translateHentaiVerseDescription(confirmButton?.title || button.title || ''),
      confirmation: [...confirmationDocument.querySelectorAll('p, tr')]
        .map((n) => translateHentaiVerseDescription(text(n)))
        .filter(Boolean),
      hidden,
      charm: handler === 'pop_setcharm' || button.id === 'setcharm',
      blockedReason:
        button.disabled && button.title ? translateHentaiVerseDescription(button.title) : '',
    }
  })
}

/** Scalar names and material shapes are defined by the source's hveqc.js. */
function readArmoryCharmState(script: string): ArmoryCharmState | undefined {
  const scalar = (name: string) => {
    const raw = script.match(
      new RegExp(
        `(?:\\b(?:const|let|var)\\s+|,\\s*)${name}\\s*=\\s*(true|false|\\d+)\\s*(?=[;,\\n])`,
      ),
    )?.[1]
    return raw === undefined ? undefined : raw === 'true' ? 1 : raw === 'false' ? 0 : Number(raw)
  }
  const names = [
    'charmslot',
    'max_cp',
    'exl_cp',
    'cur_charmtype',
    'cur_pouchtype',
    'cur_charm_worn',
    'cur_charm_broken',
    'cur_pouch_broken',
  ]
  const values = names.map(scalar)
  if (values.some((value) => value === undefined)) return undefined
  const charmMaterials = readArmoryJson(script, 'charm_mats')
  const pouchMaterials = readArmoryJson(script, 'pouch_mats')
  if (
    !charmMaterials ||
    typeof charmMaterials !== 'object' ||
    !pouchMaterials ||
    typeof pouchMaterials !== 'object'
  )
    return undefined
  return {
    slot: values[0]!,
    maxCp: values[1]!,
    otherCp: values[2]!,
    currentCharm: values[3]!,
    currentPouch: values[4]!,
    worn: !!values[5],
    torn: !!values[6],
    pouchBroken: !!values[7],
    charmMaterials: charmMaterials as ArmoryCharmState['charmMaterials'],
    pouchMaterials: pouchMaterials as ArmoryCharmState['pouchMaterials'],
  }
}

export function getArmoryCharmSelection(
  data: HentaiVerseArmoryPage,
  values: Record<string, string>,
) {
  const state = data.charm
  const charm = data.controls
    .find((control) => control.name === 'charmtype')
    ?.options.find((option) => option.value === values.charmtype)
  const pouch = data.controls
    .find((control) => control.name === 'pouchtype')
    ?.options.find((option) => option.value === values.pouchtype)
  if (!state || !charm || !pouch || !Number.isFinite(charm.cp) || !Number.isFinite(pouch.cp))
    return undefined
  const charmId = Number(charm.value),
    pouchId = Number(pouch.value)
  if (!Number.isInteger(charmId) || !Number.isInteger(pouchId)) return undefined
  const usedCp = state.otherCp + charm.cp! + pouch.cp!
  const changed =
    state.worn ||
    state.torn ||
    state.pouchBroken ||
    state.currentCharm !== charmId ||
    (charmId > 0 && state.currentPouch !== pouchId)
  const reason =
    charmId > 0
      ? charm.help ||
        pouch.help ||
        (charm.disabled || pouch.disabled ? '所选护符或护符袋不可用' : '') ||
        (usedCp > state.maxCp ? '护符点数不足' : '')
      : ''
  const requirements: Array<{ name: string; count: number }> = []
  const appendMaterials = (items: Record<string, { c: number; n: string }> | undefined) => {
    for (const entry of Object.values(items || {})) {
      if (typeof entry.n === 'string' && Number.isFinite(entry.c))
        requirements.push({ name: translated(entry.n), count: entry.c })
    }
  }
  if (state.worn || state.torn || state.currentCharm !== charmId)
    appendMaterials(state.charmMaterials[String(charmId)])
  if ((!state.torn || pouchId > 0) && (state.pouchBroken || state.currentPouch !== pouchId))
    appendMaterials(state.pouchMaterials[String(pouchId)])
  return {
    slot: state.slot,
    usedCp,
    maxCp: state.maxCp,
    allowed: !!changed && !reason,
    reason,
    requirements,
    charmName: charm.label,
    pouchName: pouch.label,
    destroysCharm:
      charmId === 0 ||
      (state.currentCharm > 0 && state.currentCharm !== charmId && !state.worn && !state.torn),
    destroysPouch:
      charmId === 0 ||
      (state.currentCharm > 0 && !state.pouchBroken && state.currentPouch !== pouchId),
  }
}

export function isHentaiVerseArmoryDocument(document: Document) {
  return (
    !!document.querySelector('#armory_outer #armory_left') &&
    !!document.querySelector('#armory_right #equipform')
  )
}

export function parseHentaiVerseArmory(
  document: Document,
  target: HentaiVersePageTarget,
): HentaiVerseArmoryPage {
  if (!isHentaiVerseArmoryDocument(document)) throw new Error('无法识别源站装备库页面')
  const form = document.querySelector<HTMLFormElement>('#equipform')!
  const script = [...document.scripts]
    .filter((s) => !s.src)
    .map((s) => s.textContent || '')
    .join('\n')
  const tabs = readLinks(document, '#armory_left a', target.world),
    filters = readLinks(document, '#filterbar a', target.world)
  const screen = tabs.find((tab) => tab.active)?.query.screen || 'organize'
  if (!HENTAIVERSE_ARMORY_SCREENS.includes(screen as HentaiVerseArmoryScreen))
    throw new Error('未知的装备库页面')
  const rawItems = (readArmoryJson(script, 'eqitems') || {}) as Record<
    string,
    { c?: number; m?: Record<string, number> }
  >
  const items = (readArmoryJson(script, 'itemdata') || {}) as Record<
    string,
    { n: string; c: number }
  >
  let category = ''
  const equipment: ArmoryEquipment[] = []
  form.querySelectorAll('#equiplist tr').forEach((row) => {
    if (row.classList.contains('eqtplabel')) {
      category = translated(text(row))
      return
    }
    const input = row.querySelector<HTMLInputElement>('input[name="eqids[]"]')
    if (!input || !/^\d+$/.test(input.value)) return
    const raw = rawItems[input.value]
    const protectedEquipment = row.hasAttribute('data-eqprotect') || /🛡/.test(text(row))
    equipment.push({
      id: input.value,
      name: translated(text(input.closest('label'))),
      category,
      status: translated(text(row.children[1])),
      disabled: input.disabled && !protectedEquipment,
      protected: protectedEquipment,
      credits: raw?.c || 0,
      materials: Object.entries(raw?.m || {}).map(([id, count]) => ({
        id,
        name: translated(items[id]?.n || id),
        count,
        owned: items[id]?.c || 0,
      })),
    })
  })
  const hidden: HentaiVerseFormData = {}
  form.querySelectorAll<HTMLInputElement>('input[type=hidden][name]').forEach((input) => {
    hidden[input.name] = input.value
  })
  if (!hidden.postoken)
    hidden.postoken = script.match(/\bpostoken\s*[:=]\s*["']([^"']+)["']/)?.[1] || ''
  const selectedId = String(
    hidden['eqids[]'] ||
      new URLSearchParams(target as Record<string, string>).get('eqids[]') ||
      script.match(/const last_hover_eqid\s*=\s*(\d+)/)?.[1] ||
      '',
  )
  if (selectedId) hidden['eqids[]'] = [selectedId]
  const inlineDetails: Record<string, HentaiVerseEquipmentDetail> = {}
  const store = readArmoryJson(script, 'dynjs_eqstore')
  if (store)
    Object.assign(
      inlineDetails,
      parseEquipmentData(`const dynjs_equip = ${JSON.stringify(store)};`),
    )
  if (selectedId && document.querySelector('#eqstats .eq')) {
    Object.assign(
      inlineDetails,
      parseEquipmentData(
        `const dynjs_equip = ${JSON.stringify({ [selectedId]: { t: text(document.querySelector('.showequip > div a')), d: document.querySelector('#eqstats')!.innerHTML } })};`,
      ),
    )
  }
  const modify = !!form.querySelector('#equipmodify_outer')
  return {
    screen: screen as HentaiVerseArmoryScreen,
    tabs,
    filters,
    equipment,
    selectedId,
    equipmentSources: readEquipmentSources(document),
    inlineDetails,
    hidden,
    controls: readArmoryControls(form),
    actions: modify ? readModifyActions(form, script) : [],
    descriptions: [...document.querySelectorAll('#equipblurb > p')].map((n) =>
      translateHentaiVerseDescription(text(n)),
    ),
    balance: Number(script.match(/const credit_balance\s*=\s*(\d+)/)?.[1] || 0),
    modify,
    modificationLinks: readLinks(document, '#equipmodify_outer a[href]', target.world),
    charm: readArmoryCharmState(script),
    sections: [
      ...document.querySelectorAll('#equpgrade, #eqbaserolls, #charmslots, #equipblurb > table'),
    ].map((node) => ({
      title: translated(
        node.id === 'eqbaserolls'
          ? 'Base Stat Rolls'
          : node.id === 'charmslots'
            ? 'Charms'
            : node.id === 'equpgrade'
              ? 'Upgrades'
              : 'Capacity',
      ),
      lines: [...node.querySelectorAll('p,tr,.eqcharm')]
        .map((n) => translateHentaiVerseDescription(text(n)))
        .filter(Boolean),
    })),
  }
}
