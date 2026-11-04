// Development-only fixtures for reviewing the real Vue screens in the local app.
// Install from the localhost DevTools console; restore() removes all overrides.
import {
  shell,
  marketHtml,
  marketTarget,
  characterTarget,
  battleFixture,
} from './hv-remediation-checks.mjs'
import { parseFixturePage as parseHentaiVersePage } from './hv-remediation-checks.mjs'
import { HentaiVerseBusi } from '/src/core/hentaiverse/hentaiVerseBusi.ts'
import {
  getHentaiVerseSection,
  HENTAIVERSE_SECTIONS,
} from '/src/core/hentaiverse/hentaiVerseProtocol.ts'
import { authState } from '/src/core/auth/authState.ts'
import { hentaiVerseWorld } from '/src/core/hentaiverse/hentaiVerseWorld.ts'
import { hentaiVerseState, clearHentaiVerseState } from '/src/core/hentaiverse/hentaiVerseStore.ts'
import { locale, setLocale } from '/src/i18n/index.ts'
import router from '/src/router/index.ts'

function characterPage() {
  return parseHentaiVersePage(
    shell(
      '<div id="character_name">离线回归角色</div><div id="level_readout">Level 120</div><div id="stamina_readout">Stamina: 90</div>',
      'var usable_exp = 100000; var attr_current = {"str":11,"dex":10,"agi":10,"end":10,"int":10,"wis":10};',
    ),
    characterTarget,
  )
}
function exampleForm(section) {
  return {
    id: section,
    title: section === 'settings' ? '战斗设置' : '进入挑战',
    description: '进入后需要完成或退出当前战斗。',
    section,
    hidden: {},
    groups: [],
    controls:
      section === 'settings'
        ? [
            {
              name: 'fixture_number',
              label: '生命阈值',
              type: 'number',
              value: '50',
              min: 0,
              max: 100,
            },
          ]
        : [],
    actions: [
      {
        name: section === 'settings' ? 'save' : 'initid',
        value: '1',
        label: section === 'settings' ? '保存设置' : '开始战斗',
      },
    ],
  }
}
function equipmentCandidates() {
  return [
    {
      id: '100',
      name: '传奇 轻盈的秘银头盔',
      description: '适合轻甲角色的防护装备。',
      locked: false,
      equipped: true,
    },
    {
      id: '101',
      name: '华丽 红木法杖',
      description: '增加魔法攻击。',
      locked: false,
      equipped: false,
    },
  ]
}
function bazaarPage(kind) {
  return {
    ...parseHentaiVersePage(marketHtml(), marketTarget).bazaar,
    kind,
    navigation: [],
    tables: [],
    itemName: '',
    orders: [],
    items: [],
    links: [],
  }
}
function makePage(target, variant) {
  const section = getHentaiVerseSection(target)
  const page = {
    ...characterPage(),
    section,
    world: hentaiVerseWorld.value,
    metrics: [],
    attributes: [],
    statGroups: [],
    forms: [],
    notices: [],
  }
  if (section === 'character')
    return {
      ...characterPage(),
      statGroups: [
        {
          title: '战斗属性',
          metrics: [
            { label: '攻击力', value: '1200' },
            { label: '防御力', value: '800' },
          ],
        },
      ],
    }
  addCharacterFixtures(page, target)
  addBattleFixtures(page)
  addServiceFixtures(page, target, variant)
  return page
}

