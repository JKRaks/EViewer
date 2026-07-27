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
    'Main Hand': '主武器',
    Mainhand: '主武器',
    Weapon: '武器',
    Offhand: '副武器',
    Helmet: '头部',
    Head: '头部',
    Body: '身体',
    Hands: '手部',
    Legs: '腿部',
    Feet: '脚部',
    Equip: '装备',
    Unequip: '卸下',
    'Equipment Set': '装备套装',
    'Cotton Armor': '棉布护甲',
    'Gossamer Armor': '薄纱护甲',
    'Ironsilk Armor': '铁丝绸护甲',
    'Phase Armor': '相位护甲',
    'Leather Armor': '皮甲',
    'Drakehide Armor': '龙皮甲',
    'Kevlar Armor': '凯夫拉护甲',
    'Shade Armor': '暗影护甲',
    'Chain Armor': '锁子甲',
    'Plate Armor': '板甲',
    'Reactive Armor': '反应式护甲',
    'Power Armor': '动力护甲',
    Shortsword: '短剑',
    Dagger: '匕首',
    Axe: '战斧',
    Wakizashi: '胁差',
    Rapier: '细剑',
    Club: '棍棒',
    Longsword: '长剑',
    Katana: '武士刀',
    Scythe: '战镰',
    Estoc: '穿甲剑',
    'Great Mace': '巨型钉锤',
    Swordchucks: '双节剑',
    'Ebony Staff': '乌木法杖',
    'Redwood Staff': '红木法杖',
    'Oak Staff': '橡木法杖',
    'Katalox Staff': '铁木法杖',
    'Willow Staff': '柳木法杖',
    Buckler: '小圆盾',
    'Kite Shield': '鸢形盾',
    'Tower Shield': '塔盾',
    'Force Shield': '力场盾',
  },
  abilities: {
    Ability: '能力',
    'Ability Points': '能力点',
    'Ability Slots': '能力槽',
    Unlock: '解锁',
    'Reset All': '全部重置',
    'Forbidden Skills': '禁断技能',
    'Supportive Proficiencies': '辅助熟练度',
    'HP Tank': '生命强化',
    'MP Tank': '魔力强化',
    'SP Tank': '灵力强化',
    'Better Health Pots': '强化生命药剂',
    'Better Mana Pots': '强化魔力药剂',
    'Better Spirit Pots': '强化灵力药剂',
    'Not Acquired': '尚未获得',
    Requires: '需要',
    'Mastery Point': '精通点',
    'Major Ability Slot': '主要能力槽',
    'Supportive Ability Slot': '辅助能力槽',
  },
  training: {
    'Training Status': '训练状态',
    'Start Training': '开始训练',
    'Cancel Training': '取消训练',
    Cost: '费用',
    Duration: '耗时',
    Completed: '已完成',
    'Adept Learner': '学习能手',
    Assimilator: '同化者',
    'Ability Boost': '能力提升',
    'Manifest Destiny': '天命加持',
    Scavenger: '拾荒者',
    Quartermaster: '军需官',
    'Luck of the Draw': '抽签之运',
    Archaeologist: '考古学家',
    Metabolism: '新陈代谢',
    Inspiration: '灵感',
    'Scholar of War': '战争学者',
    Tincture: '药剂调配',
    'Pack Rat': '囤积能手',
    Dissociation: '人格分离',
    'Set Collector': '套装收藏家',
  },
  inventory: {
    Items: '物品',
    Consumables: '消耗品',
    Materials: '材料',
    Artifacts: '神器',
    Trophies: '奖杯',
    Quantity: '数量',
    Use: '使用',
    'Health Draught': '生命药剂',
    'Mana Draught': '魔力药剂',
    'Spirit Draught': '灵力药剂',
    'Soul Fragment': '灵魂碎片',
    'Monster Chow': '怪物饲料',
  },
  settings: {
    Difficulty: '难度',
    'Display Settings': '显示设置',
    'Quickbar Settings': '快捷栏设置',
    'Auto-Cast Slots': '自动施法槽',
    'Auto-Sell Settings': '自动出售设置',
    'Auto-Salvage Settings': '自动分解设置',
    'Vital Bar Style': '状态条样式',
    Normal: '普通',
    Hard: '困难',
    Nightmare: '噩梦',
    Hell: '地狱',
    Nintendo: '任天堂级',
    'Balanced Fun': '均衡体验',
    'Somewhat Tricky': '略有挑战',
    'Pretty Tough': '相当困难',
    'Even Tougher': '更加困难',
    'Old School': '怀旧硬核',
    Standard: '标准',
    Utilitarian: '实用数值型',
    'Use Default': '使用默认设置',
    'Upgrade to Tier 3': '自动升级至 3 阶',
    'Upgrade to Tier 4': '自动升级至 4 阶',
    'Upgrade to Tier 5': '自动升级至 5 阶',
    'Do Not Upgrade': '不自动升级',
    '(Not Assigned)': '未分配',
    'No Auto-Sell': '不自动出售',
    'No Auto-Salvage': '不自动分解',
    'Sell Crude': '出售粗糙及以下品质',
    'Sell Fair': '出售尚可及以下品质',
    'Sell Average': '出售普通及以下品质',
    'Sell Superior': '出售优秀及以下品质',
    'Sell Exquisite': '出售精致及以下品质',
    'Sell Magnificent': '出售华丽及以下品质',
    'Sell Legendary': '出售传说及以下品质',
    'Salvage Crude': '分解粗糙及以下品质',
    'Salvage Fair': '分解尚可及以下品质',
    'Salvage Average': '分解普通及以下品质',
    'Salvage Superior': '分解优秀及以下品质',
    'Salvage Exquisite': '分解精致及以下品质',
    'Salvage Magnificent': '分解华丽及以下品质',
    'Salvage Legendary': '分解传说及以下品质',
  },
  battle: {
    Health: '生命值',
    Magic: '魔力值',
    Spirit: '灵力姿态',
    Attack: '攻击',
    Defend: '防御',
    Focus: '专注',
    Flee: '逃跑',
    Scan: '扫描',
    Cure: '治疗',
    Victory: '胜利',
    Defeated: '已击败',
    Round: '回合',
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
    Enter: '进入',
    Changes: '更改',
    'Apply Changes': '应用设置',
    'Enter Item World': '进入装备界',
    'There are no available equipment of this type.': '当前分类没有可用装备。',
    'First Blood': '初次见血',
  },
}

