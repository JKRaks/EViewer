import type { HentaiVerseBattleAction, HentaiVerseBattleSnapshot } from './model/hentaiVerse'
import {
  battleIdentity,
  battleManaCost,
  debuffEffects,
  hasActiveBattleEffect,
  protectiveEffects,
  weaponSkillStyles,
} from './hentaiVerseBattleSkills'
import {
  decideDebuff,
  decideBuffMaintenance,
  decideSpiritStance,
  decideWeaponSkill,
  selectCombatTarget,
  selectOffensiveSpell,
} from './hentaiVerseCombatTactics'

export interface AutoBattleSettings {
  style: 'physical' | 'magic'
  healAt: number
  criticalAt: number
  maintainRegen: boolean
  maintainBuffs: boolean
  targeting: 'selected' | 'lowest-health' | 'priority'
  useWeaponSkills: boolean
  spiritPolicy: 'manual' | 'sustain' | 'skills'
  spiritOnAt: number
  spiritOffAt: number
  spiritReserve: number
  overchargeReserve: number
  debuffs: 'off' | 'survival' | 'balanced'
  spellSelection: 'selected' | 'adaptive'
  actionDelay: number
  roundDelay: number
  spell: string
  continueRounds: boolean
}

export interface AutoBattleContext {
  recentHealthLoss?: number
  consecutiveDefends?: number
  failedDebuffs?: string[]
  specialThreats?: number[]
}

export interface AutoBattleDecision {
  reason: string
  action?: HentaiVerseBattleAction
  target?: number
}

export const defaultAutoBattleSettings: AutoBattleSettings = {
  style: 'physical',
  healAt: 60,
  criticalAt: 30,
  maintainRegen: true,
  maintainBuffs: true,
  targeting: 'selected',
  useWeaponSkills: true,
  spiritPolicy: 'manual',
  spiritOnAt: 100,
  spiritOffAt: 50,
  spiritReserve: 25,
  overchargeReserve: 25,
  debuffs: 'balanced',
  spellSelection: 'selected',
  actionDelay: 3,
  roundDelay: 5,
  spell: '',
  continueRounds: true,
}

export function normalizeAutoBattleSettings(value: unknown): AutoBattleSettings | null {
  if (!value || typeof value !== 'object') return null
  const settings = value as Record<string, unknown>
  const healAt = Number(settings.healAt)
  const criticalAt = Number(settings.criticalAt)
  const actionDelay = Number(settings.actionDelay ?? defaultAutoBattleSettings.actionDelay)
  const roundDelay = Number(settings.roundDelay ?? defaultAutoBattleSettings.roundDelay)
  const targeting = settings.targeting ?? defaultAutoBattleSettings.targeting
  const advanced = {
    useWeaponSkills: settings.useWeaponSkills ?? defaultAutoBattleSettings.useWeaponSkills,
    spiritPolicy: settings.spiritPolicy ?? defaultAutoBattleSettings.spiritPolicy,
    spiritOnAt: Number(settings.spiritOnAt ?? defaultAutoBattleSettings.spiritOnAt),
    spiritOffAt: Number(settings.spiritOffAt ?? defaultAutoBattleSettings.spiritOffAt),
    spiritReserve: Number(settings.spiritReserve ?? defaultAutoBattleSettings.spiritReserve),
    overchargeReserve: Number(
      settings.overchargeReserve ?? defaultAutoBattleSettings.overchargeReserve,
    ),
    debuffs: settings.debuffs ?? defaultAutoBattleSettings.debuffs,
    spellSelection: settings.spellSelection ?? defaultAutoBattleSettings.spellSelection,
  }
  if (
    !['physical', 'magic'].includes(String(settings.style)) ||
    !Number.isFinite(healAt) ||
    !Number.isFinite(criticalAt) ||
    criticalAt < 10 ||
    healAt > 90 ||
    criticalAt >= healAt ||
    typeof settings.maintainRegen !== 'boolean' ||
    (settings.maintainBuffs !== undefined && typeof settings.maintainBuffs !== 'boolean') ||
    !['selected', 'lowest-health', 'priority'].includes(String(targeting)) ||
    typeof advanced.useWeaponSkills !== 'boolean' ||
    !['manual', 'sustain', 'skills'].includes(String(advanced.spiritPolicy)) ||
    !['off', 'survival', 'balanced'].includes(String(advanced.debuffs)) ||
    !['selected', 'adaptive'].includes(String(advanced.spellSelection)) ||
    ![
      advanced.spiritOnAt,
      advanced.spiritOffAt,
      advanced.spiritReserve,
      advanced.overchargeReserve,
    ].every(Number.isInteger) ||
    advanced.spiritOnAt < 50 ||
    advanced.spiritOnAt > 250 ||
    advanced.spiritOffAt < 25 ||
    advanced.spiritOffAt >= advanced.spiritOnAt ||
    advanced.spiritReserve < 10 ||
    advanced.spiritReserve > 90 ||
    advanced.overchargeReserve < 0 ||
    advanced.overchargeReserve > 100 ||
    !Number.isInteger(actionDelay) ||
    actionDelay < 1 ||
    actionDelay > 10 ||
    !Number.isInteger(roundDelay) ||
    roundDelay < 1 ||
    roundDelay > 15 ||
    typeof settings.spell !== 'string'
  )
    return null
  return {
    style: settings.style as AutoBattleSettings['style'],
    healAt,
    criticalAt,
    maintainRegen: settings.maintainRegen,
    maintainBuffs:
      typeof settings.maintainBuffs === 'boolean'
        ? settings.maintainBuffs
        : defaultAutoBattleSettings.maintainBuffs,
    targeting: targeting as AutoBattleSettings['targeting'],
    ...(advanced as Pick<AutoBattleSettings, keyof typeof advanced>),
    actionDelay,
    roundDelay,
    spell: settings.spell,
    continueRounds: settings.continueRounds !== false,
  }
}

