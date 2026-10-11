export type HentaiVerseSection =
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

export type HentaiVerseFormSection =
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

export interface HentaiVersePageTarget {
  s?: string
  ss?: string
  encounter?: string
  equip_slot?: string
  tree?: string
  filter?: string
}

export type HentaiVerseFormData = Record<string, string | number | boolean | string[]>

export interface HentaiVerseStatGroup {
  title: string
  metrics: HentaiVerseMetric[]
}

export interface HentaiVerseMetric {
  label: string
  value: string
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

export interface HentaiVerseBattleAction {
  label: string
  description: string
  mode: HentaiVerseBattleMode
  skill: number
  target: 'enemy' | 'self' | 'none'
}

export interface HentaiVerseBattleVital {
  key: 'health' | 'magic' | 'spirit'
  label: string
  value: string
  percent: number
}

export interface HentaiVerseBattleMonster {
  id: number
  name: string
  status: string
  healthPercent?: number
  magicPercent?: number
  defeated: boolean
}

export interface HentaiVerseBattleSnapshot {
  token: string
  title: string
  vitals: HentaiVerseBattleVital[]
  effects: string[]
  monsters: HentaiVerseBattleMonster[]
  actions: HentaiVerseBattleAction[]
  log: string[]
  completed: boolean
  completionText: string
}