const DESCRIPTION_TRANSLATIONS: Record<string, string> = {
  'When you get too powerful to be challenged by the mobs on the normal difficulty, you can increase the Challenge Level here. Playing on a higher Challenge Level will increase the EXP you get from each mob, but the mobs have increased HP and hit harder. Additional difficulty levels unlock as you level up.':
    '可在此调整挑战难度。难度越高，怪物的生命和伤害越高，同时提供更多经验；更多难度会随角色等级解锁。',
  'Here you can choose which of your available titles that will be displayed below your level and on the forums.':
    '选择显示在角色等级下方以及论坛中的称号。',
  'Here you can choose a custom font instead of the standard HentaiVerse font engine. This mostly affects how fast pages will render and how pretty they will look.':
    '可使用本机已安装字体替代默认字形引擎，主要影响文字显示效果和页面渲染速度。',
  "If you want to have separate slotted abilities, battle items and skillbars/autocast assignments per equipment set for your current persona, you can toggle the options below. If this is changed, the current persona's shared set will be assigned to Set 1 and vice versa. This can be set differently for each persona.":
    '可为当前人格的每套装备分别保存能力槽、战斗物品、快捷栏和自动施法配置。切换模式时，共享配置与套装 1 的配置会相互迁移。',
  'You can either use the standard bar which uses pips for charges, or a more utilitarian (and skinnable) bar that has numerical bars for everything.':
    '选择使用默认点状状态条，或显示明确数值的实用型状态条。',
  'By default, as you gain levels, Snowflake will start accepting more lower-tier trophies for a higher-trophy roll in the Shrine. You can override this behavior here.':
    '设置神社献祭时是否自动将低阶奖杯合并为更高阶抽取。',
  'Here you can set up which spells will appear on the battle screen quickbar.':
    '配置战斗界面快捷栏中显示的技能。',
  'Here you can set which spells will be automatically cast at the start of each battle.':
    '配置每场战斗开始时自动施放的技能。',
  'If your MP decreases below 10%, the innate spells will dissipate. They will be recast when it goes back above 25%.':
    '魔力低于 10% 时常驻法术会消失，恢复到 25% 以上后会重新施放。',
  'If you want to automatically dump junk equipment on the closest travelling salesmoogle or break it down into parts, you can do so here. All equipment of the specified qualify and below will be automatically sold or turned in to salvage. If a dropped equipment qualifies for both sell and salvage, the action with the lowest required quality will be taken.':
    '设置掉落装备的自动出售或分解品质阈值；同时符合两项规则时，优先执行品质门槛更低的操作。',
  'There are no available equipment of this type.': '当前分类没有可用装备。',
  'Equipment must be soulbound before you can enter its Item World.':
    '装备必须先完成灵魂绑定才能进入其装备界。',
  'Welcome to the Grindfest. A Grindfest consists of up to 1000 rounds of battle. Starting a Grindfest will consume 1 point of Stamina. There is a small credit reward at the end, if you make it all the way through.':
    '混战祭最多包含 1000 轮战斗，开始时消耗 1 点体力；坚持到最后可获得额外 Credits 奖励。',
  'There are no challenges available at your level. Check back later!':
    '当前等级没有可参加的挑战，请提升等级后再来。',
  'Increases your maximum HP. This adds 10% to your total HP per tier.':
    '提高生命上限，每级增加 10% 总生命值。',
  'Increases your maximum MP. This adds 10% to your total MP per tier.':
    '提高魔力上限，每级增加 10% 总魔力值。',
  'Increases your maximum SP. This adds 10% to your total SP per tier.':
    '提高灵力上限，每级增加 10% 总灵力值。',
  'Improves the overall potency of common health restoratives.': '提高常规生命恢复物品的整体效果。',
  'Improves the overall potency of common mana restoratives.': '提高常规魔力恢复物品的整体效果。',
  'Improves the overall potency of common spirit restoratives.': '提高常规灵力恢复物品的整体效果。',
}

