import type { HentaiVerseFormData, HentaiVersePageTarget } from './model/hentaiVerse'
import { decodeHentaiVerseGlyphs, translateHentaiVerseText } from './hentaiVerseTranslations'

export interface HentaiVerseMonsterUpgrade {
  label: string
  value: string
  description: string
  help: string
  level: string
  disabled: boolean
}

export interface HentaiVerseMonsterDetail {
  name: string
  summary: string
  notice: string
  groups: { title: string; upgrades: HentaiVerseMonsterUpgrade[] }[]
  perks: HentaiVerseMonsterUpgrade[]
  metrics: { label: string; value: string }[]
  food: { label: string; description: string; data: HentaiVerseFormData }[]
  crystalHidden: HentaiVerseFormData
  chaosHidden: HentaiVerseFormData
  renameHidden: HentaiVerseFormData
  canRename: boolean
  deleteData?: HentaiVerseFormData
  skills?: {
    hidden: HentaiVerseFormData
    rows: {
      nameField: string
      name: string
      placeholder: string
      controls: {
        name: string
        value: string
        label: string
        options: { value: string; label: string }[]
      }[]
      details: string[]
    }[]
    canSave: boolean
  }
}

export interface HentaiVerseServiceLink {
  label: string
  query: Record<string, string>
  active?: boolean
  disabled?: boolean
}

export interface HentaiVerseServiceAction {
  label: string
  data: HentaiVerseFormData
  disabled?: boolean
  danger?: boolean
  description?: string
}

export interface HentaiVerseServicesPage {
  kind: 'monsterLab' | 'moogleMail' | 'weaponLottery' | 'armorLottery'
  links: HentaiVerseServiceLink[]
  notices: string[]
  monsters?: { name: string; description: string; query?: Record<string, string> }[]
  actions: HentaiVerseServiceAction[]
  canonicalQuery?: Record<string, string>
  monsterDetail?: HentaiVerseMonsterDetail
  monsterCreation?: {
    classes: { id: string; name: string; active: boolean }[]
    hidden: HentaiVerseFormData
    descriptions: string[]
    stats: { title: string; rows: { label: string; value: string }[] }[]
    attacks: { value: string; label: string }[]
  }
  lottery?: {
    prize: string
    date: string
    stats: string[]
    prizes: string[]
    funds: string
    cost: string
    held: string
    stock: string
    rules: string[]
    hidden: HentaiVerseFormData
    canBuy: boolean
    canGolden: boolean
    canOptOut: boolean
  }
  mail?: {
    filter: string
    hidden: HentaiVerseFormData
    rows: { columns: string[]; query?: Record<string, string> }[]
    empty: string
    compose?: {
      to: string
      subject: string
      body: string
      hidden: HentaiVerseFormData
    }
    help: string[]
    content: string
    attachments: { id: string; name: string; quantity: string; pane: string; locked: boolean }[]
    removable: { label: string; index: string }[]
    canReturn: boolean
    canSetCod: boolean
    sendCost?: number
    attachmentCount?: number
    cod?: number
    state?: number
  }
}

function text(element: Element | null | undefined) {
  return (element?.textContent || '').replace(/\s+/g, ' ').trim()
}

function translated(element: Element | null | undefined) {
  return translateHentaiVerseText(text(element))
}

function queryFrom(element: Element): Record<string, string> | undefined {
  const source =
    element.getAttribute('href') ||
    element
      .getAttribute('onclick')
      ?.match(/(?:document\.location|location\.href)\s*=\s*['"]([^'"]+)['"]/)?.[1]
  if (!source) return
  try {
    const url = new URL(source, 'https://hentaiverse.org/')
    if (url.origin !== 'https://hentaiverse.org' || !['/', '/isekai/'].includes(url.pathname))
      return
    const query: Record<string, string> = {}
    for (const [name, value] of url.searchParams) {
      if (!['s', 'ss', 'filter', 'lottery', 'create', 'slot', 'pane'].includes(name)) return
      query[name] = value
    }
    return query.s === 'Bazaar' ? query : undefined
  } catch {
    return
  }
}

function hiddenFields(form: Element | null): HentaiVerseFormData {
  return Object.fromEntries(
    [...(form?.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]') || [])].map(
      (input) => [input.name, input.value],
    ),
  )
}

