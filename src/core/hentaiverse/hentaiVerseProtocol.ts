import type {
  HentaiVerseFormData,
  HentaiVerseFormSection,
  HentaiVersePageTarget,
  HentaiVerseSection,
} from './model/hentaiVerse'

export const HENTAIVERSE_SECTION_GROUPS = [
  { key: 'character', label: '角色', heading: '角色维护' },
  { key: 'battle', label: '战斗', heading: '战斗入口' },
  { key: 'bazaar', label: '集市', heading: '集市服务' },
  { key: 'armory', label: '装备库', heading: '装备维护' },
] as const

export const HENTAIVERSE_SECTIONS: Array<{
  key: HentaiVerseSection
  label: string
  group: (typeof HENTAIVERSE_SECTION_GROUPS)[number]['key']
  target: HentaiVersePageTarget
  worlds?: Array<'persistent' | 'isekai'>
}> = [
  { key: 'character', label: '角色总览', group: 'character', target: { s: 'Character', ss: 'ch' } },
  { key: 'equipment', label: '装备', group: 'character', target: { s: 'Character', ss: 'eq' } },
  { key: 'abilities', label: '能力', group: 'character', target: { s: 'Character', ss: 'ab' } },
  {
    key: 'training',
    label: '训练',
    group: 'character',
    target: { s: 'Character', ss: 'tr' },
    worlds: ['persistent'],
  },
  { key: 'inventory', label: '物品', group: 'character', target: { s: 'Character', ss: 'it' } },
  { key: 'settings', label: '战斗设置', group: 'character', target: { s: 'Character', ss: 'se' } },
  { key: 'arena', label: '竞技场', group: 'battle', target: { s: 'Battle', ss: 'ar' } },
  { key: 'ringOfBlood', label: '鲜血之环', group: 'battle', target: { s: 'Battle', ss: 'rb' } },
  { key: 'grindfest', label: '混战祭', group: 'battle', target: { s: 'Battle', ss: 'gr' } },
  { key: 'itemWorld', label: '装备界', group: 'battle', target: { s: 'Battle', ss: 'iw' } },
  {
    key: 'tower',
    label: '塔挑战',
    group: 'battle',
    target: { s: 'Battle', ss: 'tw' },
    worlds: ['isekai'],
  },
  { key: 'armory', label: '装备库', group: 'armory', target: { s: 'Bazaar', ss: 'am' } },
  { key: 'itemShop', label: '物品商店', group: 'bazaar', target: { s: 'Bazaar', ss: 'is' } },
  { key: 'market', label: '市场', group: 'bazaar', target: { s: 'Bazaar', ss: 'mk' } },
  { key: 'shrine', label: '神殿', group: 'bazaar', target: { s: 'Bazaar', ss: 'ss' } },
  {
    key: 'monsterLab',
    label: '怪物实验室',
    group: 'bazaar',
    target: { s: 'Bazaar', ss: 'ml' },
    worlds: ['persistent'],
  },
  { key: 'moogleMail', label: '莫古邮件', group: 'bazaar', target: { s: 'Bazaar', ss: 'mm' } },
  {
    key: 'weaponLottery',
    label: '武器彩票',
    group: 'bazaar',
    target: { s: 'Bazaar', ss: 'lt' },
    worlds: ['persistent'],
  },
  {
    key: 'armorLottery',
    label: '防具彩票',
    group: 'bazaar',
    target: { s: 'Bazaar', ss: 'la' },
    worlds: ['persistent'],
  },
]

export function getHentaiVerseSection(target: HentaiVersePageTarget): HentaiVerseSection {
  return (
    HENTAIVERSE_SECTIONS.find((item) => item.target.s === target.s && item.target.ss === target.ss)
      ?.key ?? 'character'
  )
}

export function isHentaiVerseBattleStart(
  section: HentaiVerseFormSection,
  data: HentaiVerseFormData,
) {
  return (
    (['arena', 'ringOfBlood', 'grindfest', 'tower'].includes(section) && Boolean(data.initid)) ||
    section === 'itemWorld'
  )
}