export const HENTAIVERSE_SETTING_GROUPS = [
  { key: 'challenge', title: '挑战与称号', description: '调整战斗难度以及角色对外显示的称号。' },
  { key: 'font', title: '字体显示', description: '自定义战斗页面使用的本机字体及其排版参数。' },
  {
    key: 'equipmentSets',
    title: '装备套装独立配置',
    description: '控制每套装备是否保存独立的能力、物品和快捷栏配置。',
  },
  { key: 'vitals', title: '状态条样式', description: '选择战斗中的生命、魔力和灵力显示方式。' },
  { key: 'trophy', title: '奖杯升级', description: '控制神社献祭时低阶奖杯的自动升级策略。' },
  { key: 'quickbar', title: '战斗快捷栏', description: '设置战斗界面快捷栏中的技能顺序。' },
  { key: 'autocast', title: '自动施法', description: '设置每场战斗开始时自动施放的技能。' },
  {
    key: 'autoProcess',
    title: '装备自动处理',
    description: '分别设置各类装备自动出售和自动分解的品质阈值。',
  },
]

const TERM_TRANSLATIONS = Object.assign({}, ...Object.values(DOMAIN_TRANSLATIONS)) as Record<
  string,
  string
>
const LOWERCASE_TERM_TRANSLATIONS = Object.fromEntries(
  Object.entries(TERM_TRANSLATIONS).map(([term, translation]) => [term.toLowerCase(), translation]),
)
const TRANSLATABLE_TERMS = Object.keys(TERM_TRANSLATIONS)
  .sort((left, right) => right.length - left.length)
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')
const TERM_PATTERN = new RegExp(`\\b(?:${TRANSLATABLE_TERMS})\\b`, 'gi')

