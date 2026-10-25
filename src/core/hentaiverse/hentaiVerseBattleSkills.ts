import type {
  HentaiVerseBattleAction,
  HentaiVerseBattleEffect,
  HentaiVerseBattleSnapshot,
  HentaiVerseWeaponStyle,
} from './model/hentaiVerse'

export const battleIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const weaponSkillStyles: Record<string, HentaiVerseWeaponStyle> = {
  shieldbash: 'one-handed',
  vitalstrike: 'one-handed',
  mercifulblow: 'one-handed',
  greatcleave: 'two-handed',
  rendingblow: 'two-handed',
  shatterstrike: 'two-handed',
  irisstrike: 'dual-wield',
  backstab: 'dual-wield',
  frenziedblows: 'dual-wield',
  skywardsword: 'niten',
  concussivestrike: 'staff',
}

export const protectiveEffects: Record<string, string[]> = {
  sparkoflife: ['sparkoflife'],
  spiritshield: ['spiritshield'],
  protection: ['protection', 'protect'],
  haste: ['haste', 'hastened'],
  shadowveil: ['shadowveil', 'shadowveiled'],
  heartseeker: ['heartseeker'],
  arcanefocus: ['arcanefocus'],
}

export const debuffEffects: Record<string, string[]> = {
  weaken: ['weaken', 'weakened'],
  imperil: ['imperil', 'imperiled', 'imperilled'],
  silence: ['silence', 'silenced'],
  slow: ['slow', 'slowed'],
  blind: ['blind', 'blinded'],
}

// Minimum target counts only guide selection; source tooltips own costs and availability.
export const offensiveSpells: Record<string, { tier: number; targets: number }> =
  Object.fromEntries(
    [
      ['fieryblast', 'inferno', 'flamesofloki'],
      ['freeze', 'blizzard', 'fimbulvetr'],
      ['shockblast', 'chainedlightning', 'wrathofthor'],
      ['gale', 'downburst', 'stormsofnjord'],
      ['smite', 'banishment', 'paradiselost'],
      ['corruption', 'disintegrate', 'ragnarok'],
    ].flatMap((school) =>
      school.map((id, index) => [id, { tier: index + 1, targets: [3, 5, 7][index]! }]),
    ),
  )

export function classifyBattleSkill(sourceName: string): HentaiVerseBattleAction['kind'] {
  const id = battleIdentity(sourceName)
  if (weaponSkillStyles[id]) return 'weapon'
  if (debuffEffects[id]) return 'debuff'
  if (protectiveEffects[id]) return 'buff'
  if (offensiveSpells[id]) return 'offense'
  return (
    ({ cure: 'heal', fullcure: 'full-heal', regen: 'regen' } as const)[
      id as 'cure' | 'fullcure' | 'regen'
    ] || 'other'
  )
}

export function hasActiveBattleEffect(
  effects: HentaiVerseBattleEffect[] | undefined,
  ids: string[],
): boolean {
  return (
    effects?.some(
      (effect) =>
        ids.includes(effect.id) && (effect.remainingTurns ?? effect.remainingTicks ?? 1) > 0,
    ) ?? false
  )
}

export function battleManaCost(
  battle: HentaiVerseBattleSnapshot,
  action: HentaiVerseBattleAction,
  target?: number,
): number | undefined {
  if (action.manaCost === undefined || !Number.isFinite(action.manaCost) || action.manaCost < 0)
    return undefined
  const channeling =
    battle.activeEffects !== undefined
      ? hasActiveBattleEffect(battle.activeEffects, ['channeling'])
      : battle.effectIds?.includes('channeling')
  if (channeling && action.mode === 'magic' && action.kind !== 'weapon')
    return Math.min(action.manaCost, 1)
  const monster = battle.monsters.find((item) => item.id === target)
  return action.target === 'enemy' &&
    action.kind !== 'weapon' &&
    hasActiveBattleEffect(monster?.activeEffects, ['coalescedmana'])
    ? Math.ceil(action.manaCost / 2)
    : action.manaCost
}

export function battleSpiritReserve(battle: HentaiVerseBattleSnapshot, configured: number): number {
  const effects = battle.activeEffects
  const guarded =
    effects !== undefined
      ? hasActiveBattleEffect(effects, ['sparkoflife', 'spiritshield'])
      : battle.effectIds?.some((id) => ['sparkoflife', 'spiritshield'].includes(id))
  // This is a spending reserve, never a claim that an effect can absorb the next hit.
  return guarded ? Math.max(configured, 50) : configured
}
