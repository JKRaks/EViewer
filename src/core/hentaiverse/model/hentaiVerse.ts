import type { HentaiVerseArmoryPage } from '../hentaiVerseArmory'
import type { HentaiVerseBazaarPage } from '../hentaiVerseBazaar'
import type { HentaiVerseServicesPage } from '../hentaiVerseServices'

export type HentaiVerseServiceSection =
  | 'armory'
  | 'itemShop'
  | 'market'
  | 'shrine'
  | 'monsterLab'
  | 'moogleMail'
  | 'weaponLottery'
  | 'armorLottery'

export type HentaiVerseSection =
  | HentaiVerseServiceSection
  | 'character'
  | 'equipment'
  | 'abilities'
  | 'training'
  | 'inventory'
  | 'settings'
  | 'arena'
  | 'ringOfBlood'
  | 'grindfest'
  | 'itemWorld'
  | 'tower'

export type HentaiVerseFormSection =
  | HentaiVerseServiceSection
  | 'character'
  | 'persona'
  | 'equipment'
  | 'abilities'
  | 'training'
  | 'inventory'
  | 'settings'
  | 'arena'
  | 'ringOfBlood'
  | 'grindfest'
  | 'itemWorld'
  | 'tower'

export interface HentaiVersePageTarget {
  world?: 'persistent' | 'isekai'
  s?: string
  ss?: string
  encounter?: string
  equip_slot?: string
  tree?: string
  filter?: string
  screen?: string
  'eqids[]'?: string
  itemid?: string
  tradelog?: string
  playerstock?: string
  marketstock?: string
  lottery?: string
  create?: string
  slot?: string
  pane?: string
}

export type HentaiVerseFormData = Record<string, string | number | boolean | string[]>

export interface HentaiVerseStatGroup {
  title: string
  metrics: HentaiVerseMetric[]
}

export interface HentaiVerseMetric {
  label: string
  value: string
  percent?: number
}

export interface HentaiVerseAttribute {
  key: 'str' | 'dex' | 'agi' | 'end' | 'int' | 'wis'
  label: string
  value: number
  delta: number
}

export interface HentaiVersePersona {
  id: string
  name: string
  active: boolean
}

export interface HentaiVerseOption {
  label: string
  value: string
  selected?: boolean
}

