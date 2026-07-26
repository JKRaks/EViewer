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
  type: 'text' | 'number' | 'password' | 'select' | 'textarea' | 'checkbox' | 'radio'
  value: string
  checked?: boolean
  options?: HentaiVerseOption[]
  min?: number
  max?: number
  step?: number
}

export interface HentaiVerseFormAction {
  name: string
  value: string
  label: string
  danger?: boolean
}

export interface HentaiVerseFormBlock {
  id: string
  title: string
  description: string
  section: HentaiVerseFormSection
  hidden: Record<string, string>
  controls: HentaiVerseFormControl[]
  actions: HentaiVerseFormAction[]
}

export interface HentaiVersePage {
  section: HentaiVerseSection
  title: string
  characterName: string
  personaName: string
  authenticated: boolean
  usableExperience: number
  metrics: HentaiVerseMetric[]
  attributes: HentaiVerseAttribute[]
  personas: HentaiVersePersona[]
  forms: HentaiVerseFormBlock[]
  notices: string[]
}

export interface HentaiVerseEncounter {
  url: string
  token: string
  foundAt: number
}

export type HentaiVerseBattleMode = 'attack' | 'magic' | 'items' | 'spirit' | 'defend' | 'focus'

export interface HentaiVerseBattleAction {
  label: string
  mode: HentaiVerseBattleMode
  skill: number
}

export interface HentaiVerseBattleMonster {
  id: number
  name: string
  status: string
  defeated: boolean
}

export interface HentaiVerseBattleSnapshot {
  token: string
  title: string
  vitals: string[]
  effects: string[]
  monsters: HentaiVerseBattleMonster[]
  actions: HentaiVerseBattleAction[]
  log: string[]
  completed: boolean
  completionText: string
}