/** Match source identities; translated labels never select a spell. */
export function hasBattleEffect(battle: HentaiVerseBattleSnapshot, ids: string[]): boolean {
  if (battle.activeEffects !== undefined) return hasActiveBattleEffect(battle.activeEffects, ids)
  return battle.effectIds?.some((id) => ids.includes(id)) ?? false
}

/** Only known spells and non-consumable actions may run automatically. */
export function canUseAutomaticBattleAction(
  battle: HentaiVerseBattleSnapshot,
  action: HentaiVerseBattleAction,
  target?: number,
): boolean {
  if (
    action.available !== true ||
    (action.cooldownRemaining ?? 0) > 0 ||
    battle.completed ||
    battle.roundCompleted ||
    battle.verificationRequired
  )
    return false
  if (action.mode === 'attack') return action.skill === 0 && action.target === 'enemy'
  if (action.mode === 'defend') return action.skill === 0 && action.target !== 'enemy'
  if (action.mode === 'focus')
    return (battle.overcharge ?? 0) >= 25 && action.skill === 0 && action.target !== 'enemy'
  if (action.mode === 'spirit')
    return (
      battle.spiritStance !== undefined &&
      action.skill === 0 &&
      (battle.spiritStance ||
        ((battle.overcharge ?? 0) >= 50 &&
          (battle.vitals.find((vital) => vital.key === 'spirit')?.current ?? 0) > 0))
    )
  if (action.mode !== 'magic' || !action.kind || action.kind === 'other') return false
  const id = battleIdentity(action.sourceName || '')
  if (action.kind === 'buff' && !protectiveEffects[id]) return false
  if (action.kind === 'debuff' && !debuffEffects[id]) return false
  if (action.kind === 'weapon') {
    if (
      !weaponSkillStyles[id] ||
      battle.spiritStance === undefined ||
      action.overchargeCost === undefined ||
      !Number.isFinite(action.overchargeCost) ||
      action.overchargeCost <= 0 ||
      (battle.overcharge ?? -1) < action.overchargeCost + (battle.spiritStance ? 10 : 0)
    )
      return false
  }
  if (action.target !== (['offense', 'weapon', 'debuff'].includes(action.kind) ? 'enemy' : 'self'))
    return false
  const mana = battle.vitals.find((vital) => vital.key === 'magic')?.current
  const cost = battleManaCost(battle, action, target)
  return (
    cost !== undefined &&
    (cost === 0 || (mana !== undefined && Number.isFinite(mana) && cost <= mana))
  )
}

/** Recovery owns the healing window and the MP budget used by later choices. */
function decideRecovery(
  battle: HentaiVerseBattleSnapshot,
  settings: AutoBattleSettings,
  actions: HentaiVerseBattleAction[],
  context: AutoBattleContext,
  healthPercent: number,
): { decision?: AutoBattleDecision; reserve?: number; healAt: number } {
  const loss = Number.isFinite(context.recentHealthLoss)
    ? Math.max(0, context.recentHealthLoss!)
    : 0
  const healAt = Math.min(90, Math.max(settings.healAt, settings.criticalAt + loss * 1.5))
  const criticalAt = Math.min(healAt - 1, Math.max(settings.criticalAt, loss + 5))
  const heals = battle.actions.filter(
    (action) =>
      action.mode === 'magic' &&
      ['heal', 'full-heal'].includes(action.kind || '') &&
      action.manaCost !== undefined &&
      Number.isFinite(action.manaCost) &&
      action.manaCost >= 0,
  )
  const ready = actions.filter((action) => ['heal', 'full-heal'].includes(action.kind || ''))
  const cure = ready.find((action) => action.kind === 'heal')
  const fullCure = ready.find((action) => action.kind === 'full-heal')
  const candidates = ready.length ? ready : heals
  const reserve = candidates.length
    ? Math.min(...candidates.map((action) => action.manaCost!))
    : undefined
  if (healthPercent > healAt) return { reserve, healAt }
  const recovery = healthPercent <= criticalAt ? fullCure || cure : cure || fullCure
  if (recovery)
    return {
      reserve,
      healAt,
      decision: {
        action: recovery,
        target: 0,
        reason:
          healthPercent <= criticalAt
            ? '生命危急，优先恢复生命'
            : '生命偏低或近期承伤较高，准备治疗',
      },
    }
  const mana = battle.vitals.find((vital) => vital.key === 'magic')?.current
  const recoveryExpected =
    (battle.overcharge ?? 0) >= 25 ||
    hasBattleEffect(battle, ['regen', 'regeneration']) ||
    heals.some(
      (action) =>
        mana !== undefined &&
        action.manaCost! <= mana &&
        action.cooldownRemaining !== undefined &&
        action.cooldownRemaining > 0 &&
        action.cooldownRemaining <= 2,
    )
  const defend = actions.find((action) => action.mode === 'defend')
  return {
    reserve,
    healAt,
    decision:
      defend &&
      recoveryExpected &&
      (context.consecutiveDefends ?? 0) < 2 &&
      healthPercent - loss > criticalAt
        ? { action: defend, target: 0, reason: '短暂防御，等待已确认的恢复机会' }
        : { reason: '当前没有可靠的治疗机会，已暂停等待接管' },
  }
}