function addCharacterFixtures(page, target) {
  const section = page.section
  if (section === 'abilities')
    page.abilities = {
      selectedTree: target.tree || 'general',
      abilityPoints: '12',
      masteryPoints: '4',
      canResetAll: true,
      resetCost: 10,
      trees: [
        { id: 'general', label: '通用', active: !target.tree || target.tree === 'general' },
        { id: 'staff', label: '法杖', active: target.tree === 'staff' },
      ],
      abilities: Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 1),
        name: ['生命强化', '魔力强化', '精神强化', '急救', '防御强化'][i],
        description: '提升角色在战斗中的基础能力。',
        level: 1,
        maxLevel: 5,
        cost: '1 AP',
        action: 'unlock_ability',
        actionLabel: '升级',
        disabled: false,
        group: '通用',
        currentEffect: '+10%',
        nextEffect: '+15%',
      })),
      slots: Array.from({ length: 6 }, (_, i) => ({
        id: String(i + 1),
        label: `槽位 ${i + 1}`,
        abilityId: i === 0 ? '1' : '',
        abilityName: i === 0 ? '生命强化' : '',
        locked: i === 5,
        group: '通用',
        unlockCost: 1,
      })),
    }
  if (section === 'inventory')
    page.inventory = {
      items: [
        {
          id: '1',
          name: '治疗药水',
          description: '恢复生命。',
          quantity: '25',
          category: '药水',
          selected: false,
          canAssign: true,
        },
        {
          id: '2',
          name: '魔力药水',
          description: '恢复魔力。',
          quantity: '18',
          category: '药水',
          selected: false,
          canAssign: true,
        },
        {
          id: '3',
          name: '世界种子',
          description: '进入装备界时消耗。',
          quantity: '8',
          category: '材料',
          selected: false,
          canAssign: false,
        },
      ],
      slots: [
        { id: '1', label: '物品槽 1', itemId: '1', itemName: '治疗药水', category: '药水' },
        { id: '2', label: '物品槽 2', itemId: '', itemName: '', category: '药水' },
      ],
    }
  if (section === 'equipment')
    page.equipment = {
      sets: [
        { id: '1', label: '套装 1', active: true },
        { id: '2', label: '套装 2', active: false },
      ],
      slots: [
        {
          id: '13',
          label: '头部',
          equipmentId: '100',
          equipmentName: '传奇 轻盈的秘银头盔',
          description: '',
          active: true,
          disabled: false,
        },
      ],
      candidates: equipmentCandidates(),
      selectedSlot: target.equip_slot || '',
      postToken: 'fixture',
      canUnequip: true,
    }
  if (section === 'training')
    page.training = {
      active: false,
      activeName: '',
      progress: '',
      remaining: '',
      canCancel: false,
      options: [
        {
          id: '1',
          name: '博学者',
          description: '提升获得的经验。',
          level: '2 / 20',
          cost: '100,000 C',
          duration: '2 小时',
          canStart: true,
          unavailableReason: '',
        },
      ],
    }
}

function addBattleFixtures(page) {
  const section = page.section
  if (['settings', 'grindfest', 'tower'].includes(section)) page.forms = [exampleForm(section)]
  if (['arena', 'ringOfBlood'].includes(section))
    page.challenges = [1, 2, 3].map((i) => ({
      id: String(i),
      name: `挑战 ${i}`,
      highestClear: '普通',
      minLevel: String(i * 10),
      rounds: String(i * 5),
      experienceModifier: '× 1.5',
      entryCost: '无',
      clearBonus: '1,000 C',
      unavailableReason: '',
      available: true,
    }))
  if (section === 'itemWorld')
    page.itemWorld = {
      categories: [],
      selectedCategory: '',
      candidates: equipmentCandidates(),
      postToken: 'fixture',
      worldSeeds: '8',
      rules: ['进入后消耗世界种子。'],
      emptyReason: '',
      entryInfo: {
        100: {
          level: '120',
          rounds: '10',
          monsterLevel: '120',
          difficulty: '普通',
          cost: '1',
          available: true,
        },
      },
    }
}

function addServiceFixtures(page, target, variant) {
  const section = page.section
  if (section === 'market') {
    page.bazaar = parseHentaiVersePage(marketHtml(variant), marketTarget).bazaar
    page.bazaar.itemName = target.itemid === 'fixture-second' ? '魔力药水' : '治疗药水'
    page.bazaar.itemInfo = '离线界面回归样本 · 非真实市场报价'
    page.bazaar.orders = ['buy', 'sell'].map((side) => ({
      side,
      hidden: {},
      countName: side + '_count',
      priceName: side + '_price',
      actionName: side + '_submit',
      actionValue: '1',
      count: 1,
      price: 1200,
      maxCount: 20,
    }))
  }
  if (['itemShop', 'shrine'].includes(section)) {
    page.bazaar = bazaarPage(section)
    page.bazaar.items = [
      {
        id: '1',
        name: section === 'shrine' ? '古代文物' : '治疗药水',
        stock: 25,
        price: 100,
        description: '离线物品样本',
        mode: section === 'shrine' ? 'shrine' : 'shop_pane',
        required: 1,
      },
    ]
    page.bazaar.rewards = [{ type: 'equipment', slot: '1', label: '单手武器' }]
  }
  if (section === 'armory')
    page.armory = {
      screen: target.screen || 'organize',
      tabs: ['organize', 'modify', 'repair', 'sell'].map((screen) => ({
        label: { organize: '整理装备', modify: '改造装备', repair: '修理装备', sell: '出售装备' }[
          screen
        ],
        query: { s: 'Bazaar', ss: 'am', screen },
        active: screen === (target.screen || 'organize'),
      })),
      filters: [],
      equipment: equipmentCandidates().map((e) => ({
        ...e,
        category: '装备',
        status: '未锁定',
        disabled: false,
        protected: false,
        credits: 1000,
        materials: [],
      })),
      selectedId: target['eqids[]'] || '',
      equipmentSources: [],
      inlineDetails: {},
      hidden: {},
      controls: [],
      actions: [
        {
          name: 'modify',
          value: '1',
          label: '改造装备',
          disabled: false,
          help: '',
          confirmation: [],
          hidden: {},
        },
      ],
      descriptions: [],
      balance: 100000,
      modify: !!target['eqids[]'],
      sections: [],
      modificationLinks: [],
    }
  if (['monsterLab', 'moogleMail', 'weaponLottery', 'armorLottery'].includes(section)) {
    page.services = { kind: section, links: [], notices: [], actions: [] }
    if (section === 'monsterLab')
      page.services.monsters = [
        {
          name: 'Happy Player Monster',
          description: '强度等级：150 · 饥饿',
          query: { s: 'Bazaar', ss: 'ml', slot: '0' },
        },
      ]
    if (section === 'moogleMail')
      page.services.mail = {
        filter: 'inbox',
        hidden: {},
        rows: [],
        empty: '',
        help: [],
        content: '这是玩家撰写的邮件正文。User content stays unchanged.',
        attachments: [{ id: '1', name: '治疗药水', quantity: '10', pane: 'item', locked: false }],
        removable: [],
        canReturn: true,
        canSetCod: false,
        cod: 1000,
      }
    if (section.endsWith('Lottery'))
      page.services.lottery = {
        prize: '传奇 红木法杖',
        date: '2026-11-03',
        stats: [],
        prizes: ['10,000 C'],
        rankedPrizes: [{ rank: 2, reward: '10,000 C' }],
        unitPrice: 100,
        currency: 'GP',
        funds: '10,000 GP',
        cost: '100 GP',
        held: '持有 0 张',
        stock: '剩余 100 张',
        rules: ['每张彩票参与一次抽奖。'],
        hidden: {},
        canBuy: true,
        canGolden: false,
        canOptOut: true,
      }
  }
}