function parseLottery(document: Document, target: HentaiVersePageTarget): HentaiVerseServicesPage {
  const form = document.querySelector('#lotteryform')
  const left = document.querySelector('#leftpane')
  const right = document.querySelector('#rightpane')
  if (!left || !right || !document.querySelector('#lottery_eqname'))
    throw new Error('无法读取源站彩票页面')
  const rightRows = [...right.children]
  const images = [...document.querySelectorAll<HTMLImageElement>('#mainpane img')]
  const available = (name: string) =>
    images.some((image) => image.getAttribute('onclick')?.includes(`${name}(`))
  const links = images.flatMap((image) => {
    const query = queryFrom(image)
    if (!query) return []
    const source = image.getAttribute('src') || ''
    return [
      {
        label: source.includes('_prev') ? '上一期' : source.includes('_next') ? '下一期' : '本期',
        query,
      },
    ]
  })
  const prize = document.querySelector('#lottery_eqstat .eq')
  return {
    kind: target.ss === 'la' ? 'armorLottery' : 'weaponLottery',
    links,
    notices: [],
    actions: [],
    lottery: {
      prize: translated(document.querySelector('#lottery_eqname')),
      date: translated(left.firstElementChild),
      stats: [...(prize?.children || [])].map(translated).filter(Boolean),
      prizes: [...left.querySelectorAll('div')]
        .filter((node) => /^\s*[2-5](?:nd|rd|th) Prize:/.test(text(node)))
        .map(translated),
      funds: translated(rightRows[0]),
      cost: translated(rightRows[1]),
      held: translated(rightRows.find((node) => /^You hold /.test(text(node)))),
      stock: translated(rightRows.find((node) => /^Stock:/.test(text(node)))),
      rules: [...right.querySelectorAll('p')].map(translated),
      hidden: hiddenFields(form),
      canBuy: Boolean(form) && available('submit_buy'),
      canGolden: Boolean(form) && available('submit_glt'),
      canOptOut: Boolean(form) && available('submit_dnw'),
    },
  }
}