/** Decide exactly one action from the latest confirmed snapshot. */
export function decideAutoBattleAction(
  battle: HentaiVerseBattleSnapshot,
  settings: AutoBattleSettings,
  selectedTarget?: number,
  context: AutoBattleContext = {},
): AutoBattleDecision {
  if (battle.verificationRequired) return { reason: '源站需要手动验证，自动战斗已暂停' }
  if (battle.completed) return { reason: '本次战斗已结束' }
  if (battle.roundCompleted) return { reason: '本轮已结束，等待手动继续' }
  const health = battle.vitals.find((vital) => vital.key === 'health')
  if (!health || health.percentKnown === false || !Number.isFinite(health.percent))
    return { reason: '无法确认生命状态，请从服务器恢复' }
  const target = selectCombatTarget(battle, settings, selectedTarget, context)
  const actions = battle.actions.filter((action) =>
    canUseAutomaticBattleAction(battle, action, target),
  )
  const recovery = decideRecovery(battle, settings, actions, context, health.percent)
  if (recovery.decision) return recovery.decision
  const { reserve, healAt } = recovery
  const mana = battle.vitals.find((vital) => vital.key === 'magic')?.current
  const living = battle.monsters.filter(
    (monster) =>
      !monster.defeated && monster.healthPercent !== undefined && monster.healthPercent > 0,
  )
  if (!living.length) return { reason: '没有可确认的存活目标，请从服务器恢复' }
  if (target === undefined) return { reason: '剩余目标处于控制状态，已暂停等待接管' }
  const tactics = { battle, settings, actions, context, target, reserve, healAt }
  const stance = decideSpiritStance(tactics)
  if (stance) return stance
  const buff = decideBuffMaintenance(tactics)
  if (buff) return buff
  const debuff = decideDebuff(tactics)
  if (debuff) return debuff
  const weapon = decideWeaponSkill(tactics)
  if (weapon && settings.style === 'physical') return weapon
  const configuredSpell = battle.actions.find(
    (action) =>
      action.mode + ':' + action.skill === settings.spell &&
      action.mode === 'magic' &&
      action.kind === 'offense' &&
      action.target === 'enemy',
  )
  if (settings.style === 'magic') {
    if (settings.spellSelection === 'selected' && !configuredSpell)
      return { reason: '请先在策略设置中选择进攻法术' }
    if (reserve === undefined || mana === undefined)
      return { reason: '无法确认治疗所需魔力，已暂停' }
    const spell = selectOffensiveSpell(tactics)
    if (spell)
      return {
        action: spell,
        target,
        reason:
          settings.spellSelection === 'adaptive'
            ? '结合目标数量、冷却和魔力预算选择进攻法术'
            : '魔力充足，准备施放进攻法术',
      }
  }
  if (weapon) return weapon
  const focus = actions.find((action) => action.mode === 'focus')
  const spellCosts = battle.actions
    .filter(
      (action) =>
        action.kind === 'offense' &&
        action.manaCost !== undefined &&
        Number.isFinite(action.manaCost),
    )
    .map((action) => action.manaCost!)
  const offensiveReserve =
    configuredSpell?.manaCost ?? (spellCosts.length ? Math.min(...spellCosts) : 0)
  const manaNeeded =
    reserve !== undefined
      ? reserve + (settings.style === 'magic' ? offensiveReserve : 0)
      : undefined
  if (
    focus &&
    health.percent >= Math.max(75, healAt + 10) &&
    health.percent - (context.recentHealthLoss ?? 0) * 2 > settings.criticalAt &&
    !hasBattleEffect(battle, ['focus', 'focusing']) &&
    (!hasBattleEffect(battle, ['ethertap']) || (mana ?? 0) < (reserve ?? 0)) &&
    mana !== undefined &&
    manaNeeded !== undefined &&
    mana < manaNeeded
  )
    return { action: focus, target: 0, reason: '生命状态稳定，使用专注恢复魔力' }
  const attack = actions.find((action) => action.mode === 'attack')
  return attack
    ? {
        action: attack,
        target,
        reason:
          settings.style === 'magic' ? '保留治疗魔力，使用普通攻击' : '生命状态稳定，使用普通攻击',
      }
    : { reason: '没有满足条件的非消耗品操作，已暂停' }
}
