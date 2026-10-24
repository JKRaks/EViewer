import { withTranslationCapture, protectTranslationNames } from './hentaiVerseTranslationCapture'
import { formatSystemMessage } from '@/i18n'
import type {
  HentaiVerseAttribute,
  HentaiVerseBattleAction,
  HentaiVerseBattleMode,
  HentaiVerseBattleMonster,
  HentaiVerseBattleSnapshot,
  HentaiVerseBattleVital,
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
  HentaiVerseChallenge,
  HentaiVerseStatGroup,
  HentaiVerseMetric,
  HentaiVerseItemWorldPage,
} from './model/hentaiVerse'
import { getHentaiVerseSection } from './hentaiVerseProtocol'
import { readEquipmentSources } from './hentaiVerseEquipment'
import {
  decodeHentaiVerseGlyphs,
  getAttributeLabel,
  getHentaiVerseItemPresentation,
  getHentaiVerseAbilityPresentation,
  getHentaiVerseSettingControl,
  HENTAIVERSE_SETTING_GROUPS,
  translateHentaiVerseBattleLog,
  translateHentaiVerseDescription,
  translateHentaiVerseText,
} from './hentaiVerseTranslations'

const parser = new DOMParser()

export function parseHentaiVersePage(html: string, target: HentaiVersePageTarget): HentaiVersePage {
  return withTranslationCapture(getHentaiVerseSection(target), html, () => {
    const document = parser.parseFromString(html, 'text/html')
    decodeHentaiVerseGlyphs(document)
    const bodyText = cleanText(document.body?.textContent)
    const authenticated =
      !/you (?:must|have to) (?:be logged on|log on)|requires you to log on|please log on|log on with an EH account/i.test(
        bodyText,
      )
    const scriptText = Array.from(document.scripts, (script) => script.textContent || '').join('\n')
    const section = getHentaiVerseSection(target)
    const personaName = readScriptString(scriptText, 'current_persona_name')
    protectTranslationNames([personaName, readCharacterName(document, personaName)])
    const equipment =
      section === 'equipment' ? parseEquipment(document, scriptText, target) : undefined
    const abilities =
      section === 'abilities' ? parseAbilities(document, scriptText, target) : undefined
    const training = section === 'training' ? parseTraining(document, scriptText) : undefined
    const inventory = section === 'inventory' ? parseInventory(document) : undefined

    return {
      section,
      title: translateHentaiVerseText(
        document.querySelector('h1, #mainpane h2, title')?.textContent || 'HentaiVerse',
      ),
      characterName: readCharacterName(document, personaName),
      personaName,
      authenticated,
      usableExperience: Number(matchValue(scriptText, /usable_exp\s*=\s*([0-9]+)/) || 0),
      metrics: parseMetrics(document, scriptText),
      statGroups: parseStatGroups(document),
      personaCapacity: readPersonaCapacity(document),
      attributes: parseAttributes(scriptText),
      personas: parsePersonas(document, personaName),
      equipment,
      equipmentSources: ['equipment', 'itemWorld'].includes(section)
        ? readEquipmentSources(document)
        : [],
      abilities,
      training,
      inventory,
      challenges: ['arena', 'ringOfBlood'].includes(section)
        ? parseChallenges(document)
        : undefined,
      challengePostToken: document.querySelector<HTMLInputElement>('input[name="postoken"]')?.value,
      itemWorld: section === 'itemWorld' ? parseItemWorld(document, scriptText, target) : undefined,
      forms: parseForms(document, section),
      notices: parseNotices(document),
    }
  })
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
  return withTranslationCapture('battle', html, () => {
    const document = parser.parseFromString(html, 'text/html')
    decodeHentaiVerseGlyphs(document)
    const scripts = Array.from(document.scripts, (script) => script.textContent || '').join('\n')
    const token =
      readScriptString(scripts, 'battle_token') ||
      matchValue(scripts, /battle_token\s*=\s*['"]([^'"]+)/)
    return parseBattleDocument(document, token)
  })
}

function isVerificationDocument(document: Document): boolean {
  const heading = Array.from(document.querySelectorAll('title, h1, h2, h3')).some((node) =>
    /\briddle\s*master\b/i.test(cleanText(node.textContent)),
  )
  const instructions = cleanText(document.body?.textContent)
  return (
    heading ||
    /select all ponies you see in the image|choose the right answer based on the image below/i.test(
      instructions,
    )
  )
}

export function isHentaiVerseVerificationHtml(html: string): boolean {
  return (
    /riddle|select all ponies|choose the right answer/i.test(html) &&
    isVerificationDocument(parser.parseFromString(html, 'text/html'))
  )
}

export function isHentaiVerseBattleHtml(html: string) {
  return (
    /battle_token\s*=/.test(html) ||
    /id=["']pane_(?:battle|monster|completion)["']/.test(html) ||
    isHentaiVerseVerificationHtml(html)
  )
}

export function parseBattleResponse(
  payload: Record<string, unknown>,
  previous: HentaiVerseBattleSnapshot,
): HentaiVerseBattleSnapshot {
  return withTranslationCapture('battle', '', () => {
    protectTranslationNames(previous.monsters.map((monster) => monster.name))
    const verification = Object.values(payload).find(
      (value) => typeof value === 'string' && isHentaiVerseVerificationHtml(value),
    )
    if (typeof verification === 'string')
      return {
        ...previous,
        verificationRequired: true,
        completed: false,
        roundCompleted: false,
        actions: [],
      }
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
      if (typeof value !== 'string' && !(name === 'textlog' && Array.isArray(value))) return
      const wrapper = document.createElement(
        name.startsWith('table_') || name === 'textlog' ? 'table' : 'div',
      )
      wrapper.id = name
      if (typeof value === 'string') {
        wrapper.innerHTML = value
      } else if (Array.isArray(value)) {
        // Native battle responses send chronological { t: HTML, c?: class }
        // entries, while full-page logs have the newest table row first.
        value
          .slice()
          .reverse()
          .forEach((entry) => {
            if (!entry || typeof entry !== 'object' || typeof entry.t !== 'string') return
            const row = document.createElement('tr')
            const cell = document.createElement('td')
            cell.innerHTML = entry.t
            row.appendChild(cell)
            wrapper.appendChild(row)
          })
      }
      document.body.appendChild(wrapper)
    })
    decodeHentaiVerseGlyphs(document)
    const parsed = parseBattleDocument(document, previous.token)
    const actions = new Map(
      previous.actions.map((action) => [`${action.mode}:${action.skill}`, action]),
    )
    parsed.actions.forEach((action) => actions.set(`${action.mode}:${action.skill}`, action))
    return {
      ...previous,
      ...parsed,
      vitals: parsed.vitals.length ? parsed.vitals : previous.vitals,
      effects: typeof payload.pane_effects === 'string' ? parsed.effects : previous.effects,
      monsters: parsed.completed
        ? parsed.monsters
        : parsed.monsters.length
          ? parsed.monsters
          : previous.monsters,
      actions: parsed.roundCompleted ? [] : Array.from(actions.values()),
      effectIds: typeof payload.pane_effects === 'string' ? parsed.effectIds : previous.effectIds,
      overcharge: typeof payload.pane_vitals === 'string' ? parsed.overcharge : previous.overcharge,
      log: parsed.log.length ? [...previous.log, ...parsed.log].slice(-40) : previous.log,
    }
  })
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

function parseMetrics(document: Document, scriptText: string): HentaiVerseMetric[] {
  const metrics = new Map<string, string>()
  const scripted: Array<[string, string]> = [
    ['可用经验', 'usable_exp'],
    ['总经验', 'total_exp'],
  ]
  scripted.forEach(([label, key]) => {
    const value = matchValue(scriptText, new RegExp(`${key}\\s*=\\s*([0-9]+)`))
    if (value) metrics.set(label, Number(value).toLocaleString('zh-CN'))
  })
  const level = cleanText(document.querySelector('#level_readout')?.textContent)
  const stamina = matchValue(
    cleanText(document.querySelector('#stamina_readout')?.textContent),
    /Stamina\s*:\s*(\d+)/i,
  )
  if (level) metrics.set('等级与难度', translateHentaiVerseText(level))
  if (stamina) metrics.set('体力', stamina)
  const exp = cleanText(document.querySelector('#level_details')?.textContent)
  if (exp) metrics.set('升级经验', translateHentaiVerseText(exp))
  const experience = exp.match(/([\d,]+)\s*\/\s*([\d,]+)/)
  const currentExperience = Number(experience?.[1]?.replace(/,/g, ''))
  const requiredExperience = Number(experience?.[2]?.replace(/,/g, ''))
  const experiencePercent =
    Number.isFinite(currentExperience) && requiredExperience > 0
      ? Math.min(100, Math.max(0, (currentExperience / requiredExperience) * 100))
      : undefined
  const credits =
    matchValue(scriptText, /\bcredit_balance\s*=\s*([\d,]+)/) ||
    matchValue(
      cleanText(document.querySelector('#mainpane')?.textContent),
      /Credits\s*:\s*([\d,]+)/i,
    )
  if (credits) metrics.set('信用点', credits)
  const bloodTokens = matchValue(
    cleanText(document.querySelector('#mainpane')?.textContent),
    /you have\s*([\d,]+)\s*tokens? of blood/i,
  )
  if (bloodTokens) metrics.set('鲜血代币', bloodTokens)
  return Array.from(metrics, ([label, value]) => ({
    label,
    value,
    ...(label === '升级经验' && experiencePercent !== undefined
      ? { percent: experiencePercent }
      : {}),
  }))
}

function readPersonaCapacity(document: Document) {
  const match = cleanText(document.querySelector('#persona_used')?.textContent).match(
    /(\d+)\s*\/\s*(\d+)/,
  )
  return match ? { used: Number(match[1]), total: Number(match[2]) } : undefined
}

function parseStatGroups(document: Document): HentaiVerseStatGroup[] {
  const groups: HentaiVerseStatGroup[] = []
  document
    .querySelectorAll<HTMLElement>('#prof_outer table, #stats_scrollable table')
    .forEach((table) => {
      const proficiency = Boolean(table.closest('#prof_outer'))
      const metrics = Array.from(table.querySelectorAll('tr')).flatMap((row) => {
        const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
        if (cells.length !== 2 || !cells[0] || !cells[1]) return []
        return [
          {
            label: translateHentaiVerseText(cells[proficiency ? 0 : 1]!),
            value: cells[proficiency ? 1 : 0]!,
          },
        ]
      })
      if (metrics.length)
        groups.push({
          title:
            translateHentaiVerseText(cleanText(table.previousElementSibling?.textContent)) ||
            '角色属性',
          metrics,
        })
    })
  return groups
}

function parsePersonas(document: Document, currentName: string): HentaiVersePersona[] {
  const personas = new Map<string, HentaiVersePersona>()
  document
    .querySelectorAll<HTMLOptionElement>('select[name="persona_set"] option')
    .forEach((option) => {
      const name = cleanText(option.textContent)
      personas.set(option.value, {
        id: option.value,
        name,
        active: option.selected || name === currentName,
      })
    })
  document
    .querySelectorAll<HTMLElement>('[data-persona], [onclick*="persona_set"]')
    .forEach((node) => {
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
  const selectedSlot = target.equip_slot || ''
  const sets = new Map<string, HentaiVerseEquipmentSet>()
  document
    .querySelectorAll<HTMLElement>(
      '#eqsl img, select[name="equip_set"] option, [data-equip-set], [onclick*="equip_set"], a[href*="equip_set="]',
    )
    .forEach((node, index) => {
      const option = node instanceof HTMLOptionElement ? node : undefined
      const source = getActionSource(node)
      const setImage =
        node instanceof HTMLImageElement ? node.src.match(/\/set(\d+)_(on|off)\.png/) : undefined
      const id =
        option?.value ||
        setImage?.[1] ||
        node.dataset.equipSet ||
        readNamedValue(source, 'equip_set') ||
        String(index + 1)
      const label = setImage
        ? formatSystemMessage('套装 {p0}', { p0: id })
        : readNodeLabel(node) || formatSystemMessage('套装 {p0}', { p0: id })
      sets.set(id, {
        id,
        label,
        active: Boolean(
          setImage?.[2] === 'on' ||
            option?.selected ||
            node.matches('.active, .selected, [aria-current="true"]'),
        ),
      })
    })

  const slots = new Map<string, HentaiVerseEquipmentSlot>()
  const overviewSlotIds = ['1', '9', '13', '11', '14', '12', '15']
  document
    .querySelectorAll<HTMLElement>(
      '#eqsb > .eqb, #eqch_outer [data-equip-slot], #eqch_outer [id*="equip_slot"], #eqch_outer a[href*="equip_slot="]',
    )
    .forEach((node, index) => {
      const source = getActionSource(node)
      const id =
        node.dataset.equipSlot ||
        readNamedValue(source, 'equip_slot') ||
        matchValue(node.id, /equip_slot[_-]?(\d+)/i) ||
        overviewSlotIds[index]
      if (!id) return
      const equipmentId = readEquipmentId(node)
      const equipmentName = readNodeLabel(
        node.querySelector<HTMLElement>(':scope > div:last-child') || node,
      )
      const slotLabel = readEquipmentSlotLabel(id, node)
      slots.set(id, {
        id,
        label: slotLabel,
        equipmentId,
        equipmentName:
          equipmentName &&
          equipmentName !== slotLabel &&
          !/\((?:empty|unavailable[^)]*)\)/i.test(equipmentName)
            ? equipmentName
            : '',
        description: cleanText(node.getAttribute('title') || node.dataset.description),
        active: id === selectedSlot || node.matches('.active, .selected, [aria-current="true"]'),
        disabled: node.matches('.eqdisabled, .disabled, [aria-disabled="true"]'),
      })
    })

  const candidates = new Map<string, HentaiVerseEquipmentCandidate>()
  document
    .querySelectorAll<HTMLElement>(
      '#equiplist tr, .equiplist tr, #eqch_outer [data-eid], #eqch_outer [id^="e"][onclick]',
    )
    .forEach((node) => {
      const id = readEquipmentId(node)
      const name = readEquipmentName(node)
      if (!id || !name) return
      const rowText = cleanText(node.textContent)
      const nameNode = node.querySelector<HTMLElement>(
        '[data-equip-name], .equip-name, td:first-child',
      )
      const sourceName = cleanText(nameNode?.textContent || node.textContent)
      const checkbox = node.querySelector<HTMLInputElement>('input[name="eqids[]"]')
      candidates.set(id, {
        id,
        name,
        description: translateHentaiVerseDescription(
          cleanText(
            node.getAttribute('title') ||
              node.dataset.description ||
              rowText.replace(sourceName, '').trim(),
          ),
        ),
        locked:
          Boolean(checkbox?.disabled) ||
          node.dataset.locked === '1' ||
          /(?:^|\s)(?:locked|il)(?:\s|$)/i.test(node.className),
        equipped:
          Boolean(checkbox?.checked) ||
          node.dataset.equipped === '1' ||
          /equipped|current/i.test(`${node.className} ${rowText}`),
      })
    })

  const postToken =
    document.querySelector<HTMLInputElement>('input[name="postoken"]')?.value ||
    readScriptString(scriptText, 'postoken') ||
    matchValue(scriptText, /postoken\s*[:=]\s*['"]([^'"]+)/i)
  return {
    sets: Array.from(sets.values()),
    slots: Array.from(slots.values()),
    candidates: Array.from(candidates.values()),
    selectedSlot,
    postToken,
    canUnequip: Boolean(
      document.querySelector<HTMLButtonElement>('[name="action"][value="unequip"]') &&
        !document.querySelector<HTMLButtonElement>('[name="action"][value="unequip"]')?.disabled,
    ),
  }
}

function parseAbilities(
  document: Document,
  scriptText: string,
  target: HentaiVersePageTarget,
): HentaiVerseAbilityPage {
  const trees = new Map<string, HentaiVerseAbilityTree>()
  const treeLabels: Record<string, string> = {
    general: '通用',
    onehanded: '单手',
    twohanded: '双手',
    dualwield: '双持',
    niten: '二天一流',
    staff: '法杖',
    cloth: '布甲',
    light: '轻甲',
    heavy: '重甲',
    deprecating1: '减益法术 I',
    deprecating2: '减益法术 II',
    supportive1: '辅助法术 I',
    supportive2: '辅助法术 II',
    elemental: '元素法术',
    forbidden: '禁断法术',
    divine: '神圣法术',
  }
  document
    .querySelectorAll<HTMLElement>(
      '#ability_treelist > div, #ability_treelist a, [data-ability-tree], a[href*="tree="]',
    )
    .forEach((node, index) => {
      const source = getActionSource(node, true)
      const imageTree = node
        .querySelector<HTMLImageElement>('img')
        ?.src.match(/\/ab\/t([ad])([^/.]+)\.png/i)
      const id =
        node.dataset.abilityTree ||
        node.dataset.tree ||
        readNamedValue(source, 'tree') ||
        imageTree?.[2] ||
        matchValue(`${node.id} ${source}`, /(?:ability_)?tree[_-]?([a-z0-9]+)/i) ||
        String(index)
      const label = readNodeLabel(node) || treeLabels[id]
      if (!label) return
      trees.set(id, {
        id,
        label,
        active:
          id === target.tree ||
          imageTree?.[1] === 'a' ||
          node.matches('.active, .selected, [aria-current="true"]') ||
          /f[24][lr]a/.test(node.className),
      })
    })

  const abilities: HentaiVerseAbility[] = []
  document.querySelectorAll<HTMLElement>('#ability_treepane > div').forEach((row, index) => {
    const source = getActionSource(row, true)
    const parsedAction = readAbilityAction(source)
    const presentation = readAbilityPresentation(row)
    const id =
      row.dataset.abilityId ||
      row.dataset.ability ||
      matchValue(row.querySelector<HTMLElement>('[id^="slot_"]')?.id || '', /^slot_(\d+)$/) ||
      parsedAction?.value ||
      matchValue(row.id, /(?:ability|ab)[_-]?(\d+)/i) ||
      matchValue(
        row.querySelector<HTMLImageElement>('img[src*="/a/"]')?.src || '',
        /\/a\/(\d+)/i,
      ) ||
      `unavailable-${target.tree || 'general'}-${index}`
    const nameNode = row.querySelector<HTMLElement>(
      ':scope > div:first-child, [data-ability-name], .ability-name',
    )
    const name = translateHentaiVerseText(presentation.name || readNodeLabel(nameNode || row))
    if (!id || !name) return
    const levelText = cleanText(
      row.dataset.level ||
        row.querySelector<HTMLElement>('[data-level], .ability-level')?.dataset.level ||
        row.querySelector<HTMLElement>('[data-level], .ability-level')?.textContent,
    )
    const statusText = cleanText(
      parser.parseFromString(presentation.status, 'text/html').body.textContent,
    )
    const levelMatch = `${levelText} ${statusText}`.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i)
    const maxLevel = Number(
      row.dataset.maxLevel ||
        levelMatch?.[2] ||
        row.querySelector(':scope > div:nth-child(3)')?.children.length ||
        0,
    )
    // The current tooltip describes the tier's required character level, not
    // the acquired rank. The source encodes that rank with filled bar images.
    const statusLevel = /requires/i.test(statusText)
      ? ''
      : matchValue(statusText, /(?:Level|Tier|Rank)\s*[:=]?\s*(\d+)/i)
    const explicitLevel = levelText.match(/^\d+(?:\s*\/\s*\d+)?$/)?.[0]
    const graphicLevel = countActiveAbilityLevels(row)
    const level = /not acquired/i.test(statusText)
      ? 0
      : explicitLevel || levelMatch?.[1] || statusLevel
        ? Number.parseInt(explicitLevel || levelMatch?.[1] || statusLevel, 10)
        : graphicLevel
    const actionNode = row.querySelector<HTMLElement>(
      '[onclick*="unlock_ability"], [onclick*="reset_ability"], [data-action]',
    )
    abilities.push({
      id,
      name,
      description:
        getHentaiVerseAbilityPresentation(presentation.name)?.description ||
        translateHentaiVerseDescription(
          presentation.description ||
            cleanText(
              row.dataset.description ||
                row.getAttribute('title') ||
                row.querySelector<HTMLElement>('.ability-description')?.textContent,
            ),
        ),
      level,
      maxLevel,
      cost: translateHentaiVerseText(
        presentation.requirement ||
          cleanText(
            row.dataset.cost || row.querySelector(':scope > div:nth-child(4)')?.textContent,
          ),
      ),
      action: parsedAction?.name,
      actionLabel:
        parsedAction?.name === 'unlock_ability'
          ? (level ?? 0) > 0
            ? '升级'
            : '解锁'
          : parsedAction?.name === 'reset_ability'
            ? '重置'
            : undefined,
      disabled: !parsedAction || Boolean(actionNode?.matches('.disabled, [aria-disabled="true"]')),
      group: readAbilityGroup(row),
      currentEffect: presentation.currentEffect,
      nextEffect: presentation.nextEffect,
      resetCost: readOptionalNumber(source, /do_reset_ability\s*\(\s*\d+\s*,\s*(\d+)/),
    })
  })

  const slots: HentaiVerseAbilitySlot[] = []
  document.querySelectorAll<HTMLElement>('.ability_slotbar > div').forEach((node, index) => {
    const source = getActionSource(node, true)
    const action = readAbilityAction(source)
    const id =
      node.dataset.slot ||
      node.dataset.abilitySlot ||
      matchValue(node.querySelector<HTMLElement>('[id^="slot_"]')?.id || '', /^slot_(\d+)$/i) ||
      readNamedValue(source, 'equip_slot') ||
      readNamedValue(source, 'unlock_slot') ||
      ''
    if (!id) return
    const presentation = readAbilityPresentation(node)
    const abilityName = translateHentaiVerseText(presentation.name)
    const abilityId =
      node.dataset.abilityId ||
      readNamedValue(source, 'equip_ability') ||
      matchValue(
        node.querySelector<HTMLImageElement>('img[src*="/a/"]')?.src || '',
        /\/a\/(\d+)/i,
      ) ||
      abilities.find((ability) => ability.name === abilityName)?.id ||
      ''
    const locked =
      action?.name === 'unlock_slot' || node.matches('.locked, .disabled, [aria-disabled="true"]')
    slots.push({
      id,
      label: formatSystemMessage('槽位 {p0}', { p0: index + 1 }),
      abilityId,
      abilityName: locked ? '' : abilityName || (abilityId ? readNodeLabel(node) : ''),
      locked,
      action: action?.name,
      group: readAbilityGroup(node),
      unlockCost: readOptionalNumber(node.getAttribute('title') || '', /Unlock Cost:\s*(\d+)/i),
    })
  })

  const topText = cleanText(document.querySelector('#ability_top')?.textContent)
  const abilityPoints =
    matchValue(topText, /Ability Points?\s*:?\s*([\d,]+)/i) ||
    matchValue(scriptText, /(?:ability_points|available_ap)\s*[:=]\s*['"]?([\d,]+)/i)
  return {
    trees: Array.from(trees.values()),
    abilities,
    slots,
    selectedTree: target.tree || Array.from(trees.values()).find((tree) => tree.active)?.id || '',
    abilityPoints,
    canResetAll: Boolean(document.querySelector('[name="reset_all"], [onclick*="reset_all"]')),
    masteryPoints: matchValue(topText, /Mastery Points?\s*:?\s*([\d,]+)/i),
    resetCost: readOptionalNumber(
      document.querySelector('[onclick*="do_reset_all"]')?.getAttribute('onclick') || '',
      /do_reset_all\s*\(\s*(\d+)/,
    ),
  }
}

function parseTraining(document: Document, scriptText: string): HentaiVerseTrainingPage {
  const progressPane = document.querySelector<HTMLElement>('#train_progress')
  // The source keeps a hidden cancel_train=0 field even while idle.
  // Only an actual progress pane indicates that a training is running.
  const active = Boolean(progressPane)
  const progress = cleanText(document.querySelector('#train_progcnt')?.textContent)
  const progressText = cleanText(progressPane?.textContent)
  const totalSeconds = Number(matchValue(scriptText, /\btotal_time\s*=\s*(\d+(?:\.\d+)?)/))
  const endTime = Number(matchValue(scriptText, /\bend_time\s*=\s*(\d+(?:\.\d+)?)/))
  const serverNow = Number(matchValue(scriptText, /\bstart_time\s*=\s*(\d+(?:\.\d+)?)/))
  const options: HentaiVerseTrainingOption[] = []
  document.querySelectorAll<HTMLElement>('#train_table tr').forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
    const source = getActionSource(row, true)
    const sourceId =
      readNamedValue(source, 'start_train') ||
      matchValue(source, /training\.start_training\s*\(\s*(\d+)/i)
    if (!cells[0] || cells.length < 7) return
    const id = sourceId || `unavailable-${cells[0]}`
    const maxLevel = cells[6] && cells[6] !== '0' ? cells[6] : ''
    const duration = (cells[3] || '').replace(/^(\d+)\s*h$/i, (_, hours) =>
      formatSystemMessage('{p0} 小时', { p0: hours }),
    )
    options.push({
      id,
      name: translateHentaiVerseText(cells[0]),
      description: translateHentaiVerseDescription(cells[1] || ''),
      level: cells[4] && maxLevel ? `${cells[4]} / ${maxLevel}` : cells[4] || maxLevel,
      cost: cells[2] || '',
      duration,
      canStart:
        Boolean(sourceId) &&
        !active &&
        !row.matches('.disabled, [aria-disabled="true"]') &&
        !/unavailable|locked/i.test(row.className),
      unavailableReason: active
        ? '已有训练进行中'
        : !sourceId
          ? '源站当前不允许训练，请检查费用、等级及训练上限'
          : '',
    })
  })
  return {
    active,
    activeName: translateHentaiVerseText(
      cleanText(progressPane?.querySelector('strong')?.textContent),
    ),
    progress: progress && !progress.includes('%') ? `${progress}%` : progress,
    remaining: matchValue(progressText, /(?:Remaining|Time Left)\s*:?\s*(.+)$/i),
    ...(active &&
      totalSeconds > 0 &&
      endTime > 0 &&
      serverNow > 0 && {
        endsAt: Date.now() + Math.max(0, endTime - serverNow) * 1000,
        durationSeconds: totalSeconds,
      }),
    canCancel:
      active &&
      Boolean(document.querySelector('[name="cancel_train"], [onclick*="cancel_training"]')),
    options,
  }
}

function parseInventory(document: Document): HentaiVerseInventoryPage {
  const items = new Map<string, HentaiVerseInventoryItem>()
  document
    .querySelectorAll<HTMLElement>('#item_list tr, #item_list [data-item], .itemlist tr')
    .forEach((row) => {
      const source = getActionSource(row, true)
      const id =
        row.dataset.item ||
        readNamedValue(source, 'item') ||
        matchValue(row.querySelector<HTMLElement>('[id^="item_"]')?.id || '', /^item_(\d+)$/i) ||
        matchValue(`${row.id} ${source}`, /(?:item|set_item)[_(\s'"-]*(\d+)/i)
      const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
      const presentation = getHentaiVerseItemPresentation(id)
      const hover =
        row
          .querySelector<HTMLElement>('[onmouseover*="show_itemr_box"]')
          ?.getAttribute('onmouseover') || ''
      const detail = readQuotedArguments(hover).slice(-3)
      const name =
        presentation?.name ||
        readNodeLabel(row.querySelector<HTMLElement>('[data-item-name], td:first-child') || row)
      if (!id || !name) return
      items.set(id, {
        id,
        name,
        description:
          translateHentaiVerseDescription(
            cleanText(
              row.getAttribute('title') || row.dataset.description || cells.slice(1, -1).join(' '),
            ),
          ) ||
          presentation?.description ||
          translateHentaiVerseDescription(detail[1] || ''),
        canAssign: /set_item\s*\(/i.test(source),
        quantity: cells.at(-1) || row.dataset.quantity || '',
        selected: row.matches('.active, .selected, [aria-current="true"]'),
        category: detail[2] ? translateHentaiVerseText(detail[2]) : inventoryItemCategory(id),
      })
    })

  const slots: HentaiVerseInventorySlot[] = []
  document
    .querySelectorAll<HTMLElement>('#item_slots [onclick*="commit_slot"]')
    .forEach((node, index) => {
      const source = getActionSource(node, true)
      const id =
        node.dataset.slot || matchValue(source, /commit_slot\s*\(\s*(\d+)/i) || String(index + 1)
      const itemNode = node.querySelector<HTMLElement>('[id^="item_"]')
      const itemId = matchValue(itemNode?.id || '', /^item_(\d+)$/i)
      const assignedItemId = itemId === '0' ? '' : itemId
      slots.push({
        id,
        label: readInventorySlotLabel(id),
        itemId: assignedItemId,
        itemName: assignedItemId ? readNodeLabel(itemNode) : '',
        category: Number(id) >= 200 ? '附魔药' : Number(id) >= 100 ? '卷轴' : '恢复品',
      })
    })
  return { items: Array.from(items.values()), slots }
}

function parseForms(
  document: Document,
  pageSection: HentaiVersePage['section'],
): HentaiVerseFormBlock[] {
  if (
    [
      'equipment',
      'abilities',
      'training',
      'inventory',
      'arena',
      'ringOfBlood',
      'itemWorld',
    ].includes(pageSection)
  )
    return []
  return Array.from(document.forms)
    .map((form, index) => {
      const controls: HentaiVerseFormControl[] = []
      const hidden: Record<string, string> = {}
      const actions: HentaiVerseFormAction[] = []
      form
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
        >('input[name], input[type="submit"], input[type="button"], select[name], textarea[name], button')
        .forEach((element) => parseFormElement(form, element, controls, hidden, actions))
      if (!actions.length) {
        const clickAction = form.querySelector<HTMLElement>(
          '[onclick*=".submit"], [onclick*="submit()"]',
        )
        const label = readNodeLabel(clickAction)
        if (label) actions.push({ name: '', value: '', label })
      }
      if (
        !actions.length &&
        (pageSection === 'arena' || pageSection === 'ringOfBlood' || pageSection === 'grindfest')
      ) {
        actions.push(...parseBattleEntryActions(document, pageSection))
      }
      if (pageSection === 'settings') {
        controls.forEach((control) =>
          Object.assign(
            control,
            getHentaiVerseSettingControl(control.name, control.value, control.label),
          ),
        )
      }
      const heading = form.querySelector('h2, h3, legend') || findPreviousHeading(form)
      const sourceDescription = cleanText(form.querySelector('.fd4, .fc4, p')?.textContent)
      const sectionTitles: Partial<Record<HentaiVersePage['section'], string>> = {
        arena: '竞技场挑战',
        ringOfBlood: '鲜血之环挑战',
        grindfest: '混战祭',
        itemWorld: '装备界',
      }
      return {
        id: form.id || `hv-form-${index}`,
        title:
          pageSection === 'settings'
            ? '战斗设置项目'
            : sectionTitles[pageSection] ||
              translateHentaiVerseText(heading?.textContent || form.getAttribute('name') || '操作'),
        description: translateHentaiVerseDescription(
          sourceDescription || readSectionDescription(document, pageSection),
        ),
        section: inferFormSection(pageSection, controls, hidden, actions),
        hidden,
        controls,
        actions,
        groups:
          pageSection === 'settings'
            ? HENTAIVERSE_SETTING_GROUPS.map((group) =>
                group.key === 'autocast'
                  ? {
                      ...group,
                      description: formatSystemMessage('{p0} 当前已保存配置：{p1}', {
                        p0: group.description,
                        p1: translateHentaiVerseDescription(
                          cleanText(document.querySelector('#settings_upkeep')?.textContent),
                        ),
                      }),
                    }
                  : group,
              )
            : undefined,
      }
    })
    .filter((form) => form.controls.length || form.actions.length)
}

function parseFormElement(
  form: HTMLFormElement,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement,
  controls: HentaiVerseFormControl[],
  hidden: Record<string, string>,
  actions: HentaiVerseFormAction[],
) {
  const name = element.name
  if (
    element instanceof HTMLButtonElement ||
    (element instanceof HTMLInputElement && ['submit', 'button'].includes(element.type))
  ) {
    const label = translateHentaiVerseText(element.textContent || element.value || name)
    if (!label) return
    actions.push({
      name,
      value: element.value || '1',
      label,
      danger: /reset|cancel|unequip|delete/i.test(`${name} ${element.value}`),
      disabled: element.disabled,
    })
    return
  }
  if (!name) return
  if (element instanceof HTMLInputElement && element.type === 'hidden') {
    hidden[name] = element.value
    return
  }
  const inputType =
    element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase()
  const type = normalizeControlType(inputType)
  const value =
    element instanceof HTMLSelectElement
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
    disabled: element.disabled,
    help:
      name === 'title_override'
        ? value === '0'
          ? '根据当前角色等级自动选择称号'
          : translateHentaiVerseDescription(
              cleanText(element.closest('tr')?.querySelector('td:nth-child(2)')?.textContent),
            )
        : undefined,
    options:
      element instanceof HTMLSelectElement
        ? Array.from(element.options, (option) => ({
            label: translateHentaiVerseText(option.text),
            value: option.value,
            selected: option.selected,
          }))
        : undefined,
    min: element instanceof HTMLInputElement && element.min ? Number(element.min) : undefined,
    max: element instanceof HTMLInputElement && element.max ? Number(element.max) : undefined,
    step: element instanceof HTMLInputElement && element.step ? Number(element.step) : undefined,
  })
}

function parseBattleEntryActions(
  document: Document,
  pageSection: Extract<HentaiVersePage['section'], 'arena' | 'ringOfBlood' | 'grindfest'>,
): HentaiVerseFormAction[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[onclick*="init_battle"]')).flatMap(
    (node) => {
      const id = matchValue(node.getAttribute('onclick') || '', /init_battle\s*\(\s*(\d+)/i)
      if (!id) return []
      const challengeName = translateHentaiVerseText(
        cleanText(node.closest('tr')?.querySelector('td:first-child')?.textContent),
      )
      const prefix =
        pageSection === 'arena'
          ? '开始竞技场挑战'
          : pageSection === 'grindfest'
            ? '开始混战祭'
            : '进入鲜血之环'
      return [
        {
          name: 'initid',
          value: id,
          label: challengeName
            ? formatSystemMessage('{p0}：{p1}', { p0: prefix, p1: challengeName })
            : prefix,
        },
      ]
    },
  )
}

function readSectionDescription(document: Document, pageSection: HentaiVersePage['section']) {
  if (pageSection === 'grindfest') {
    const rules = Array.from(document.querySelectorAll('#mainpane p'), (node) =>
      translateHentaiVerseDescription(cleanText(node.textContent)),
    ).filter(Boolean)
    if (rules.length) return rules.join(' ')
  }
  const fallbacks: Partial<Record<HentaiVersePage['section'], string>> = {
    arena: '选择一项当前等级可参加的竞技场挑战。开始前会再次确认。',
    ringOfBlood: '消耗对应入场券参加鲜血之环挑战。',
    grindfest: '混战祭最多包含 1000 轮战斗，开始时消耗 1 点体力。',
    itemWorld: '选择已完成灵魂绑定的装备，进入其装备界提升潜能。',
  }
  const preferredSelectors: Partial<Record<HentaiVersePage['section'], string>> = {
    settings: '#mainpane > p, #settings_outer > p',
    arena: '#arena_outer p, #mainpane > p',
    ringOfBlood: '#ring_outer p, .stuffbox, #mainpane > p',
    grindfest: '#grindfest_outer p, #mainpane > p',
    itemWorld: '#equiplist p, #equipblurb p',
  }
  const selector = preferredSelectors[pageSection] || '#mainpane > p'
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((node) => cleanText(node.textContent))
      .find((text) => text.length >= 16 && text.length <= 1200) ||
    fallbacks[pageSection] ||
    ''
  )
}

function parseBattleDocument(document: Document, token: string): HentaiVerseBattleSnapshot {
  if (isVerificationDocument(document)) {
    return {
      token,
      title: 'HentaiVerse 战斗',
      verificationRequired: true,
      vitals: [],
      effects: [],
      monsters: [],
      actions: [],
      log: [],
      completed: false,
      roundCompleted: false,
      completionText: '',
    }
  }
  const monsters = parseMonsters(document)
  protectTranslationNames(monsters.map((monster) => monster.name))
  const completionPane = document.querySelector<HTMLElement>('#pane_completion')
  const completionText = readBattleCompletion(completionPane)
  // Active battles keep an empty completion pane in the DOM as an AJAX target.
  const roundCompleted = Boolean(completionText)
  const sourceCompletion = cleanText(completionPane?.textContent)
  const completed =
    roundCompleted &&
    /Arena challenge cleared|You have been defeated|You have escaped from the battle|You escape from the arena/i.test(
      sourceCompletion,
    )
  const victorious =
    roundCompleted &&
    /\bYou are victorious\b|\bArena challenge cleared\b/i.test(
      cleanText(completionPane?.textContent),
    )
  if (victorious) {
    // Victory responses can remove health bars instead of returning zero-width bars.
    monsters.forEach((monster) => {
      monster.defeated = true
      monster.healthPercent = 0
    })
  }
  const sourceTitle = cleanText(document.querySelector('#pane_battle h1, h1, title')?.textContent)
  return {
    token,
    title: /^(?:The )?HentaiVerse$/i.test(sourceTitle)
      ? 'HentaiVerse 战斗'
      : translateHentaiVerseText(sourceTitle || 'HentaiVerse 战斗'),
    vitals: parseBattleVitals(document),
    effects: parseBattleEffects(document),
    monsters,
    actions: roundCompleted ? [] : parseBattleActions(document),
    log: parseBattleLog(document).slice(-40),
    completed,
    completionText,
    roundCompleted,
    effectIds: document.querySelector('#pane_effects')
      ? Array.from(
          document.querySelectorAll<HTMLElement>(
            '#pane_effects [onmouseover*="set_infopane_effect"]',
          ),
          (node) =>
            readBattleHoverArguments(node.getAttribute('onmouseover') || '')[0]
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, '') || '',
        ).filter(Boolean)
      : undefined,
    overcharge: (() => {
      const value = cleanText(document.querySelector('#pane_vitals')?.textContent).match(
        /\b(?:Overcharge|OC)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/i,
      )
      return value ? Number(value[1]) : undefined
    })(),
  }
}

function parseBattleEffects(document: Document) {
  const pane = document.querySelector('#pane_effects')
  if (!pane) return []
  const names = Array.from(
    pane.querySelectorAll<HTMLElement>('[onmouseover*="set_infopane_effect"]'),
    (node) =>
      translateHentaiVerseText(
        matchValue(
          node.getAttribute('onmouseover') || '',
          /set_infopane_effect\s*\(\s*['"]([^'"]+)/i,
        ),
      ),
  ).filter(Boolean)
  return Array.from(new Set([...names, ...readTextRows(pane).map(translateHentaiVerseText)]))
}

function readBattleCompletion(pane?: HTMLElement | null) {
  if (!pane) return ''
  const lines = Array.from(pane.querySelectorAll<HTMLElement>('#btcp > div'), (node) =>
    cleanText(node.textContent),
  ).filter(Boolean)
  if (lines.length) return lines.map(translateHentaiVerseBattleLog).join(' ')
  const text =
    cleanText(pane.textContent) ||
    cleanText(
      pane.querySelector<HTMLElement>('[title], [aria-label], img[alt]')?.getAttribute('title'),
    ) ||
    cleanText(pane.querySelector<HTMLElement>('[aria-label]')?.getAttribute('aria-label')) ||
    cleanText(pane.querySelector<HTMLImageElement>('img[alt]')?.alt)
  return text ? translateHentaiVerseBattleLog(text) : ''
}

function parseBattleVitals(document: Document) {
  const fields: Array<
    Omit<HentaiVerseBattleVital, 'value' | 'percent'> & {
      id: string
      bar: string
      maxWidth: number
    }
  > = [
    { key: 'health', id: 'vrhb', bar: '#vbh img', label: '生命', maxWidth: 492 },
    { key: 'magic', id: 'vrm', bar: '#vbm img', label: '魔力', maxWidth: 207 },
    { key: 'spirit', id: 'vrs', bar: '#vbs img', label: '灵力', maxWidth: 207 },
  ]
  return fields.flatMap(({ key, id, bar, label, maxWidth }) => {
    const node =
      document.getElementById(id) || (key === 'health' ? document.getElementById('vrhd') : null)
    const value = cleanText(node?.textContent)
    const image = document.querySelector<HTMLImageElement>(bar)
    if (!value && !image) return []
    const numbers = value.match(/^([\d,]+)(?:\s*\/\s*([\d,]+))?$/)
    const current = numbers ? Number(numbers[1]!.replace(/,/g, '')) : undefined
    const maximum = numbers?.[2] ? Number(numbers[2].replace(/,/g, '')) : undefined
    const percent =
      maximum && current !== undefined
        ? Math.round((current / maximum) * 100)
        : readBattleBarPercent(image, maxWidth)
    return [
      {
        key,
        label,
        value: value || '—',
        percent: percent ?? 0,
        current,
        maximum,
        percentKnown: percent !== undefined,
      },
    ]
  })
}

function parseBattleLog(document: Document) {
  const log = document.querySelector('#textlog')
  if (!log) return []

  const topLevelRows = Array.from(
    log.querySelectorAll<HTMLElement>(
      ':scope > tbody > tr, :scope > tr, :scope > table > tbody > tr, :scope > table > tr',
    ),
  )
  if (!topLevelRows.length) return readTextRows(log).reverse().map(translateHentaiVerseBattleLog)

  return topLevelRows.reverse().flatMap((row) => {
    const nestedTable = row.querySelector('table')
    if (!nestedTable) return [translateHentaiVerseBattleLog(cleanText(row.textContent))]

    const summaryNode = row.cloneNode(true) as HTMLElement
    summaryNode.querySelectorAll('table').forEach((table) => table.remove())
    const summary = translateHentaiVerseBattleLog(cleanText(summaryNode.textContent))
    const details = Array.from(
      nestedTable.querySelectorAll<HTMLElement>(':scope > tbody > tr, :scope > tr'),
    )
      .map((detail) => translateHentaiVerseBattleLog(cleanText(detail.textContent)))
      .filter(Boolean)
    return [summary, ...details].filter(Boolean)
  })
}

function parseMonsters(document: Document): HentaiVerseBattleMonster[] {
  const monsters = new Map<number, HentaiVerseBattleMonster>()
  document
    .querySelectorAll<HTMLElement>('#pane_monster > [id^="mkey_"], #pane_monster [data-mid]')
    .forEach((node, index) => {
      const idText = node.id || node.getAttribute('data-mid') || ''
      const id = Number(matchValue(idText, /(\d+)/) || index + 1)
      const rawName = cleanText(
        node.querySelector('.btm3, .monstername, strong')?.textContent || node.textContent,
      )
      const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : ''
      if (!name || monsters.has(id)) return
      const level = cleanText(node.querySelector('.btm2 > div:nth-child(2)')?.textContent)
      const health = readBattleBarPercent(node.querySelector<HTMLImageElement>('img[alt="health"]'))
      const magic = readBattleBarPercent(node.querySelector<HTMLImageElement>('img[alt="magic"]'))
      const status = level ? formatSystemMessage('等级 {p0}', { p0: level }) : ''
      monsters.set(id, {
        id,
        name,
        status,
        healthPercent: health,
        magicPercent: magic,
        defeated: health === 0 || /dead|defeated/i.test(`${node.className} ${node.textContent}`),
      })
    })
  return Array.from(monsters.values())
}

function parseBattleActions(document: Document): HentaiVerseBattleAction[] {
  const actions = new Map<string, HentaiVerseBattleAction>()
  document.querySelectorAll<HTMLElement>('[onclick]').forEach((node) => {
    const onclick = node.getAttribute('onclick') || ''
    const baseMatch = onclick.match(
      /battle\.lock_action\s*\(\s*this\s*,\s*0\s*,\s*['"](attack|skill|items|spirit|defend|focus)['"]/i,
    )
    if (baseMatch) {
      const rawMode = baseMatch[1]?.toLowerCase()
      if (rawMode === 'skill' || rawMode === 'items') return
      const mode = rawMode as HentaiVerseBattleMode
      const presentation = getBattleActionPresentation(node, mode)
      actions.set(`${mode}:0`, {
        ...presentation,
        mode,
        skill: 0,
        target: mode === 'attack' ? 'enemy' : 'none',
        available: !node.matches('[disabled], [aria-disabled="true"], .disabled'),
        manaCost: 0,
        kind: mode === 'attack' ? 'offense' : 'other',
      })
      return
    }

    const skillMatch = onclick.match(
      /battle\.lock_action\s*\(\s*this\s*,\s*1\s*,\s*['"](magic|items)['"]\s*,\s*(\d+)/i,
    )
    if (!skillMatch) return
    const mode = skillMatch[1]?.toLowerCase() as HentaiVerseBattleMode
    const skill = Number(skillMatch[2] || 0)
    const hostile = /set_hostile_skill/i.test(onclick)
    const presentation = getBattleActionPresentation(node, mode, skill)
    actions.set(`${mode}:${skill}`, {
      ...presentation,
      mode,
      skill,
      target: hostile ? 'enemy' : 'self',
      ...readBattleSpellState(node),
    })
  })
  // The skillbook is authoritative; quickbar entries can omit cost and cooldown state.
  document
    .querySelectorAll<HTMLElement>('#table_magic [onmouseover*="set_infopane_spell"]')
    .forEach((node) => {
      const skill = Number(node.id)
      if (!/^\d+$/.test(node.id)) return
      const onclick = node.getAttribute('onclick') || ''
      const state = readBattleSpellState(node)
      actions.set(`magic:${skill}`, {
        ...getBattleActionPresentation(node, 'magic', skill),
        mode: 'magic',
        skill,
        target: /set_hostile_skill/i.test(onclick) || state.kind === 'offense' ? 'enemy' : 'self',
        ...state,
      })
    })
  return Array.from(actions.values())
}

/** Read source tooltip arguments without evaluating its JavaScript. */
function readBattleHoverArguments(hover: string): string[] {
  const call = hover.match(/set_infopane(?:_spell|_effect)?\s*\(/i)
  if (!call || call.index === undefined) return []
  const argumentsList: string[] = []
  let quote = ''
  let escaped = false
  let value = ''
  for (const character of hover.slice(call.index + call[0].length)) {
    if (escaped) {
      value += character
      escaped = false
      continue
    }
    if (character === '\\' && quote) {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = ''
      else value += character
    } else if (character === "'" || character === '"') quote = character
    else if (character === ',' || character === ')') {
      argumentsList.push(value.trim())
      value = ''
      if (character === ')') break
    } else value += character
  }
  return argumentsList
}

function readBattleSpellState(node: HTMLElement) {
  const argumentsList = readBattleHoverArguments(node.getAttribute('onmouseover') || '')
  const sourceName = argumentsList[0] || ''
  const name = sourceName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const offensive = new Set([
    'fieryblast',
    'inferno',
    'flamesofloki',
    'freeze',
    'blizzard',
    'fimbulvetr',
    'shockblast',
    'chainedlightning',
    'wrathofthor',
    'gale',
    'downburst',
    'stormsofnjord',
    'smite',
    'banishment',
    'paradiselost',
    'corruption',
    'disintegrate',
    'ragnarok',
  ])
  const kind: HentaiVerseBattleAction['kind'] =
    name === 'cure'
      ? 'heal'
      : name === 'fullcure'
        ? 'full-heal'
        : name === 'regen'
          ? 'regen'
          : offensive.has(name)
            ? 'offense'
            : 'other'
  return {
    sourceName,
    kind,
    manaCost: /^\d+(?:\.\d+)?$/.test(argumentsList[3] || '') ? Number(argumentsList[3]) : undefined,
    available:
      Boolean(node.getAttribute('onclick')?.trim()) &&
      !node.matches('[disabled], [aria-disabled="true"], .disabled'),
  }
}

const BATTLE_ACTION_DESCRIPTIONS: Record<string, string> = {
  attack: '对选中的怪物发动一次普通物理攻击。',
  spirit:
    '至少拥有 50% 过载值时可开启；物理伤害提升 100%，魔力消耗降低 25%，每回合消耗 1 点灵力和 10% 过载值。再次使用可关闭。',
  defend:
    '本回合及下一回合的物理与魔法减伤提升 25%；过载值充足时消耗 25% 过载值，恢复 10% 基础生命。',
  focus:
    '消耗 25% 过载值恢复 5% 基础魔力；本回合闪避、格挡、招架和抵抗降为 0，下一回合提高魔法命中与反抵抗。',
  flee: '逃离当前战斗。',
  scan: '获取选中怪物的能力、攻击方式与抗性信息，会消耗一个回合。',
  cure: '为自己恢复适量生命值。',
}

function getBattleActionPresentation(node: HTMLElement, mode: HentaiVerseBattleMode, skill = 0) {
  const hover = node.getAttribute('onmouseover') || ''
  const scripted = hover.match(
    /set_infopane(?:_spell)?\s*\(\s*['"]([^'"]+)(?:['"]\s*,\s*['"]([^'"]*))?/i,
  )
  const image =
    node instanceof HTMLImageElement ? node : node.querySelector<HTMLImageElement>('img')
  const sourceName = matchValue(image?.src || '', /\/([^/]+?)(?:_[ns])?\.png$/i)
  const sourceLabel =
    scripted?.[1] ||
    cleanText(
      node.getAttribute('title') ||
        node.getAttribute('aria-label') ||
        image?.alt ||
        node.textContent,
    ) ||
    (skill
      ? formatSystemMessage('{p0} {p1}', { p0: mode === 'items' ? '物品' : '技能', p1: skill })
      : sourceName || mode)
  const item = mode === 'items' ? getHentaiVerseItemPresentation(String(skill)) : undefined
  return {
    label:
      item?.name ||
      (mode === 'spirit' && !skill ? '灵力姿态' : translateHentaiVerseText(sourceLabel)),
    description:
      item?.description ||
      BATTLE_ACTION_DESCRIPTIONS[sourceLabel.toLowerCase()] ||
      BATTLE_ACTION_DESCRIPTIONS[mode] ||
      translateHentaiVerseDescription(cleanText(scripted?.[2])) ||
      formatSystemMessage('执行{p0}操作。', { p0: translateHentaiVerseText(sourceLabel) }),
  }
}

function readBattleBarPercent(image?: HTMLImageElement | null, maxWidth = 120) {
  if (!image) return
  if (image.style.width.trim().endsWith('%'))
    return Math.max(0, Math.min(100, Number.parseFloat(image.style.width)))
  const width = Number.parseFloat(image.style.width || image.getAttribute('width') || '')
  if (!Number.isFinite(width)) return
  return Math.max(0, Math.min(100, Math.round((width / maxWidth) * 100)))
}

function inferFormSection(
  pageSection: HentaiVersePage['section'],
  controls: HentaiVerseFormControl[],
  hidden: Record<string, string>,
  actions: HentaiVerseFormAction[],
): HentaiVerseFormSection {
  const names = [
    ...controls.map((item) => item.name),
    ...Object.keys(hidden),
    ...actions.map((item) => item.name),
  ].join(' ')
  if (/persona_/.test(names)) return 'persona'
  if (pageSection === 'character') return 'character'
  return pageSection as HentaiVerseFormSection
}

function readControlLabel(form: HTMLFormElement, element: HTMLElement, fallback: string) {
  const explicit =
    'labels' in element ? (element.labels as NodeListOf<HTMLLabelElement> | null)?.item(0) : null
  const wrappingLabel = element.closest('label')
  const rowLabel = element.closest('tr')?.querySelector('td:first-child, th:first-child')
  const label =
    [
      explicit?.textContent,
      wrappingLabel?.textContent,
      rowLabel?.textContent,
      element.getAttribute('title'),
    ]
      .map((value) => cleanText(value))
      .find(Boolean) || fallback.replace(/_/g, ' ')
  return translateHentaiVerseText(label)
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
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '.stuffbox, #messagebox, #message_box, [role="alert"], .notice, .errorbox, #arena_list td[colspan], #mainpane > p',
    ),
  )
    .map((node) => translateHentaiVerseDescription(cleanText(node.textContent)))
    .filter(
      (value, index, values) => value && value.length <= 500 && values.indexOf(value) === index,
    )
    .slice(0, 8)
}

function readCharacterName(document: Document, personaName: string) {
  return (
    cleanText(document.querySelector('#character_name, .charname, h1')?.textContent) ||
    personaName ||
    'HentaiVerse'
  )
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
    ? [
        node,
        ...Array.from(
          node.querySelectorAll<HTMLElement>(
            '[onclick], a[href], input[name], button[name], select[name]',
          ),
        ),
      ]
    : [node]
  return nodes
    .map((item) =>
      [
        item.id,
        item.getAttribute('onclick'),
        item.getAttribute('href'),
        item.getAttribute('name') &&
          `${item.getAttribute('name')}=${item.getAttribute('value') || ''}`,
        ...Object.entries(item.dataset).flat(),
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ')
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
  return translateHentaiVerseText(
    cleanText(
      node.dataset.label ||
        node.getAttribute('aria-label') ||
        node.getAttribute('title') ||
        image?.alt ||
        image?.title ||
        node.textContent,
    ),
  )
}

function readEquipmentId(node: HTMLElement) {
  const source = [
    getActionSource(node, true),
    node.getAttribute('onmouseover'),
    ...Array.from(node.querySelectorAll<HTMLElement>('[onmouseover]'), (child) =>
      child.getAttribute('onmouseover'),
    ),
  ].join(' ')
  return (
    node.dataset.eid ||
    node.dataset.equipId ||
    node.querySelector<HTMLInputElement>('input[name="eqids[]"]')?.value ||
    readNamedValue(source, 'equip_id') ||
    matchValue(source, /(?:select_equip|show_equip_popup|hover_equip)\s*\(\s*(\d+)/i) ||
    matchValue(source, /equips?\.set\s*\(\s*(\d+)/i) ||
    matchValue(node.id, /^e(\d+)$/i)
  )
}

function readEquipmentName(node: HTMLElement) {
  const nameNode = node.querySelector<HTMLElement>('[data-equip-name], .equip-name, td:first-child')
  return readNodeLabel(nameNode || node)
}

function readEquipmentSlotLabel(id: string, node: HTMLElement) {
  const explicit = cleanText(
    node.dataset.slotLabel || node.getAttribute('aria-label') || node.getAttribute('title'),
  )
  if (explicit) return translateHentaiVerseText(explicit)
  const labels: Record<string, string> = {
    '1': '主武器',
    '2': '副武器',
    '9': '副武器',
    '13': '头部',
    '11': '身体',
    '14': '手部',
    '12': '腿部',
    '15': '脚部',
  }
  return labels[id] || formatSystemMessage('部位 {p0}', { p0: id })
}

function readInventorySlotLabel(id: string) {
  const numericId = Number(id)
  if (numericId >= 1 && numericId < 100)
    return formatSystemMessage('恢复品槽 {p0}', { p0: numericId })
  if (numericId >= 100 && numericId < 200)
    return formatSystemMessage('卷轴槽 S{p0}', { p0: numericId - 100 })
  if (numericId >= 200 && numericId < 300)
    return formatSystemMessage('附魔药槽 N{p0}', { p0: numericId - 200 })
  return formatSystemMessage('物品槽 {p0}', { p0: id })
}

function readAbilityPresentation(row: HTMLElement) {
  const hover =
    (row.matches('[onmouseover*="overability"]')
      ? row
      : row.querySelector<HTMLElement>('[onmouseover*="overability"]')
    )?.getAttribute('onmouseover') || ''
  const quoted = `('(?:\\\\.|[^'])*'|"(?:\\\\.|[^"])*")`
  const match = hover.match(
    new RegExp(
      `overability\\(\\s*[^,]+,\\s*${quoted}\\s*,\\s*${quoted}\\s*,\\s*${quoted}\\s*,\\s*${quoted}`,
      'i',
    ),
  )
  if (!match)
    return {
      name: '',
      description: '',
      status: '',
      requirement: '',
      currentEffect: '',
      nextEffect: '',
    }
  const readValue = (value = '') => value.slice(1, -1).replace(/\\(['"\\])/g, '$1')
  const requirementHtml = readValue(match[4]).split(/<div/i)[0] || ''
  const requirementText = cleanText(
    parser.parseFromString(`<body>${requirementHtml}</body>`, 'text/html').body.textContent,
  )
  const requirementMatch = requirementText.match(/Requires Level (\d+) and (\d+) Ability Points?/i)
  return {
    name: readValue(match[1]),
    description: readValue(match[2]),
    status: readValue(match[3]),
    currentEffect: translateHentaiVerseDescription(readHtmlText(readValue(match[3]))),
    nextEffect: translateHentaiVerseDescription(readHtmlText(readValue(match[4]))),
    requirement: requirementMatch
      ? formatSystemMessage('需要等级 {p0}，消耗 {p1} 点能力点', {
          p0: requirementMatch[1],
          p1: requirementMatch[2],
        })
      : translateHentaiVerseText(requirementText),
  }
}

function readHtmlText(html: string) {
  return cleanText(
    parser.parseFromString(
      html.replace(/<(?:div|br)[^>]*>/gi, ' $&').replace(/<\/div>/gi, '</div> '),
      'text/html',
    ).body.textContent,
  )
}

function readQuotedArguments(source: string) {
  return Array.from(source.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g), (match) =>
    (match[1] ?? match[2] ?? '').replace(/\\(['"\\])/g, '$1'),
  )
}

function readOptionalNumber(source: string, pattern: RegExp) {
  const value = source.match(pattern)?.[1]
  return value === undefined ? undefined : Number(value)
}

function readAbilityGroup(node: HTMLElement) {
  const style =
    node.getAttribute('style') || node.querySelector('[style*="/ab/"]')?.getAttribute('style') || ''
  const key = style.match(/\/ab\/([rgbp])[ul]\.png/)?.[1] || ''
  return (
    ({ r: '主要能力', g: '辅助能力', b: '防护增强', p: '吸取增强' } as Record<string, string>)[
      key
    ] || '主要能力'
  )
}

function inventoryItemCategory(id: string) {
  const value = Number(id)
  if (value >= 13000 && value < 14000) return '卷轴'
  if (value >= 12000 && value < 13000) return '附魔药'
  return '恢复品'
}

function parseChallenges(document: Document): HentaiVerseChallenge[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#arena_list tr')).flatMap(
    (row, index) => {
      const cells = Array.from(row.querySelectorAll('td'), (cell) => cleanText(cell.textContent))
      if (cells.length < 6 || !cells[0]) return []
      const source = getActionSource(row, true)
      const id = matchValue(source, /init_battle\s*\(\s*(\d+)/i)
      const cooldown = cells.find((cell) => /cooldown/i.test(cell))
      return [
        {
          id: id || `unavailable-${index}`,
          name: translateHentaiVerseText(cells[0]),
          highestClear: translateHentaiVerseText(cells[1] || ''),
          minLevel: translateHentaiVerseText(cells[2] || ''),
          rounds: cells[3] || '',
          experienceModifier: cells[4] || '',
          entryCost: cooldown ? '' : translateHentaiVerseText(cells[5] || ''),
          clearBonus: cooldown ? '' : translateHentaiVerseText(cells[6] || ''),
          unavailableReason: cooldown
            ? translateHentaiVerseDescription(cooldown)
            : !id
              ? '源站暂未开放，请检查等级及前置挑战'
              : '',
          available: Boolean(id),
        },
      ]
    },
  )
}

function parseItemWorld(
  document: Document,
  scriptText: string,
  target: HentaiVersePageTarget,
): HentaiVerseItemWorldPage {
  const equipment = parseEquipment(document, scriptText, target)
  const definitions = [
    ['weapon_1handed', '单手武器'],
    ['weapon_2handed', '双手武器'],
    ['weapon_staff', '法杖'],
    ['shield', '盾牌'],
    ['armor_cloth', '布甲'],
    ['armor_light', '轻甲'],
    ['armor_heavy', '重甲'],
  ]
  const selectedCategory = target.filter || 'weapon_1handed'
  const entryInfo: HentaiVerseItemWorldPage['entryInfo'] = {}
  const rawData = scriptText.match(/\b(?:const|let|var)\s+eqitems\s*=\s*(\{[\s\S]*?\})\s*;/)?.[1]
  if (rawData) {
    try {
      const data = JSON.parse(rawData) as Record<string, { p?: Record<string, unknown> }>
      Object.entries(data).forEach(([id, item]) => {
        const info = item?.p
        if (!info || !/^\d+$/.test(id)) return
        entryInfo[id] = {
          level: String(info.iwlvl ?? ''),
          rounds: String(info.rounds ?? ''),
          monsterLevel: String(info.monsterlevel ?? ''),
          difficulty:
            translateHentaiVerseText(String(info.diffname ?? '')) +
            (Number(info.diffboost) > 0 ? ` +${info.diffboost}%` : ''),
          cost: String(info.req_worldseeds ?? ''),
          available:
            Number.isFinite(Number(info.req_worldseeds)) &&
            Number(info.has_worldseeds) >= Number(info.req_worldseeds),
        }
      })
    } catch {
      /* Keep entry disabled when the source confirmation data cannot be read. */
    }
  }
  return {
    categories: definitions.map(([value, label]) => ({
      value: value!,
      label: label!,
      selected: value === selectedCategory,
    })),
    selectedCategory,
    candidates: equipment.candidates,
    postToken: equipment.postToken,
    worldSeeds: matchValue(
      cleanText(document.querySelector('#mainpane')?.textContent),
      /Available World Seeds:\s*([\d,]+)/i,
    ),
    rules: Array.from(document.querySelectorAll('#equipblurb p'), (node) =>
      translateHentaiVerseDescription(cleanText(node.textContent)),
    ).filter(Boolean),
    emptyReason: translateHentaiVerseDescription(
      cleanText(document.querySelector('#equiplist p')?.textContent),
    ),
    entryInfo,
  }
}

function readAbilityAction(
  source: string,
): { name: HentaiVerseAbilityActionName; value: string } | undefined {
  const names: HentaiVerseAbilityActionName[] = [
    'unlock_ability',
    'reset_ability',
    'unlock_slot',
    'equip_ability',
  ]
  for (const name of names) {
    const value = readNamedValue(source, name)
    if (value) return { name, value }
  }
  return
}

function countActiveAbilityLevels(row: HTMLElement) {
  const tiers = Array.from(row.querySelectorAll<HTMLElement>(':scope > div:nth-child(3) > div'))
  const sourceBars = tiers.map((node) =>
    node.style.backgroundImage.match(/\/ab\/\d+(rf|x)\.png/i)?.[1]?.toLowerCase(),
  )
  if (sourceBars.length && sourceBars.every(Boolean)) {
    return sourceBars.filter((state) => state === 'rf').length
  }
  // Count only recognizable acquired/empty markers. Unknown markup must not
  // turn every tier into an acquired level, or silently display zero.
  const acquired = (node: HTMLElement) =>
    node.matches(
      '.active, .acquired, .unlocked, .filled, [data-acquired="true"], [aria-checked="true"]',
    )
  const empty = (node: HTMLElement) =>
    node.matches('.disabled, .locked, .empty, [data-acquired="false"], [aria-disabled="true"]') ||
    node.style.opacity === '0.3'
  if (tiers.length && tiers.every((node) => acquired(node) || empty(node))) {
    return tiers.filter((node) => acquired(node) && !empty(node)).length
  }
  return null
}

function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function matchValue(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1] || ''
}