function parseMail(document: Document, target: HentaiVersePageTarget): HentaiVerseServicesPage {
  const root = document.querySelector('#mmail_outer')
  if (!root) throw new Error('无法读取源站莫古邮件页面')
  const links = [...root.querySelectorAll('#filterbar a, #mmail_pager a')].flatMap((anchor) => {
    const query = queryFrom(anchor)
    return [
      {
        label: translated(anchor),
        query: query || {},
        active: Boolean(anchor.querySelector('.cfbs')),
        disabled: !query,
      },
    ]
  })
  const rows = [...root.querySelectorAll('#mmail_list tr')].flatMap((row) => {
    if (row.querySelector('th, #mmail_nnm')) return []
    const columns = [...row.querySelectorAll('td')].map(translated)
    const source = row.matches('[onclick]') ? row : row.querySelector('a[href], [onclick]')
    return columns.length ? [{ columns, query: source ? queryFrom(source) : undefined }] : []
  })
  const form = root.querySelector('#mailform')
  const inputValue = (name: string) =>
    form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value || ''
  const attachments = [...root.querySelectorAll('[onclick*="set_mooglemail_item("]')].flatMap(
    (node) => {
      const id = node.getAttribute('onclick')?.match(/set_mooglemail_item\((\d+)/)?.[1]
      if (!id) return []
      return [
        {
          id,
          name: translated(node),
          quantity: text(node.closest('tr')?.querySelector('td:last-child')),
          pane: node.closest('#mm_equip') ? 'equip' : 'item',
          locked: node.getAttribute('data-locked') === '1',
        },
      ]
    },
  )
  const removable = [...root.querySelectorAll('[onclick*="remove_attachment("]')].flatMap(
    (node) => {
      const index = node.getAttribute('onclick')?.match(/remove_attachment\((\d+)/)?.[1]
      return index === undefined
        ? []
        : [{ index, label: translated(node.closest('tr') || node.parentElement) || '附件' }]
    },
  )
  const content = root.querySelector('#mmail_left')?.cloneNode(true) as Element | undefined
  content?.querySelectorAll('script, input, textarea, img').forEach((node) => node.remove())
  const script = [...document.scripts]
    .filter((node) => !node.src)
    .map((node) => node.textContent)
    .join('\n')
  // The observed mail page declares these as separate `var name = integer;` statements.
  // An absent or changed initializer is unknown, rather than a zero fee or draft state.
  const mailNumber = (name: string): number | undefined => {
    const literal = script.match(
      new RegExp(`(?:^|[;\\n])\\s*var\\s+${name}\\s*=\\s*(\\d+)\\s*(?=;|$)`, 'm'),
    )?.[1]
    if (literal === undefined) return undefined
    const value = Number(literal)
    return Number.isSafeInteger(value) ? value : undefined
  }
  return {
    kind: 'moogleMail',
    links,
    notices: [],
    actions: [],
    mail: {
      filter: target.filter || 'inbox',
      rows,
      hidden: hiddenFields(form),
      empty: translated(root.querySelector('#mmail_nnm')),
      compose: form?.querySelector('[name="message_to_name"]')
        ? {
            to: inputValue('message_to_name'),
            subject: inputValue('message_subject'),
            body: inputValue('message_body'),
            hidden: hiddenFields(form),
          }
        : undefined,
      help: [...root.querySelectorAll('#mmail_attachhelp p')].map(translated),
      content: translated(content),
      attachments,
      removable,
      canReturn: Boolean(root.querySelector('[onclick*="return_mail("]')),
      canSetCod: Boolean(root.querySelector('[onclick*="set_cod("]')),
      sendCost: mailNumber('send_cost'),
      attachmentCount: mailNumber('attach_count'),
      cod: mailNumber('attach_cod'),
      state: mailNumber('mail_state'),
    },
  }
}

function parseMonsterLab(document: Document): HentaiVerseServicesPage {
  const root = document.querySelector('#monster_outer')
  if (!root) throw new Error('无法读取源站怪物实验室页面')
  if (root.querySelector('#monster_head')) return parseMonsterDetail(document, root)
  const create = document.querySelector('#create_form')
  if (create && root.querySelector('#monstercreate_left')) {
    const classIds: Record<string, string> = {
      arthropod: '1',
      avion: '2',
      beast: '3',
      celestial: '4',
      daimon: '5',
      dragonkin: '6',
      elemental: '7',
      giant: '8',
      humanoid: '10',
      mechanoid: '12',
      reptilian: '13',
      sprite: '14',
      undead: '15',
    }
    const classes = [...root.querySelectorAll<HTMLImageElement>('#monstercreate_left img')].flatMap(
      (image) => {
        const name = image.getAttribute('src')?.match(/\/([a-z]+)(?:_a)?\.png$/)?.[1] || ''
        const id = classIds[name]
        if (!id) return []
        return [
          {
            id,
            name: translateHentaiVerseText(name.charAt(0).toUpperCase() + name.slice(1)),
            active: image.getAttribute('src')?.endsWith('_a.png') || false,
          },
        ]
      },
    )
    const labels: Record<string, string> = {
      crsh: '钝击',
      slsh: '斩击',
      prcg: '穿刺',
      fire: '火焰',
      cold: '冰冷',
      elec: '雷电',
      wind: '风',
      holy: '神圣',
      dark: '黑暗',
    }
    const attacks = [...root.querySelectorAll('#monstercreate_patk img[onclick]')].flatMap(
      (image) => {
        const value = image.getAttribute('onclick')?.match(/^create_monster\('([a-z]+)'\)$/)?.[1]
        return value && labels[value] ? [{ value, label: labels[value] }] : []
      },
    )
    const stats = [...root.querySelectorAll('#monstercreate_stats > div')].map((group) => ({
      title: translated(group.firstElementChild),
      rows: [...group.querySelectorAll('tr')].map((row) => ({
        label: translated(row.children[0]),
        value: text(row.children[1]),
      })),
    }))
    return {
      kind: 'monsterLab',
      canonicalQuery: { s: 'Bazaar', ss: 'ml', create: 'new' },
      links: [{ label: '返回怪物列表', query: { s: 'Bazaar', ss: 'ml' } }],
      notices: [],
      actions: [],
      monsterCreation: {
        classes,
        hidden: hiddenFields(create),
        descriptions: [
          ...root.querySelectorAll('#monstercreate_info p, #monstercreate_info li'),
        ].map(translated),
        stats,
        attacks,
      },
    }
  }
  const slots = root?.querySelector('#slot_pane')
  if (!root || !slots) throw new Error('无法读取源站怪物实验室页面')
  const monsters = [...slots.children]
    .filter((node) => !node.matches('script'))
    .map((node) => {
      const source = node.matches('[onclick], a[href]')
        ? node
        : node.querySelector('[onclick], a[href]')
      return {
        name: translated(node),
        description: '',
        query: source ? queryFrom(source) : undefined,
      }
    })
    .filter((monster) => monster.name)
  const unlock = root.querySelector('img[onclick*="do_unlock_slot"]')
  const feedActions = [...root.querySelectorAll('img[onclick^="do_feed_all("]')].flatMap(
    (image) => {
      const value = image.getAttribute('onclick')?.match(/do_feed_all\('(food|drugs)'\)/)?.[1]
      return value
        ? [
            {
              label: value === 'food' ? '喂养全部怪物' : '为全部怪物使用快乐药丸',
              description: translated(image.parentElement?.parentElement),
              data: { ...hiddenFields(document.querySelector('#feed_form')), feed_all: value },
            },
          ]
        : []
    },
  )
  const notices = [...root.querySelectorAll('#monster_actions > div')]
    .map((node) => {
      const clone = node.cloneNode(true) as Element
      clone.querySelectorAll('img').forEach((image) => image.remove())
      return translated(clone)
    })
    .filter(Boolean)
  return {
    kind: 'monsterLab',
    canonicalQuery: { s: 'Bazaar', ss: 'ml' },
    links: [],
    notices,
    monsters,
    actions: [
      ...feedActions,
      ...(unlock
        ? [
            {
              label: '解锁怪物槽位',
              description: translated(unlock.parentElement?.parentElement),
              data: { unlock_slot: '1' },
            },
          ]
        : []),
    ],
  }
}

function monsterUpgradeHelp(image: Element | null) {
  const html = image?.getAttribute('onmouseover')?.match(/show_upgrade_text\('([\s\S]*)'\)/)?.[1]
  if (!html) return ''
  const fragment = new DOMParser().parseFromString(html.replace(/\\'/g, "'"), 'text/html')
  decodeHentaiVerseGlyphs(fragment)
  return translated(fragment.body)
}

function parseMonsterDetail(document: Document, root: Element): HentaiVerseServicesPage {
  const links = [...root.querySelectorAll('#monster_nav a, #monster_nav img[onclick]')].flatMap(
    (node) => {
      const query = queryFrom(node)
      if (!query) return []
      const image = node.matches('img') ? node : node.querySelector('img')
      const source = image?.getAttribute('src') || ''
      const label = source.includes('/prev')
        ? '上一个怪物'
        : source.includes('/next')
          ? '下一个怪物'
          : query.pane === 'skills'
            ? '怪物技能'
            : '怪物属性'
      return [{ label, query }]
    },
  )
  links.unshift({ label: '返回怪物列表', query: { s: 'Bazaar', ss: 'ml' } })
  const header = root.querySelector('#monster_head .msl')
  const groups = [...root.querySelectorAll('#monsterstats_top .mcr')].map((group) => ({
    title: translated(group.firstElementChild),
    upgrades: [...group.querySelectorAll('tr')].map((row) => {
      const image = row.querySelector('img')
      const stat = image?.getAttribute('src')?.match(/\/([a-z]+)\.png$/)?.[1] || ''
      const action = image?.getAttribute('onclick')?.match(/do_crystal_upgrade\('([a-z]+)'/)
      return {
        label: translateHentaiVerseText(stat.toUpperCase()),
        value: action?.[1] || '',
        description: text(row.children[2]),
        level: text(row.children[1]),
        help: monsterUpgradeHelp(image),
        disabled: !action,
      }
    }),
  }))
  const perks = [...root.querySelectorAll('#monsterstats_chaos tr')].map((row) => {
    const image = row.querySelector('img')
    const action = image?.getAttribute('onclick')?.match(/do_chaos_upgrade\('([a-z]+)'/)
    return {
      label: translated(row.children[0]),
      value: action?.[1] || '',
      description: translated(row.children[3]),
      level: `${row.querySelectorAll('.mcu1').length} / ${row.querySelectorAll('.mcu0, .mcu1').length}`,
      help: monsterUpgradeHelp(image),
      disabled: !action,
    }
  })
  const food = [...root.querySelectorAll('#monsterstats_top img[onclick^="do_feed("]')].flatMap(
    (image) => {
      const value = image.getAttribute('onclick')?.match(/do_feed\('(food|drugs)'\)/)?.[1]
      return value
        ? [
            {
              label: value === 'food' ? '喂养怪物' : '使用快乐药丸',
              description: translated(image.parentElement?.parentElement),
              data: { ...hiddenFields(document.querySelector('#food_form')), food_action: value },
            },
          ]
        : []
    },
  )
  // The deletion token is a literal assigned by this specific source action, never executed here.
  const script = [...document.scripts]
    .filter((node) => !node.src)
    .map((node) => node.textContent)
    .join('\n')
  const deleteToken = script.match(
    /e\(["']delete_monster["']\)\.value\s*=\s*["']([a-zA-Z0-9_-]+)["']/,
  )?.[1]
  const detail: HentaiVerseMonsterDetail = {
    name: translated(header?.children[1]),
    summary: [
      text(header?.children[0]),
      translated(header?.children[2]),
      translated(header?.children[3]),
    ]
      .filter(Boolean)
      .join(' · '),
    notice: translated(root.querySelector('#monsterstats_rename')),
    groups,
    perks,
    food,
    metrics: [...root.querySelectorAll('#monsterstats_right .mst')].map((row) => ({
      label: translated(row.children[0]),
      value: text(row.children[1]),
    })),
    crystalHidden: hiddenFields(document.querySelector('#crystal_form')),
    chaosHidden: hiddenFields(document.querySelector('#chaos_form')),
    renameHidden: hiddenFields(document.querySelector('#rename_form')),
    canRename: Boolean(root.querySelector('[onclick="do_rename()"]')),
    deleteData:
      deleteToken && root.querySelector('[onclick="do_delete()"]')
        ? { ...hiddenFields(document.querySelector('#delete_form')), delete_monster: deleteToken }
        : undefined,
  }
  const skillForm = root.querySelector('#skillform')
  if (skillForm) {
    const rows = [
      ...skillForm.querySelectorAll<HTMLInputElement>('input[name^="skill_name_"]'),
    ].map((input) => {
      const row = input.closest('tr')!
      const controls = [
        ...row.querySelectorAll<HTMLInputElement>('input[type="hidden"][name^="skill_"]'),
      ].map((hidden) => {
        const options = [...row.querySelectorAll(`[id^="skill_select_"] [onclick]`)].flatMap(
          (option) => {
            const match = option
              .getAttribute('onclick')
              ?.match(/set_property\(this,\s*'([^']+)',\s*'([^']+)'\)/)
            return match && `skill_${match[1]}` === hidden.name
              ? [{ value: match[2]!, label: translated(option) }]
              : []
          },
        )
        const which = hidden.name.replace(/^skill_/, '')
        return {
          name: hidden.name,
          value: hidden.value || options[0]?.value || '',
          label: translated(row.querySelector(`#skill_display_${which}`)),
          options,
        }
      })
      return {
        nameField: input.name,
        name: input.value,
        placeholder: input.placeholder,
        controls,
        details: [...row.children].slice(3).map(translated),
      }
    })
    detail.skills = {
      hidden: hiddenFields(skillForm),
      rows,
      canSave: Boolean(skillForm.querySelector('[onclick*="skillform"][onclick*="submit"]')),
    }
  }
  const canonicalQuery = links.find(
    (link) => link.query.slot && link.label === (detail.skills ? '怪物技能' : '怪物属性'),
  )?.query
  return {
    kind: 'monsterLab',
    canonicalQuery,
    links,
    notices: [],
    actions: [],
    monsterDetail: detail,
  }
}

/** Receives the authenticated page after the shared glyph decoder has run. */
export function parseHentaiVerseServices(
  document: Document,
  target: HentaiVersePageTarget,
): HentaiVerseServicesPage {
  if (target.s !== 'Bazaar') throw new Error('源站集市页面不匹配')
  if (target.ss === 'lt' || target.ss === 'la') return parseLottery(document, target)
  if (target.ss === 'mm') return parseMail(document, target)
  if (target.ss === 'ml') return parseMonsterLab(document)
  throw new Error('不支持的源站集市服务')
}
