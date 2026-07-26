const ATTRIBUTE_LABELS: Record<string, string> = {
  str: '力量',
  dex: '灵巧',
  agi: '敏捷',
  end: '耐力',
  int: '智力',
  wis: '智慧',
}

const DOMAIN_TRANSLATIONS: Record<string, Record<string, string>> = {
  navigation: {
    Character: '角色',
    Equipment: '装备',
    Abilities: '能力',
    Training: '训练',
    'Item Inventory': '物品栏',
    Settings: '设置',
    'Arena Challenges': '竞技场挑战',
    'Ring of Blood': '鲜血之环',
    Grindfest: '混战祭',
    'Item World': '装备界',
  },
  character: {
    'Primary Attributes': '基础属性',
    Strength: '力量',
    Dexterity: '灵巧',
    Agility: '敏捷',
    Endurance: '耐力',
    Intelligence: '智力',
    Wisdom: '智慧',
    Level: '等级',
    Credits: 'Credits',
    Experience: '经验',
    Persona: '人格',
    Rename: '重命名',
    Clone: '克隆',
    'Create New Persona': '创建新人格',
  },
  equipment: {
    Weapon: '武器',
    Offhand: '副手',
    Head: '头部',
    Body: '身体',
    Hands: '手部',
    Legs: '腿部',
    Feet: '脚部',
    Equip: '装备',
    Unequip: '卸下',
    'Equipment Set': '装备套装',
  },
  abilities: {
    Ability: '能力',
    'Ability Points': '能力点',
    'Ability Slots': '能力槽',
    Unlock: '解锁',
    'Reset All': '全部重置',
    'Forbidden Skills': '禁断技能',
    'Supportive Proficiencies': '辅助熟练度',
  },
  training: {
    'Training Status': '训练状态',
    'Start Training': '开始训练',
    'Cancel Training': '取消训练',
    Cost: '费用',
    Duration: '耗时',
    Completed: '已完成',
  },
  inventory: {
    Items: '物品',
    Consumables: '消耗品',
    Materials: '材料',
    Artifacts: '神器',
    Trophies: '奖杯',
    Quantity: '数量',
    Use: '使用',
  },
  settings: {
    Difficulty: '难度',
    'Display Settings': '显示设置',
    'Quickbar Settings': '快捷栏设置',
    'Auto-Cast Slots': '自动施法槽',
    'Auto-Sell Settings': '自动出售设置',
    'Auto-Salvage Settings': '自动分解设置',
    'Vital Bar Style': '状态条样式',
  },
  battle: {
    Health: '生命值',
    Magic: '魔力值',
    Spirit: '灵力值',
    Attack: '攻击',
    Defend: '防御',
    Focus: '集中',
    Victory: '胜利',
    Defeated: '已击败',
    'Round': '回合',
  },
  common: {
    Apply: '应用',
    Save: '保存',
    Cancel: '取消',
    Reset: '重置',
    Submit: '提交',
    Yes: '是',
    No: '否',
    Enabled: '启用',
    Disabled: '禁用',
  },
}

const TERM_TRANSLATIONS = Object.assign({}, ...Object.values(DOMAIN_TRANSLATIONS)) as Record<string, string>
const TRANSLATABLE_TERMS = Object.keys(TERM_TRANSLATIONS)
  .sort((left, right) => right.length - left.length)
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')
const TERM_PATTERN = new RegExp(`\\b(?:${TRANSLATABLE_TERMS})\\b`, 'gi')

export function getAttributeLabel(key: string) {
  return ATTRIBUTE_LABELS[key] ?? key.toUpperCase()
}

export function translateHentaiVerseText(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  if (TERM_TRANSLATIONS[source]) return TERM_TRANSLATIONS[source]
  return source.replace(TERM_PATTERN, (term) => TERM_TRANSLATIONS[term] ?? TERM_TRANSLATIONS[toTitleCase(term)] ?? term)
}

export function decodeHentaiVerseGlyphs(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[class*="c3"], [class*="c4"], [class*="c5"]').forEach((node) => {
    const fallback = node.getAttribute('title') || node.getAttribute('aria-label')
    if (fallback && !node.textContent?.trim()) node.textContent = fallback
  })
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
