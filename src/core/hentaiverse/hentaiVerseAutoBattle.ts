import type { HentaiVerseBattleAction, HentaiVerseBattleSnapshot } from './model/hentaiVerse'

export interface AutoBattleSettings {
  style: 'physical' | 'magic'
  healAt: number
  criticalAt: number
  maintainRegen: boolean
  spell: string
  continueRounds: boolean
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
  spell: '',
  continueRounds: true,
}

export function normalizeAutoBattleSettings(value: unknown): AutoBattleSettings | null {
  if (!value || typeof value !== 'object') return null
  const settings = value as Record<string, unknown>
  const healAt = Number(settings.healAt)
  const criticalAt = Number(settings.criticalAt)
  if (
    !['physical', 'magic'].includes(String(settings.style)) ||
    !Number.isFinite(healAt) ||
    !Number.isFinite(criticalAt) ||
    criticalAt < 10 ||
    healAt > 90 ||
    criticalAt >= healAt ||
    typeof settings.maintainRegen !== 'boolean' ||
    typeof settings.spell !== 'string'
  )
    return null
  return {
    style: settings.style as AutoBattleSettings['style'],
    healAt,
    criticalAt,
    maintainRegen: settings.maintainRegen,
    spell: settings.spell,
    continueRounds: settings.continueRounds !== false,
  }
}

/** The automatic executor never falls back to an item or an unclassified spell. */
export function canUseAutomaticBattleAction(
  battle: HentaiVerseBattleSnapshot,
  action: HentaiVerseBattleAction,
): boolean {
  if (
    action.available !== true ||
    battle.completed ||
    battle.roundCompleted ||
    battle.verificationRequired
  )
    return false
  if (action.mode === 'attack') return action.skill === 0 && action.target === 'enemy'
  if (action.mode === 'defend') return action.skill === 0 && action.target !== 'enemy'
  if (action.mode === 'focus') return (battle.overcharge ?? 0) >= 25 && action.skill === 0
  if (action.mode !== 'magic' || !action.kind || action.kind === 'other') return false
  if (action.target !== (action.kind === 'offense' ? 'enemy' : 'self')) return false
  const mana = battle.vitals.find((vital) => vital.key === 'magic')?.current
  return (
    mana !== undefined &&
    Number.isFinite(mana) &&
    action.manaCost !== undefined &&
    Number.isFinite(action.manaCost) &&
    action.manaCost >= 0 &&
    action.manaCost <= mana
  )
}

/** Decide only the next turn from the latest confirmed snapshot. */
export function decideAutoBattleAction(
  battle: HentaiVerseBattleSnapshot,
  settings: AutoBattleSettings,
  selectedTarget?: number,
): AutoBattleDecision {
  if (battle.verificationRequired) return { reason: '源站需要手动验证，自动战斗已暂停' }
  if (battle.completed) return { reason: '本次战斗已结束' }
  if (battle.roundCompleted) return { reason: '本轮已结束，等待手动继续' }
  const health = battle.vitals.find((vital) => vital.key === 'health')
  if (!health || health.percentKnown === false || !Number.isFinite(health.percent))
    return { reason: '无法确认生命状态，请从服务器恢复' }
  const actions = battle.actions.filter((action) => canUseAutomaticBattleAction(battle, action))
  const cure = actions.find((action) => action.kind === 'heal')
  const fullCure = actions.find((action) => action.kind === 'full-heal')
  if (health.percent <= settings.criticalAt && fullCure)
    return { action: fullCure, target: 0, reason: '生命危急，准备完全治疗' }
  if (health.percent <= settings.healAt) {
    const recovery = cure || fullCure
    if (recovery) return { action: recovery, target: 0, reason: '生命偏低，准备治疗' }
    const defend = actions.find((action) => action.mode === 'defend')
    return defend
      ? { action: defend, target: 0, reason: '当前无法治疗，使用防御等待恢复' }
      : { reason: '当前无法治疗且防御不可用，已暂停等待接管' }
  }

  const mana = battle.vitals.find((vital) => vital.key === 'magic')?.current
  const healingCosts = battle.actions
    .filter(
      (action) => action.mode === 'magic' && ['heal', 'full-heal'].includes(action.kind || ''),
    )
    .map((action) => action.manaCost)
    .filter((cost): cost is number => cost !== undefined && Number.isFinite(cost) && cost >= 0)
  const reserve = healingCosts.length ? Math.min(...healingCosts) : undefined
  const regen = actions.find((action) => action.kind === 'regen')
  if (
    settings.maintainRegen &&
    health.percent < 90 &&
    battle.effectIds &&
    !battle.effectIds.includes('regeneration') &&
    !battle.effectIds.includes('regen') &&
    regen &&
    mana !== undefined &&
    reserve !== undefined &&
    mana - regen.manaCost! >= reserve
  )
    return { action: regen, target: 0, reason: '补充再生，保留治疗魔力' }

  const living = battle.monsters.filter(
    (monster) =>
      !monster.defeated && monster.healthPercent !== undefined && monster.healthPercent > 0,
  )
  const target = living.find((monster) => monster.id === selectedTarget)?.id ?? living[0]?.id
  if (target === undefined) return { reason: '没有可确认的存活目标，请从服务器恢复' }
  const spell = battle.actions.find(
    (action) =>
      `${action.mode}:${action.skill}` === settings.spell &&
      action.mode === 'magic' &&
      action.kind === 'offense' &&
      action.target === 'enemy',
  )
  if (settings.style === 'magic') {
    if (!spell) return { reason: '请先在策略设置中选择进攻法术' }
    if (reserve === undefined || mana === undefined)
      return { reason: '无法确认治疗所需魔力，已暂停' }
    if (canUseAutomaticBattleAction(battle, spell) && mana - spell.manaCost! >= reserve)
      return { action: spell, target, reason: '魔力充足，准备施放进攻法术' }
  }
  const focus = actions.find((action) => action.mode === 'focus')
  const manaNeeded = reserve !== undefined ? reserve + (spell?.manaCost ?? 0) : undefined
  if (
    focus &&
    health.percent >= Math.max(75, settings.healAt) &&
    mana !== undefined &&
    manaNeeded !== undefined &&
    mana < manaNeeded
  )
    return { action: focus, target: 0, reason: '过载充足，使用专注恢复魔力' }
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
