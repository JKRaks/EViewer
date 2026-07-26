import type { HentaiVersePageTarget, HentaiVerseSection } from './model/hentaiVerse'

export const HENTAIVERSE_SECTIONS: Array<{
  key: HentaiVerseSection
  label: string
  group: 'character' | 'battle'
  target: HentaiVersePageTarget
}> = [
  { key: 'character', label: '角色总览', group: 'character', target: { s: 'Character', ss: 'ch' } },
  { key: 'equipment', label: '装备', group: 'character', target: { s: 'Character', ss: 'eq' } },
  { key: 'abilities', label: '能力', group: 'character', target: { s: 'Character', ss: 'ab' } },
  { key: 'training', label: '训练', group: 'character', target: { s: 'Character', ss: 'tr' } },
  { key: 'inventory', label: '物品', group: 'character', target: { s: 'Character', ss: 'it' } },
  { key: 'settings', label: '战斗设置', group: 'character', target: { s: 'Character', ss: 'se' } },
  { key: 'arena', label: '竞技场', group: 'battle', target: { s: 'Battle', ss: 'ar' } },
  { key: 'ringOfBlood', label: '鲜血之环', group: 'battle', target: { s: 'Battle', ss: 'rb' } },
  { key: 'grindfest', label: '混战祭', group: 'battle', target: { s: 'Battle', ss: 'gr' } },
  { key: 'itemWorld', label: '装备界', group: 'battle', target: { s: 'Battle', ss: 'iw' } },
]

export function getHentaiVerseSection(target: HentaiVersePageTarget): HentaiVerseSection {
  return HENTAIVERSE_SECTIONS.find(
    (item) => item.target.s === target.s && item.target.ss === target.ss,
  )?.key ?? 'character'
}
