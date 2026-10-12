import { HENTAIVERSE_ABILITIES } from './hentaiVerseAbilityTranslations'

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
    Credits: '信用点',
    Experience: '经验',
    Persona: '人格',
    Rename: '重命名',
    Clone: '克隆',
    'Create New Persona': '创建新人格',
  },
  equipment: {
    'One-handed Weapon': '单手武器',
    'Two-handed Weapon': '双手武器',
    Shield: '盾牌',
    'Level Unassigned': '未定级',
    Tradeable: '可交易',
    Untradeable: '不可交易',
    Soulbound: '灵魂绑定',
    Condition: '耐久',
    Energy: '能量',
    'N/A': '不适用',
    None: '无',
    'Attack Crit Damage': '物理暴击伤害',
    'Magic Crit Damage': '魔法暴击伤害',
    'Magic Damage': '魔法伤害',
    'Counter-resist': '反抵抗',
    'Damage Mitigation': '伤害减免',
    'Spell Damage': '法术伤害加成',
    'Slashing Damage': '斩击伤害',
    'Piercing Damage': '穿刺伤害',
    'Fire Damage': '火焰伤害',
    'Cold Damage': '冰冷伤害',
    'Elec Damage': '雷电伤害',
    'Wind Damage': '风伤害',
    'Holy Damage': '神圣伤害',
    'Dark Damage': '黑暗伤害',
    'Void Damage': '虚空伤害',
    Proficiency: '熟练度',
    'Bleeding Wound': '出血伤口',
    'Penetrated Armor': '破甲',
    'Ether Tap': '以太汲取',
    'Life Steal': '生命吸取',
    'Mana Drain': '魔力吸取',
    'Spirit Drain': '灵力吸取',
    Stunned: '眩晕',
    'of Balance': '平衡',
    'of Slaughter': '杀戮',
    'of the Battlecaster': '战斗法师',
    'of the Illithid': '灵吸怪',
    'of the Banshee': '女妖',
    'of the Vampire': '吸血鬼',
    'of Focus': '专注',
    'of Destruction': '毁灭',
    'of Surtr': '苏尔特',
    'of Niflheim': '尼福尔海姆',
    'of Mjolnir': '妙尔尼尔',
    'of Freyr': '弗雷',
    'of Heimdall': '海姆达尔',
    'of Fenrir': '芬里尔',
    'of Protection': '防护',
    'of Deflection': '偏斜',
    'of the Barrier': '屏障',
    'of the Nimble': '灵巧',
    'of the Fleet': '迅捷',
    'of Warding': '守护',
    'of Negation': '否定',
    'of the Fire-eater': '噬火者',
    'of the Frost-born': '霜生者',
    'of the Wind-waker': '唤风者',
    'of the Thrice-blessed': '三重祝福',
    'of the Spirit-ward': '灵力守卫',
    'of the Ox': '蛮牛',
    'of the Raccoon': '浣熊',
    'of the Cheetah': '猎豹',
    'of the Turtle': '巨龟',
    'of the Fox': '狐狸',
    'of the Owl': '猫头鹰',
    'Road Less Traveled': '人迹罕至之路',
    Crude: '粗糙',
    Fair: '尚可',
    Average: '普通',
    Superior: '优秀',
    Exquisite: '精致',
    Magnificent: '华丽',
    Legendary: '传说',
    Peerless: '绝世',
    'Plate Helmet': '板甲头盔',
    'of the Thunder-child': '雷霆之子',
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
    'Cotton Robe': '棉布长袍',
    'Cotton Pants': '棉布长裤',
    'Gossamer Cap': '薄纱兜帽',
    'Leather Helmet': '皮甲头盔',
    'Leather Gauntlets': '皮甲护手',
    'Chain Helmet': '锁子甲头盔',
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
    ...Object.fromEntries(
      Object.entries(HENTAIVERSE_ABILITIES).map(([name, value]) => [name, value[0]]),
    ),
    Ability: '能力',
    'Ability Points': '能力点',
    'Ability Slots': '能力槽',
    Unlock: '解锁',
    'Reset All': '全部重置',
    'Forbidden Skills': '禁断技能',
    'Supportive Proficiencies': '辅助熟练度',
    'Not Acquired': '尚未获得',
    Requires: '需要',
    'Mastery Point': '精通点',
    'Major Ability Slot': '主要能力槽',
    'Supportive Ability Slot': '辅助能力槽',
    'Protection Augment Ability Slot': '防护增强能力槽',
    'Drain Augment Ability Slot': '吸取增强能力槽',
    'Mastery Points': '精通点',
    'Direct Player Stat Modification': '直接角色属性加成',
    'Spells Modified': '强化法术',
    'Effects Modified': '强化状态',
    'Items Modified': '强化物品',
    'Current Tier': '当前阶效果',
    'Next Tier': '下一阶效果',
    'Maximum Health': '最大生命',
    'Maximum Magic': '最大魔力',
    'Maximum Spirit': '最大灵力',
    'Base Health': '基础生命',
    'Base Magic': '基础魔力',
    'Base Mana': '基础魔力',
    'Base Spirit': '基础灵力',
    'Base Mana Regen per tick': '每回合基础魔力恢复',
    'Base Health Regen per tick': '每回合基础生命恢复',
    'Base Spirit Regen per tick': '每回合基础灵力恢复',
    'When Used': '使用效果',
    Replenishment: '魔力补充',
    Rejuvenation: '生命恢复',
    Regeneration: '生命再生',
    Refreshment: '灵力恢复',
    'Unlock Cost': '解锁费用',
    'Proficiency-based Stat Modification': '熟练度属性加成',
    'Attack Damage Multiplier': '物理伤害倍率',
    'Attack Crit Multiplier': '物理暴击倍率',
    'Spell Crit Multiplier': '法术暴击倍率',
    'Attack Speed': '攻击速度',
    'Magic Cast Speed': '施法速度',
    'Attack Accuracy': '物理命中',
    'Magic Accuracy': '魔法命中',
    'Block Chance': '格挡概率',
    'Parry Chance': '招架概率',
    'Magic Base Damage': '基础法术伤害',
    'Attack Base Damage': '基础物理伤害',
    'Action Speed Modification': '行动速度修正',
    'Natural Evade Modifier': '自然闪避修正',
    'Natural Resist Modifier': '自然抵抗修正',
    'Crushing Mitigation': '打击减伤',
    'Slashing Mitigation': '斩击减伤',
    'Piercing Mitigation': '穿刺减伤',
    'Physical Mitigation': '物理减伤',
    'Magical Mitigation': '魔法减伤',
    'Fire Mitigation': '火焰减伤',
    'Cold Mitigation': '冰冷减伤',
    'Elec Mitigation': '雷电减伤',
    'Wind Mitigation': '风减伤',
    'Holy Mitigation': '神圣减伤',
    'Dark Mitigation': '黑暗减伤',
    'Absorbing Ward': '吸收结界',
    Asleep: '睡眠',
    Blinded: '致盲',
    Confused: '混乱',
    Hastened: '加速',
    Immobilized: '定身',
    Imperiled: '侵蚀',
    Silenced: '沉默',
    Slowed: '迟缓',
    Weakened: '虚弱',
    'Vital Theft': '生命窃取',
    'Flame Spikes': '火焰尖刺',
    'Frost Spikes': '冰霜尖刺',
    'Shock Spikes': '雷电尖刺',
    'Storm Spikes': '风暴尖刺',
    Shockblast: '雷击',
    Gale: '疾风',
    Inferno: '炼狱',
    Blizzard: '暴风雪',
    'Chained Lightning': '连锁闪电',
    Downburst: '下击暴流',
    'Flames of Loki': '洛基之焰',
    Fimbulvetr: '芬布尔之冬',
    'Wrath of Thor': '雷神之怒',
    'Storms of Njord': '尼约德风暴',
    Banishment: '放逐',
    'Paradise Lost': '失乐园',
    Ragnarok: '诸神黄昏',
  },
  statistics: {
    'equipment proficiency': '装备熟练度',
    'magic proficiency': '魔法熟练度',
    'mainhand attack': '主手攻击',
    'magic attack': '魔法攻击',
    vitals: '基础资源与恢复',
    avoidance: '回避',
    compromise: '装备负担',
    'damage mitigation': '伤害减免',
    'spell damage bonus': '法术伤害加成',
    'effective primary stats': '有效基础属性',
    'effective proficiency': '有效熟练度',
    'Crushing Damage': '打击伤害',
    Accuracy: '命中',
    'Crit Multiplier': '暴击倍率',
    'Attack Speed Bonus': '攻击速度加成',
    'Damage Bonus': '伤害加成',
    'Mana Cost Modifier': '魔力消耗修正',
    'Cast Speed Bonus': '施法速度加成',
    'Mana Regen': '魔力恢复',
    'Spirit Regen': '灵力恢复',
    Evade: '闪避',
    Block: '格挡',
    Parry: '招架',
    Resist: '抵抗',
    Interference: '干涉',
    Burden: '负重',
    Physical: '物理',
    Magical: '魔法',
    Fire: '火焰',
    Cold: '冰冷',
    Elec: '雷电',
    Wind: '风',
    Holy: '神圣',
    Dark: '黑暗',
    Crushing: '打击',
    Slashing: '斩击',
    Piercing: '穿刺',
    'One-handed': '单手',
    'Two-handed': '双手',
    'Dual-wielding': '双持',
    Staff: '法杖',
    Elemental: '元素',
    Divine: '神圣',
    Forbidden: '禁断',
    Deprecating: '减益',
    Supportive: '辅助',
    'Cloth Armor': '布甲',
    'Light Armor': '轻甲',
    'Heavy Armor': '重甲',
    Next: '距下一级',
    Newbie: '新人',
    Beginner: '初学者',
    Novice: '新手',
    Apprentice: '学徒',
    Journeyman: '熟练者',
    Default: '默认',
    Token: '代币',
    Crystal: '水晶',
    'Monster Food': '怪物饲料',
    'EXP bonus': '经验加成',
    'Cold Resistance': '冰冷抗性',
    'Wind Resistance': '风抗性',
    'Holy Resistance': '神圣抗性',
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
    'Health Potion': '生命药水',
    'Mana Potion': '魔力药水',
    'Spirit Potion': '灵力药水',
    'Health Elixir': '生命灵药',
    'Mana Elixir': '魔力灵药',
    'Spirit Elixir': '灵力灵药',
    'Last Elixir': '终极灵药',
    'Energy Drink': '能量饮料',
    'Scroll of Swiftness': '迅捷卷轴',
    'Scroll of Protection': '防护卷轴',
    'Scroll of Absorption': '吸收卷轴',
    'Scroll of Shadows': '暗影卷轴',
    'Scroll of Life': '生命卷轴',
    'Infusion of Flames': '火焰附魔药',
    'Infusion of Frost': '冰霜附魔药',
    'Infusion of Lightning': '雷电附魔药',
    'Infusion of Storms': '风暴附魔药',
    'Infusion of Divinity': '神圣附魔药',
    'Infusion of Darkness': '黑暗附魔药',
    'Flower Vase': '花瓶',
    'Bubble-Gum': '泡泡糖',
    'Soul Fragment': '灵魂碎片',
    'Monster Chow': '怪物饲料',
    'Monster Cuisine': '怪物佳肴',
    'Chaos Token': '混沌令牌',
    'Crystal of Swiftness': '迅捷水晶',
    'Crystal of Fortitude': '坚韧水晶',
    'Crystal of Cunning': '机敏水晶',
    'Crystal of Frost': '冰霜水晶',
    'Crystal of Tempest': '风暴水晶',
    'Crystal of Devotion': '虔诚水晶',
    'Caffeinated Candy': '咖啡因糖果',
    'Health Gem': '生命宝石',
    'Mana Gem': '魔力宝石',
    'Spirit Gem': '灵力宝石',
    'Mystic Gem': '神秘宝石',
    'Scroll of the Avatar': '化身卷轴',
    'Scroll of the Gods': '诸神卷轴',
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
    Mana: '魔力',
    Spirit: '灵力',
    Attack: '攻击',
    Defend: '防御',
    Focus: '专注',
    Flee: '逃跑',
    Scan: '扫描',
    Cure: '治疗',
    Regen: '再生',
    'Full-Cure': '完全治疗',
    Haste: '加速',
    Protection: '防护',
    'Shadow Veil': '暗影帷幕',
    Absorb: '吸收',
    'Spark of Life': '生命火花',
    'Spirit Shield': '灵力护盾',
    Heartseeker: '穿心',
    'Arcane Focus': '奥术专注',
    Silence: '沉默',
    Weaken: '虚弱',
    Imperil: '破防',
    Slow: '迟缓',
    Sleep: '睡眠',
    Blind: '致盲',
    Confuse: '混乱',
    Drain: '吸取',
    'Fiery Blast': '火焰冲击',
    Inferno: '地狱火',
    'Flames of Loki': '洛基之焰',
    Freeze: '冰冻',
    Blizzard: '暴风雪',
    Fimbulvetr: '芬布尔之冬',
    Shockblast: '雷电冲击',
    'Chained Lightning': '连锁闪电',
    'Wrath of Thor': '托尔之怒',
    Gale: '狂风',
    Downburst: '下击暴流',
    'Storms of Njord': '尼约德之风暴',
    Smite: '惩击',
    Banish: '放逐',
    Expunge: '净除',
    Corruption: '腐蚀',
    Disintegrate: '瓦解',
    Ragnarok: '诸神黄昏',
    'Great Cleave': '大劈斩',
    'Rending Blow': '撕裂打击',
    'Merciful Blow': '仁慈终结',
    'Shield Bash': '盾击',
    'Vital Strike': '要害打击',
    'Frenzied Blows': '狂乱打击',
    'Iris Strike': '虹彩打击',
    Backstab: '背刺',
    'Overwhelming Strikes': '压制打击',
    'Coalesced Mana': '凝聚魔力',
    'Ether Tap': '以太汲取',
    'Spirit Stance': '灵力姿态',
    Fleeing: '逃离中',
    Victory: '胜利',
    Defeated: '已击败',
    Round: '回合',
  },
  arena: {
    'First Blood': '初次见血',
    'Learning Curves': '学习曲线',
    'The Road Less Traveled': '少有人走的路',
    'Stepping Stones': '垫脚石',
    'A New Beginning': '新的开始',
    Graduation: '毕业',
    'The Test of Faith': '信念的考验',
    'The Long Road': '漫漫长路',
    Dreamfall: '梦陨',
    Exile: '流放',
    'Sealed Power': '封印之力',
    'End of Days': '末日',
    'Eternal Darkness': '永恒黑暗',
    'A Dance with Dragons': '群龙之舞',
    'User Class': '玩家等级',
    'Required Level': '所需等级',
    Rounds: '轮数',
    Clear: '通关',
    Reward: '奖励',
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
  'A ball of fire is hurled at the target.': '向目标投掷一团火球。',
  'Cold damage.': '对目标造成冰冷伤害。',
  'Inflicts Drain on one target, causing damage over time.':
    '对一个目标施加吸取效果，持续造成伤害。',
  'Restores a moderate amount of Health on the target.': '为目标恢复适量生命值。',
  'Places a shield effect on the target, absorbing 25% of the damage from all attacks.':
    '为目标施加护盾，吸收所有攻击造成的 25% 伤害。',
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
    '混战祭最多包含 1000 轮战斗，开始时消耗 1 点体力；坚持到最后可获得额外信用点奖励。',
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

// Names and descriptions from the source's itemc.js. These popups are loaded
// separately from the page HTML, so DOM-only parsing cannot read their text.
const ITEM_PRESENTATIONS: Record<string, [string, string]> = {
  '10005': ['Health Gem', '恢复大量生命。'],
  '10006': ['Mana Gem', '恢复适量魔力。'],
  '10007': ['Spirit Gem', '恢复少量灵力。'],
  '10008': ['Mystic Gem', '获得引导效果。'],
  '11191': ['Health Draught', '提供持续的生命恢复效果。'],
  '11195': ['Health Potion', '立即恢复大量生命。'],
  '11199': ['Health Elixir', '完全恢复生命，并提供持续的生命恢复效果。'],
  '11291': ['Mana Draught', '提供持续的魔力恢复效果。'],
  '11295': ['Mana Potion', '立即恢复适量魔力。'],
  '11299': ['Mana Elixir', '完全恢复魔力，并提供持续的魔力恢复效果。'],
  '11391': ['Spirit Draught', '提供持续的灵力恢复效果。'],
  '11395': ['Spirit Potion', '立即恢复适量灵力。'],
  '11399': ['Spirit Elixir', '完全恢复灵力，并提供持续的灵力恢复效果。'],
  '11401': [
    'Energy Drink',
    '恢复 10 点体力，上限为 99。战斗中使用还会提升 10% 过载值与灵力，持续 10 回合。',
  ],
  '11402': [
    'Caffeinated Candy',
    '恢复 5 点体力，上限为 99。战斗中使用还会提升 10% 过载值与灵力，持续 5 回合。',
  ],
  '11501': ['Last Elixir', '完全恢复生命、魔力与灵力，并提供持续的恢复效果。'],
  '12101': ['Infusion of Flames', '提高 25% 火焰抗性与火焰法术伤害。'],
  '12201': ['Infusion of Frost', '提高 25% 冰冷抗性与冰冷法术伤害。'],
  '12301': ['Infusion of Lightning', '提高 25% 雷电抗性与雷电法术伤害。'],
  '12401': ['Infusion of Storms', '提高 25% 风抗性与风系法术伤害。'],
  '12501': ['Infusion of Divinity', '提高 25% 神圣抗性与神圣法术伤害。'],
  '12601': ['Infusion of Darkness', '提高 25% 黑暗抗性与黑暗法术伤害。'],
  '13101': ['Scroll of Swiftness', '获得加速效果。'],
  '13111': ['Scroll of Protection', '获得防护效果。'],
  '13199': ['Scroll of the Avatar', '获得加速与防护效果，持续时间为通常的两倍。'],
  '13201': ['Scroll of Absorption', '获得吸收效果。'],
  '13211': ['Scroll of Shadows', '获得暗影帷幕效果。'],
  '13221': ['Scroll of Life', '获得生命火花效果。'],
  '13299': ['Scroll of the Gods', '获得吸收、暗影帷幕与生命火花效果，持续时间为通常的两倍。'],
  '19111': ['Flower Vase', '花瓶里有三朵花，第三朵是绿色的。'],
  '19131': ['Bubble-Gum', '是时候大显身手、嚼泡泡糖了……这里正好有些糖。'],
}

export function getHentaiVerseItemPresentation(id: string) {
  const item = ITEM_PRESENTATIONS[id]
  return item ? { name: translateHentaiVerseText(item[0]), description: item[1] } : undefined
}

export function getHentaiVerseAbilityPresentation(name: string) {
  const ability = HENTAIVERSE_ABILITIES[name]
  return ability ? { name: ability[0], description: ability[1] } : undefined
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
  {
    key: 'autocast',
    title: '自动施法',
    description:
      '配置自动维持的增益法术。魔力低于 10% 时自动解除，高于 25% 时恢复施放；每回合需要支付维护魔力。',
  },
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
  Daimon: '恶魔',
  'Power Level': '强度等级',
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
const BATTLE_TERMS = { ...TERM_TRANSLATIONS, ...BATTLE_LOG_TRANSLATIONS }
const BATTLE_LOG_PATTERN = new RegExp(
  `\\b(?:${Object.keys(BATTLE_TERMS)
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'gi',
)
const LOWERCASE_BATTLE_LOG_TRANSLATIONS = Object.fromEntries(
  Object.entries(BATTLE_TERMS).map(([term, translation]) => [term.toLowerCase(), translation]),
)

function translateBattleTerms(value: string) {
  return value.replace(
    BATTLE_LOG_PATTERN,
    (term) => LOWERCASE_BATTLE_LOG_TRANSLATIONS[term.toLowerCase()] ?? term,
  )
}

export function getAttributeLabel(key: string) {
  return ATTRIBUTE_LABELS[key] ?? key.toUpperCase()
}

export function translateHentaiVerseText(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  if (LOWERCASE_TERM_TRANSLATIONS[source.toLowerCase()])
    return LOWERCASE_TERM_TRANSLATIONS[source.toLowerCase()]!
  return source
    .replace(TERM_PATTERN, (term) => LOWERCASE_TERM_TRANSLATIONS[term.toLowerCase()] ?? term)
    .replace(/\blv\.\s*(\d+)/gi, '等级 $1')
    .replace(/([\d,]+)\s+c\b/gi, '$1 信用点')
}

export function translateHentaiVerseDescription(value: string) {
  const source = value.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const slowed = source.match(
    /^The target is slowed by ([\d.]+)%, making it attack less frequently\.$/i,
  )
  if (slowed) return `目标行动速度降低 ${slowed[1]}%，减少攻击频率。`
  if (/^no bonus$/i.test(source)) return '无额外加成'
  const titleBonus = source.match(/^([+-][\d.]+%) damage$/i)
  if (titleBonus) return `伤害 ${titleBonus[1]}`
  const upkeep = source.match(/^Upkeep:\s*([\d.,]+)\s*MP\/round$/i)
  if (upkeep) return `每回合维护消耗 ${upkeep[1]} 魔力`
  const pageDescriptions: Record<string, string> = {
    'Welcome to the Grindfest.': '欢迎来到混战祭。',
    'A Grindfest consists of up to 1000 rounds of battle.': '混战祭最多包含 1000 轮战斗。',
    'Starting a Grindfest will consume 1 point of Stamina.': '开始混战祭会消耗 1 点体力。',
    'There are no challenges available at your level. Check back later!':
      '当前等级没有可参加的挑战，升级后再来查看。',
    'There are no available equipment of this type.Equipment must be soulbound before you can enter its Item World.':
      '此分类没有可进入装备界的装备。装备必须先完成灵魂绑定。',
    'There are no available equipment of this type. Equipment must be soulbound before you can enter its Item World.':
      '此分类没有可进入装备界的装备。装备必须先完成灵魂绑定。',
    'There are no available equipment of this type.': '此分类没有可用装备。',
    'Equipment must be soulbound before you can enter its Item World.':
      '装备必须先完成灵魂绑定，才能进入其装备界。',
    'Clearing item worlds is the only way to unlock the full potential of your equipment.':
      '通关装备界是解锁装备全部潜能的唯一方式。',
    'Select an equipment to enter the world contained within. You can only enter the worlds of equipment that are soulbound to you.':
      '选择一件已与你灵魂绑定的装备，进入其装备界。',
    'If you manage to fight your way through, you will boost the latent potency of your equipment. This increases the total strength of the charms the equipment can handle, and allows you to upgrade it further.':
      '通关后会提高装备潜能，增加可承载的护符总强度，并允许继续升级装备。',
    'The number of rounds you will be fighting depends on the quality of your item. More powerful items will have more powerful monsters inside them, and the monsters get more powerful the deeper you go.':
      '战斗轮数取决于装备品质。装备越强，内部怪物越强，越深入怪物也越强。',
    'The difficulty setting does not affect the difficulty in Item Worlds.':
      '战斗难度设置不会影响装备界的难度。',
    'Spawning an item world requires a number of World Seeds, depending on its quality and number of item worlds cleared inside that particular equipment.':
      '开启装备界需要世界种子，数量取决于装备品质及该装备已通关装备界的次数。',
    'There is a small credit reward at the end, if you make it all the way through.':
      '完整通关后可获得少量信用点奖励。',
    'You can use this token to unlock monster slots in the Monster Lab, as well as to upgrade your monsters.':
      '可用于在怪物实验室解锁怪物槽位或升级怪物。',
    'These fragments can be used in the forge to permanently soulbind an equipment piece to you, which will make it level as you do.':
      '可在军械库用于永久灵魂绑定装备，使装备随角色一同升级。',
    'Non-discerning monsters like to munch on this chow.': '可用于喂养对食物要求不高的怪物。',
    'High-level monsters would very much prefer this highly refined level of dining if you wish to parlay their favor.':
      '高等级怪物偏爱的精制饲料，可用于维持它们的状态。',
  }
  if (pageDescriptions[source]) return pageDescriptions[source]!
  const translatedParagraph = Object.entries(pageDescriptions).reduce(
    (text, [original, translated]) => text.replace(original, translated),
    source,
  )
  if (translatedParagraph !== source) return translateHentaiVerseText(translatedParagraph)
  const worldSeeds = source.match(/^Available World Seeds:\s*([\d,]+)/i)
  if (worldSeeds) return `世界种子余量：${worldSeeds[1]}`
  const crystal = source.match(
    /^You can fuse this crystal with a monster in the monster tab to increase its (.+)\.$/i,
  )
  if (crystal)
    return `可在怪物实验室融合此水晶，提高怪物的${translateHentaiVerseText(crystal[1]!)}。`
  const cooldown = source.match(/^cooldown:\s*(?:(\d+)h\s*)?(?:(\d+)m)?$/i)
  if (cooldown)
    return `冷却剩余：${cooldown[1] ? `${cooldown[1]} 小时 ` : ''}${cooldown[2] ? `${cooldown[2]} 分钟` : ''}`.trim()
  const trainingResult = source.match(
    /^You have gained another level in (.+?)\s*You have increased your (.+?) by ([\d.%]+)!$/i,
  )
  if (trainingResult)
    return `${translateHentaiVerseText(trainingResult[1]!)}训练已完成，${translateHentaiVerseText(trainingResult[2]!)}提高 ${trainingResult[3]}。`
  const bloodTokens = source.match(/^you have\s*([\d,]+)\s*tokens? of blood\.?$/i)
  if (bloodTokens) return `持有 ${bloodTokens[1]} 枚鲜血代币。`
  const effects = source
    .replace(/Requires Level (\d+) and (\d+) Ability Points?/gi, '需要等级 $1，消耗 $2 点能力点')
    .replace(
      /For every ten points of (.+?) Proficiency, adds:/gi,
      (_, name: string) =>
        `每 10 点${translateHentaiVerseText(name.replace(/ Weapon$/i, ''))}熟练度增加：`,
    )
    .replace(/Changes max affected targets to (\d+)/gi, '最大目标数量变为 $1')
    .replace(/Changes effect duration to (\d+) turns/gi, '持续时间变为 $1 回合')
    .replace(/Changes cooldown to (\d+) turns/gi, '冷却变为 $1 回合')
    .replace(/Changes cast time to ([\d.]+)/gi, '施法时间变为 $1')
    .replace(/Changes base mana cost to ([\d.]+)/gi, '基础魔力消耗变为 $1')
    .replace(/Changes base damage to ([\d.]+)/gi, '基础伤害变为 $1')
    .replace(
      /Instantly restores ([\d.]+%) of Base (Health|Magic|Spirit)/gi,
      (_, amount: string, resource: string) =>
        `立即恢复 ${amount} ${translateHentaiVerseText(`Base ${resource}`)}`,
    )
    .replace(
      /Added special effect: (.+?) \(([\d.]+%) Followup\)/gi,
      (_, name: string, chance: string) =>
        `追加特殊效果：${translateHentaiVerseText(name)}（后续触发率 ${chance}）`,
    )
    .replace(
      /Added effect: (.+?) \(([\d.]+%) Chance\)/gi,
      (_, name: string, chance: string) =>
        `追加效果：${translateHentaiVerseText(name)}（概率 ${chance}）`,
    )
    .replace(/Additional Effect:/gi, '追加效果：')
    .replace(/Increases Absorption Chance to ([\d.]+%)/gi, '吸收概率提高至 $1')
    .replace(
      /Increases (Sleep|Confuse) Break Resistance to ([\d.]+%)/gi,
      (_, effect: string, amount: string) =>
        `${effect.toLowerCase() === 'sleep' ? '睡眠' : '混乱'}受伤解除抵抗提高至 ${amount}`,
    )
    .replace(/Increases Damage Decrease to ([\d.]+%)/gi, '伤害削弱提高至 $1')
    .replace(/Reduces Damage Threshold to ([\d.]+%)/gi, '伤害触发阈值降低至 $1')
    .replace(/Multiplies HP Drain by ([\d.]+)/gi, '生命吸取倍率变为 $1')
    .replace(/([\d.]+%) Shadow Veil Trigger Chance/gi, '暗影帷幕触发概率 $1')
  if (effects !== source) return translateHentaiVerseText(effects)
  const restorative = source.match(
    /^Restores? ([\d,.]+%?) (?:of (?:your )?)?(base |maximum )?(health|mana|magic|spirit)(?: (?:points?))?(?: over (\d+) turns?)?\.?$/i,
  )
  if (restorative) {
    const resource = { health: '生命', mana: '魔力', magic: '魔力', spirit: '灵力' }[
      restorative[3]!.toLowerCase()
    ]
    const basis =
      restorative[2]?.trim().toLowerCase() === 'base' ? '基础' : restorative[2] ? '最大' : ''
    return `${restorative[4] ? `在 ${restorative[4]} 回合内` : ''}恢复 ${restorative[1]} ${basis}${resource}。`
  }
  const grants = source.match(
    /^(?:Grants?|Gives? you) (?:the )?(.+?) (?:effect|buff)(?: for (\d+) turns?)?\.?$/i,
  )
  if (grants)
    return `获得“${translateHentaiVerseText(grants[1]!)}”效果${grants[2] ? `，持续 ${grants[2]} 回合` : ''}。`
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
  // Completion panes can contain several sentences; translate each event separately.
  return source
    .split(/(?<=[.!])\s+(?=(?:You\b|The effect\b|Starting\b))/i)
    .map(translateBattleEvent)
    .join(' ')
}

function translateBattleEvent(source: string): string {
  const initializing = source.match(
    /^Initializing arena challenge #(\d+) \(Round (\d+)\s*\/\s*(\d+)\)\s*\.\.\.$/i,
  )
  if (initializing)
    return `正在开始竞技场挑战 #${initializing[1]}（第 ${initializing[2]} / ${initializing[3]} 轮）……`
  const spawned = source.match(
    /^Spawned Monster ([A-Z]): MID=(\d+) \((.+)\) LV=(\d+) HP=([\d,]+)$/i,
  )
  if (spawned) return `怪物 ${spawned[1]}：${spawned[3]}，等级 ${spawned[4]}，生命 ${spawned[5]}。`
  const dropped = source.match(/^(.+?) dropped (.+?)[.!]?$/i)
  if (dropped) return `${dropped[1]} 掉落了 ${translateBattleTerms(dropped[2]!)}。`
  const clearBonus = source.match(/^Battle Clear Bonus!\s*(.+)$/i)
  if (clearBonus) return `战斗通关奖励：${translateBattleTerms(clearBonus[1]!)}。`
  if (/^Arena challenge cleared[.!]?$/i.test(source)) return '竞技场挑战已通关！'

  const receivedDamage = source.match(
    /^(.+?) (?:(\d+)x-crit|crit|hits|glances) you, causing ([\d,.]+) points? of (.+?) damage\.$/i,
  )
  if (receivedDamage) {
    const damageType = translateBattleTerms(receivedDamage[4] || '')
    const action = receivedDamage[2]
      ? `以 ${receivedDamage[2]} 倍暴击命中`
      : /\bcrit\b/i.test(source)
        ? '暴击命中'
        : /\bglances\b/i.test(source)
          ? '擦中'
          : '命中'
    return `${receivedDamage[1]} ${action}你，造成 ${receivedDamage[3]} 点${damageType}伤害。`
  }

  const dealtDamage = source.match(
    /^You (?:(\d+)x-crit|crit|hit|glance) (.+?), causing ([\d,.]+) points? of (.+?) damage\.$/i,
  )
  if (dealtDamage) {
    const damageType = translateBattleTerms(dealtDamage[4] || '')
    const action = dealtDamage[1]
      ? `以 ${dealtDamage[1]} 倍暴击命中`
      : /\bcrit\b/i.test(source)
        ? '暴击命中'
        : /\bglance\b/i.test(source)
          ? '擦中'
          : '命中'
    return `你${action} ${dealtDamage[2]}，造成 ${dealtDamage[3]} 点${damageType}伤害。`
  }

  const evadedAttack = source.match(/^You evade the attack from (.+?)\.$/i)
  if (evadedAttack) return `你闪避了 ${evadedAttack[1]} 的攻击。`

  const targetEvaded = source.match(/^(.+?) evades your attack\.$/i)
  if (targetEvaded) return `${targetEvaded[1]} 闪避了你的攻击。`

  const gainedEffect = source.match(/^You gain the effect (.+?)\.$/i)
  if (gainedEffect) {
    const effect = translateBattleTerms(gainedEffect[1] || '')
    return `你获得了“${effect}”效果。`
  }

  const lostEffect = source.match(/^You lose the effect (.+?)\.$/i)
  if (lostEffect) {
    const effect = translateBattleTerms(lostEffect[1] || '')
    return `你的“${effect}”效果结束了。`
  }

  const expiredEffect = source.match(/^The effect (.+?) has worn off\.$/i)
  if (expiredEffect) {
    const effect = translateBattleTerms(expiredEffect[1] || '')
    return `你的“${effect}”效果结束了。`
  }

  const cast = source.match(/^You cast (.+?)\.$/i)
  if (cast) return `你施放了“${translateBattleTerms(cast[1]!)}”。`
  const used = source.match(/^You use (?:a |an )?(.+?)\.$/i)
  if (used) return `你使用了“${translateBattleTerms(used[1]!)}”。`
  const recovery = source.match(/^(.+?) (?:heals|restores) you for ([\d,.]+) points? of (.+?)\.$/i)
  if (recovery)
    return `${translateBattleTerms(recovery[1]!)}为你恢复了 ${recovery[2]} 点${translateBattleTerms(recovery[3]!)}。`
  const healing = source.match(/^(.+?) heals you for ([\d,.]+) points?\.$/i)
  if (healing) return `${translateBattleTerms(healing[1]!)}为你恢复了 ${healing[2]} 点生命值。`
  const healed = source.match(/^You are healed for ([\d,.]+) Health Points?\.$/i)
  if (healed) return `你恢复了 ${healed[1]} 点生命值。`
  const restoration = source.match(/^(.+?) restores ([\d,.]+) points? of (.+?)\.$/i)
  if (restoration)
    return `${translateBattleTerms(restoration[1]!)}恢复了 ${restoration[2]} 点${translateBattleTerms(restoration[3]!)}。`
  const regained = source.match(/^You (?:regain|recover) ([\d,.]+) points? of (.+?)\.$/i)
  if (regained) return `你恢复了 ${regained[1]} 点${translateBattleTerms(regained[2]!)}。`
  if (/^You have been defeated[.!]?$/i.test(source)) return '你已被击败。'
  if (/^You have escaped from the battle[.!]?$/i.test(source)) return '你已逃离战斗。'
  if (/^you have run away[.!]?$/i.test(source)) return '你已成功逃离！'
  if (/^you escape from the arena[.!]?$/i.test(source)) return '你已退出竞技场。'
  const defeated = source.match(/^(.+?) has been defeated\.$/i)
  if (defeated) return `${defeated[1]} 已被击败。`
  const received = source.match(/^You gain ([\d,.]+) (EXP|experience points?|Credits?)[.!]?$/i)
  if (received)
    return `你获得了 ${received[1]} ${/^credits?$/i.test(received[2]!) ? '信用点' : '经验'}。`
  const proficiency = source.match(/^You gain ([\d,.]+) points? of (.+?) proficiency[.!]?$/i)
  if (proficiency) {
    const names: Record<string, string> = {
      'supportive magic': '辅助法术',
      'deprecating magic': '减益法术',
      'elemental magic': '元素法术',
      'divine magic': '神圣法术',
      'forbidden magic': '禁断法术',
      'one-handed weapon': '单手武器',
      'two-handed weapon': '双手武器',
      'dual-wielding': '双持',
      staff: '法杖',
      'cloth armor': '布甲',
      'light armor': '轻甲',
      'heavy armor': '重甲',
    }
    return `你的${names[proficiency[2]!.toLowerCase()] || translateBattleTerms(proficiency[2]!)}熟练度提高了 ${proficiency[1]} 点。`
  }
  if (/^With the light of a new dawn, your experience in all things increases\.$/i.test(source))
    return '新一天的曙光使你的各项熟练度有所提升。'
  const obtained = source.match(/^You (?:gain|obtained|obtain) (?:a |an )?(.+?)\.$/i)
  if (obtained) return `你获得了 ${translateBattleTerms(obtained[1]!)}。`
  const nextRound = source.match(
    /^(?:You have advanced to|You advance to|Starting) (?:the )?next round[.!]?$/i,
  )
  if (nextRound) return '进入下一轮战斗。'
  if (/^You are victorious[.!]?$/i.test(source)) return '你赢得了胜利！'
  const parry = source.match(/^You (parry|block|resist) (?:the )?attack from (.+?)\.$/i)
  if (parry)
    return `你${{ parry: '招架', block: '格挡', resist: '抵抗' }[parry[1]!.toLowerCase()]}了 ${parry[2]} 的攻击。`
  const targetParry = source.match(/^(.+?) (parries|blocks|resists) your attack\.$/i)
  if (targetParry)
    return `${targetParry[1]} ${{ parries: '招架', blocks: '格挡', resists: '抵抗' }[targetParry[2]!.toLowerCase()]}了你的攻击。`
  return translateBattleTerms(source)
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
      const punctuation = ['2', '4'].includes(family || '')
        ? { a: '.', b: ',', c: '!', e: '%', f: '+', g: '-', i: '/', m: ':' }[glyph.toLowerCase()]
        : undefined
      const space = ['3', '5'].includes(family || '') && glyph === '9'
      const replacement = fallback || (space ? ' ' : punctuation || glyph)
      if (replacement) node.textContent = replacement
    })
}