export async function installPreview() {
  const prototype = HentaiVerseBusi.prototype
  const names = ['getPage', 'submitForm', 'getEquipmentDetails', 'requestText', 'enterBattle']
  const original = Object.fromEntries(names.map((name) => [name, prototype[name]]))
  const savedAuth = { ...authState },
    savedWorld = hentaiVerseWorld.value,
    savedLocale = locale.value,
    savedBattle = { ...hentaiVerseState }
  const savedNavigation = Object.fromEntries(
    Object.keys(sessionStorage)
      .filter((key) => key.includes(':hv-navigation:'))
      .map((key) => [key, sessionStorage.getItem(key)]),
  )
  const state = { calls: [], variant: 'normal', delay: 0, failNext: false }
  const removeBlankRoute = router.addRoute({
    path: '/__hv-fixture-blank',
    component: { render: () => null },
  })
  prototype.requestText = async () => {
    throw new Error('离线回归不发送真实请求')
  }
  prototype.getEquipmentDetails = async () => ({})
  prototype.getPage = async (target) => {
    state.calls.push({ method: 'get', target: { ...target } })
    const result = makePage(target, state.variant),
      delay = state.delay
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    if (state.failNext) {
      state.failNext = false
      throw new Error('源站需要验证，请打开源站完成验证后重新加载')
    }
    return { page: result }
  }
  prototype.submitForm = async (section, data, target) => {
    state.calls.push({ method: 'submit', section, data: { ...data }, target: { ...target } })
    if (section === 'training') throw new Error('信用点不足')
    return { page: makePage(target, state.variant) }
  }
  prototype.enterBattle = async () => battleFixture()
  setLocale('zh-CN')
  clearHentaiVerseState()
  Object.assign(authState, { loggedIn: true, memberId: 'offline-hv-fixture' })
  await router.push('/hentaiverse')
  return {
    state,
    sections: HENTAIVERSE_SECTIONS,
    battleError() {
      hentaiVerseState.battle = battleFixture()
      hentaiVerseState.battleVisible = true
      hentaiVerseState.error = '战斗结果尚未确认，请先恢复战斗'
    },
    async remount() {
      await router.push('/__hv-fixture-blank')
      await router.push('/hentaiverse')
    },
    async restore() {
      removeBlankRoute()
      Object.assign(prototype, original)
      Object.assign(authState, savedAuth)
      hentaiVerseWorld.value = savedWorld
      setLocale(savedLocale)
      clearHentaiVerseState()
      Object.assign(hentaiVerseState, savedBattle)
      for (const key of Object.keys(sessionStorage).filter((key) =>
        key.includes(':hv-navigation:'),
      ))
        sessionStorage.removeItem(key)
      for (const [key, value] of Object.entries(savedNavigation)) sessionStorage.setItem(key, value)
    },
  }
}