const BATTLE_LOG_TRANSLATIONS: Record<string, string> = {
  Scanning: '正在扫描',
  HP: '生命',
  MP: '魔力',
  SP: '灵力',
  'Monster Trainer': '怪物训练师',
  'Monster Class': '怪物类型',
  Common: '普通',
  'Melee Attack': '近战攻击',
  Accuracy: '精准',
  'hit chance against player': '对玩家命中率',
  Avoidance: '回避',
  Evade: '闪避',
  'base chance vs player attack': '对玩家物理攻击基础几率',
  'base chance vs player magic': '对玩家魔法基础几率',
  Intercept: '拦截',
  Parry: '招架',
  Resist: '抵抗',
  Resists: '抗性',
  Fire: '火焰',
  Cold: '冰冷',
  Elec: '雷电',
  Wind: '风',
  Holy: '神圣',
  Dark: '黑暗',
  Crushing: '钝击',
  Slashing: '斩击',
  Piercing: '穿刺',
  Focusing: '专注',
  Defending: '防御',
}
const BATTLE_LOG_PATTERN = new RegExp(
  `\\b(?:${Object.keys(BATTLE_LOG_TRANSLATIONS)
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'gi',
)

export function getAttributeLabel(key: string) {
  return ATTRIBUTE_LABELS[key] ?? key.toUpperCase()
}

export function translateHentaiVerseText(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  if (LOWERCASE_TERM_TRANSLATIONS[source.toLowerCase()])
    return LOWERCASE_TERM_TRANSLATIONS[source.toLowerCase()]!
  return source.replace(
    TERM_PATTERN,
    (term) => LOWERCASE_TERM_TRANSLATIONS[term.toLowerCase()] ?? term,
  )
}

export function translateHentaiVerseDescription(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const trainingEffect = source.match(/^\+([\d,.]+%?)\s+(.+)$/i)
  if (trainingEffect) {
    const effects: Record<string, string> = {
      'exp bonus': '经验获取',
      'proficiency experience': '熟练度经验',
      'ability point': '能力点',
      'mastery point': '精通点',
      'base loot drop chance': '基础战利品掉落率',
      'base equipment drop chance': '基础装备掉落率',
      'base rare equipment chance': '稀有装备出现率',
      'base artifact drop chance': '神器掉落率',
      'battle scroll slots': '战斗卷轴槽位',
      'battle infusion slots': '战斗附魔药槽位',
      'battle inventory slots': '战斗物品槽位',
      'persona slot': '人格槽位',
      'equipment set': '装备套装',
    }
    const effect = effects[trainingEffect[2]!.toLowerCase()]
    if (effect) return `${effect} +${trainingEffect[1]}`
  }
  const trainingDescriptions: Record<string, string> = {
    'improved monster hunger drain': '降低怪物饥饿度消耗速度',
    'improved monster morale drain': '降低怪物士气消耗速度',
  }
  if (trainingDescriptions[source.toLowerCase()]) return trainingDescriptions[source.toLowerCase()]!
  return DESCRIPTION_TRANSLATIONS[source] ?? translateHentaiVerseText(source)
}

export function getHentaiVerseSettingControl(name: string, value: string, sourceLabel: string) {
  if (name === 'difflevel')
    return {
      group: 'challenge',
      groupLabel: '挑战难度',
      label: translateHentaiVerseText(sourceLabel),
    }
  if (name === 'title_override')
    return {
      group: 'challenge',
      groupLabel: '显示称号',
      label: translateHentaiVerseText(sourceLabel),
    }
  if (name === 'fontlocal') return { group: 'font', label: '启用自定义字体' }
  if (name === 'fontface') return { group: 'font', label: '字体名称' }
  if (name === 'fontsize') return { group: 'font', label: '字体大小（5-20 pt）' }
  if (name === 'fontwght') return { group: 'font', label: '字体粗细' }
  if (name === 'fontstyle') return { group: 'font', label: '字体样式' }
  if (name === 'fontoff') return { group: 'font', label: '垂直偏移（-8 至 8 px）' }
  if (name === 'eqs_ability') return { group: 'equipmentSets', label: '每套装备使用独立能力配置' }
  if (name === 'eqs_item') return { group: 'equipmentSets', label: '每套装备使用独立战斗物品配置' }
  if (name === 'eqs_skillbar')
    return { group: 'equipmentSets', label: '每套装备使用独立快捷栏和自动施法配置' }
  if (name === 'vitalstyle')
    return {
      group: 'vitals',
      groupLabel: '状态条样式',
      label: translateHentaiVerseText(sourceLabel),
    }
  if (name === 'trophyupgrade')
    return {
      group: 'trophy',
      groupLabel: '自动升级策略',
      label: translateHentaiVerseText(sourceLabel),
    }
  if (/^\d{1,2}$/.test(name)) return { group: 'quickbar', label: `快捷栏 ${name}` }
  if (/^ac_\d+$/.test(name))
    return { group: 'autocast', label: `自动施法 ${Number(name.slice(3)) + 1}` }
  if (/^as_[cs]_\d+$/.test(name)) {
    const action = name.startsWith('as_c_') ? '自动出售' : '自动分解'
    return { group: 'autoProcess', label: `${translateHentaiVerseText(sourceLabel)} · ${action}` }
  }
  return { group: 'challenge', label: translateHentaiVerseText(sourceLabel || value || name) }
}

export function translateHentaiVerseBattleLog(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''

  const receivedDamage = source.match(
    /^(.+?) (?:(\d+)x-crit|crit|hits) you, causing ([\d,.]+) points? of (.+?) damage\.$/i,
  )
  if (receivedDamage) {
    const damageType = BATTLE_LOG_TRANSLATIONS[receivedDamage[4] || ''] || receivedDamage[4]
    const action = receivedDamage[2]
      ? `以 ${receivedDamage[2]} 倍暴击命中`
      : /\bcrit\b/i.test(source)
        ? '暴击命中'
        : '命中'
    return `${receivedDamage[1]} ${action}你，造成 ${receivedDamage[3]} 点${damageType}伤害。`
  }

  const dealtDamage = source.match(
    /^You (?:(\d+)x-crit|crit|hit) (.+?), causing ([\d,.]+) points? of (.+?) damage\.$/i,
  )
  if (dealtDamage) {
    const damageType = BATTLE_LOG_TRANSLATIONS[dealtDamage[4] || ''] || dealtDamage[4]
    const action = dealtDamage[1]
      ? `以 ${dealtDamage[1]} 倍暴击命中`
      : /\bcrit\b/i.test(source)
        ? '暴击命中'
        : '命中'
    return `你${action} ${dealtDamage[2]}，造成 ${dealtDamage[3]} 点${damageType}伤害。`
  }

  const evadedAttack = source.match(/^You evade the attack from (.+?)\.$/i)
  if (evadedAttack) return `你闪避了 ${evadedAttack[1]} 的攻击。`

  const targetEvaded = source.match(/^(.+?) evades your attack\.$/i)
  if (targetEvaded) return `${targetEvaded[1]} 闪避了你的攻击。`

  const gainedEffect = source.match(/^You gain the effect (.+?)\.$/i)
  if (gainedEffect) {
    const effect = BATTLE_LOG_TRANSLATIONS[gainedEffect[1] || ''] || gainedEffect[1]
    return `你获得了“${effect}”效果。`
  }

  const lostEffect = source.match(/^You lose the effect (.+?)\.$/i)
  if (lostEffect) {
    const effect = BATTLE_LOG_TRANSLATIONS[lostEffect[1] || ''] || lostEffect[1]
    return `你的“${effect}”效果结束了。`
  }

  const expiredEffect = source.match(/^The effect (.+?) has worn off\.$/i)
  if (expiredEffect) {
    const effect = BATTLE_LOG_TRANSLATIONS[expiredEffect[1] || ''] || expiredEffect[1]
    return `你的“${effect}”效果结束了。`
  }

  return source.replace(
    BATTLE_LOG_PATTERN,
    (term) => BATTLE_LOG_TRANSLATIONS[term] ?? BATTLE_LOG_TRANSLATIONS[toTitleCase(term)] ?? term,
  )
}

export function decodeHentaiVerseGlyphs(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>('[class*="c2"], [class*="c3"], [class*="c4"], [class*="c5"]')
    .forEach((node) => {
      const fallback = node.getAttribute('title') || node.getAttribute('aria-label')
      if (node.textContent?.trim()) return
      const glyphClass = Array.from(node.classList)
        .map((className) => className.match(/^c([2345])([a-z0-9])$/i))
        .find(Boolean)
      const family = glyphClass?.[1]
      const glyph = glyphClass?.[2] || ''
      const punctuation =
        family === '2'
          ? { a: '.', e: '%', f: '+' }[glyph.toLowerCase()]
          : family === '4' && glyph.toLowerCase() === 'b'
            ? ','
            : undefined
      const replacement = fallback || (glyph === '9' ? ' ' : punctuation || glyph)
      if (replacement) node.textContent = replacement
    })
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