export interface HentaiVerseFormControl {
  name: string
  label: string
  group?: string
  groupLabel?: string
  type: 'text' | 'number' | 'password' | 'select' | 'textarea' | 'checkbox' | 'radio'
  value: string
  checked?: boolean
  options?: HentaiVerseOption[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  help?: string
}

export interface HentaiVerseFormAction {
  name: string
  value: string
  label: string
  danger?: boolean
  disabled?: boolean
}

export interface HentaiVerseFormGroup {
  key: string
  title: string
  description: string
}

export interface HentaiVerseFormBlock {
  id: string
  title: string
  description: string
  section: HentaiVerseFormSection
  hidden: Record<string, string>
  controls: HentaiVerseFormControl[]
  actions: HentaiVerseFormAction[]
  groups?: HentaiVerseFormGroup[]
}

export interface HentaiVerseEquipmentSet {
  id: string
  label: string
  active: boolean
}

export interface HentaiVerseEquipmentSlot {
  id: string
  label: string
  equipmentId: string
  equipmentName: string
  description: string
  active: boolean
  disabled: boolean
}

export interface HentaiVerseEquipmentCandidate {
  id: string
  name: string
  description: string
  locked: boolean
  equipped: boolean
}

export interface HentaiVerseEquipmentDetail {
  id: string
  name: string
  summary: string
  status: string[]
  effects: string[]
  groups: {
    title: string
    metrics: (HentaiVerseMetric & { base?: string })[]
  }[]
}

export interface HentaiVerseEquipmentPage {
  sets: HentaiVerseEquipmentSet[]
  slots: HentaiVerseEquipmentSlot[]
  candidates: HentaiVerseEquipmentCandidate[]
  selectedSlot: string
  postToken: string
  canUnequip: boolean
}

export type HentaiVerseAbilityActionName =
  | 'unlock_ability'
  | 'reset_ability'
  | 'unlock_slot'
  | 'equip_ability'

export interface HentaiVerseAbilityTree {
  id: string
  label: string
  active: boolean
}

export interface HentaiVerseAbility {
  id: string
  name: string
  description: string
  level: number | null
  maxLevel: number
  cost: string
  action?: HentaiVerseAbilityActionName
  actionLabel?: string
  disabled: boolean
  group: string
  currentEffect: string
  nextEffect: string
  resetCost?: number
}

export interface HentaiVerseAbilitySlot {
  id: string
  label: string
  abilityId: string
  abilityName: string
  locked: boolean
  action?: HentaiVerseAbilityActionName
  group: string
  unlockCost?: number
}

export interface HentaiVerseAbilityPage {
  trees: HentaiVerseAbilityTree[]
  abilities: HentaiVerseAbility[]
  slots: HentaiVerseAbilitySlot[]
  selectedTree: string
  abilityPoints: string
  canResetAll: boolean
  masteryPoints: string
  resetCost?: number
}

export interface HentaiVerseTrainingOption {
  id: string
  name: string
  description: string
  level: string
  cost: string
  duration: string
  canStart: boolean
  unavailableReason: string
}

export interface HentaiVerseTrainingPage {
  active: boolean
  activeName: string
  progress: string
  remaining: string
  endsAt?: number
  durationSeconds?: number
  canCancel: boolean
  options: HentaiVerseTrainingOption[]
}

export interface HentaiVerseInventoryItem {
  id: string
  name: string
  description: string
  quantity: string
  selected: boolean
  canAssign: boolean
  category: string
}

export interface HentaiVerseInventorySlot {
  id: string
  label: string
  itemId: string
  itemName: string
  category: string
}

export interface HentaiVerseInventoryPage {
  items: HentaiVerseInventoryItem[]
  slots: HentaiVerseInventorySlot[]
}

export interface HentaiVersePage {
  world?: 'persistent' | 'isekai'
  season?: string
  section: HentaiVerseSection
  title: string
  characterName: string
  personaName: string
  authenticated: boolean
  usableExperience: number
  metrics: HentaiVerseMetric[]
  statGroups: HentaiVerseStatGroup[]
  personaCapacity?: { used: number; total: number }
  attributes: HentaiVerseAttribute[]
  personas: HentaiVersePersona[]
  equipment?: HentaiVerseEquipmentPage
  armory?: HentaiVerseArmoryPage
  bazaar?: HentaiVerseBazaarPage
  services?: HentaiVerseServicesPage
  equipmentSources?: string[]
  abilities?: HentaiVerseAbilityPage
  training?: HentaiVerseTrainingPage
  inventory?: HentaiVerseInventoryPage
  challenges?: HentaiVerseChallenge[]
  challengePostToken?: string
  itemWorld?: HentaiVerseItemWorldPage
  forms: HentaiVerseFormBlock[]
  notices: string[]
}

export interface HentaiVerseChallenge {
  id: string
  name: string
  highestClear: string
  minLevel: string
  rounds: string
  experienceModifier: string
  entryCost: string
  clearBonus: string
  unavailableReason: string
  available: boolean
}

export interface HentaiVerseItemWorldPage {
  categories: HentaiVerseOption[]
  selectedCategory: string
  candidates: HentaiVerseEquipmentCandidate[]
  postToken: string
  worldSeeds: string
  rules: string[]
  emptyReason: string
  entryInfo: Record<
    string,
    {
      level: string
      rounds: string
      monsterLevel: string
      difficulty: string
      cost: string
      available: boolean
    }
  >
}

export interface HentaiVerseEncounter {
  url: string
  token: string
  foundAt: number
}

export type HentaiVerseBattleMode = 'attack' | 'magic' | 'items' | 'spirit' | 'defend' | 'focus'
export type HentaiVerseWeaponStyle = 'one-handed' | 'two-handed' | 'dual-wield' | 'niten' | 'staff'

export interface HentaiVerseBattleAction {
  label: string
  description: string
  mode: HentaiVerseBattleMode
  skill: number
  target: 'enemy' | 'self' | 'none'
  sourceName?: string
  available?: boolean
  manaCost?: number
  overchargeCost?: number
  cooldown?: number
  cooldownRemaining?: number
  sourcePanel?: 'magic' | 'skills' | 'items' | 'quickbar'
  kind?: 'offense' | 'weapon' | 'debuff' | 'heal' | 'full-heal' | 'regen' | 'buff' | 'other'
}

export interface HentaiVerseBattleEffect {
  id: string
  label?: string
  remainingTicks?: number
  remainingTurns?: number
  expiry?: 'autocast' | 'permanent' | 'decaying'
  stacks?: number
}

export interface HentaiVerseBattleVital {
  key: 'health' | 'magic' | 'spirit'
  label: string
  value: string
  percent: number
  current?: number
  maximum?: number
  percentKnown?: boolean
}

export interface HentaiVerseBattleMonster {
  id: number
  name: string
  status: string
  /** Approximate source bar percentage; a living monster can round down to zero. */
  healthPercent?: number
  magicPercent?: number
  defeated: boolean
  spiritPercent?: number
  activeEffects?: HentaiVerseBattleEffect[]
  specialAttackObserved?: boolean
}

export interface HentaiVerseBattleSnapshot {
  verificationRequired?: boolean
  token: string
  title: string
  vitals: HentaiVerseBattleVital[]
  effects: string[]
  monsters: HentaiVerseBattleMonster[]
  actions: HentaiVerseBattleAction[]
  log: string[]
  completed: boolean
  completionText: string
  roundCompleted?: boolean
  effectIds?: string[]
  activeEffects?: HentaiVerseBattleEffect[]
  overcharge?: number
  overchargeExact?: boolean
  spiritStance?: boolean
  weaponStyle?: HentaiVerseWeaponStyle
}
