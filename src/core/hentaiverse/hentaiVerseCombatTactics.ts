import type {
  AutoBattleContext,
  AutoBattleDecision,
  AutoBattleSettings,
} from './hentaiVerseAutoBattle'
import type {
  HentaiVerseBattleAction,
  HentaiVerseBattleMonster,
  HentaiVerseBattleSnapshot,
} from './model/hentaiVerse'
import {
  battleIdentity,
  battleManaCost,
  battleSpiritReserve,
  debuffEffects,
  hasActiveBattleEffect,
  offensiveSpells,
  protectiveEffects,
  weaponSkillStyles,
} from './hentaiVerseBattleSkills'

export interface CombatTacticsContext {
  battle: HentaiVerseBattleSnapshot
  settings: AutoBattleSettings
  actions: HentaiVerseBattleAction[]
  context: AutoBattleContext
  target: number
  reserve?: number
  healAt: number
}

function canSpendMana(
  state: CombatTacticsContext,
  action: HentaiVerseBattleAction,
  target: number,
) {
  const mana = state.battle.vitals.find((vital) => vital.key === 'magic')?.current
  const cost = battleManaCost(state.battle, action, target)
  return (
    mana !== undefined &&
    cost !== undefined &&
    state.reserve !== undefined &&
    mana - cost >= state.reserve
  )
}

export function selectCombatTarget(
  battle: HentaiVerseBattleSnapshot,
  settings: AutoBattleSettings,
  selectedTarget: number | undefined,
  context: AutoBattleContext,
): number | undefined {
  const monsters = battle.monsters.filter(
    (monster) =>
      !monster.defeated &&
      (monster.healthPercent ?? 0) > 0 &&
      !hasActiveBattleEffect(monster.activeEffects, [
        'sleep',
        'asleep',
        'sleeping',
        'confuse',
        'confused',
      ]),
  )
  if (settings.targeting === 'selected')
    return (monsters.find((monster) => monster.id === selectedTarget) || monsters[0])?.id
  const priority = (monster: HentaiVerseBattleMonster) =>
    Number(Boolean(monster.specialAttackObserved || context.specialThreats?.includes(monster.id))) *
      4 +
    Number((monster.magicPercent ?? 0) >= 75 || (monster.spiritPercent ?? 0) >= 75) * 2 +
    Number(
      settings.style === 'magic' && hasActiveBattleEffect(monster.activeEffects, ['coalescedmana']),
    )
  monsters.sort(
    (left, right) =>
      (settings.targeting === 'priority' ? priority(right) - priority(left) : 0) ||
      left.healthPercent! - right.healthPercent!,
  )
  return monsters[0]?.id
}

/** A stance toggle is one confirmed action. Re-evaluate costs after its response. */
export function decideSpiritStance(state: CombatTacticsContext): AutoBattleDecision | undefined {
  const { battle, settings, actions, healAt } = state
  if (settings.spiritPolicy === 'manual') return
  if (battle.spiritStance === undefined) return { reason: '无法确认姿态资源，已暂停等待接管' }
  const toggle = actions.find((action) => action.mode === 'spirit')
  const spirit = battle.vitals.find((vital) => vital.key === 'spirit')
  const health = battle.vitals.find((vital) => vital.key === 'health')?.percent ?? 0
  const spiritFloor = battleSpiritReserve(battle, settings.spiritReserve)
  if (
    battle.spiritStance &&
    (spirit?.percentKnown === false ||
      spirit?.percent === undefined ||
      battle.overcharge === undefined)
  )
    return { reason: '无法确认姿态资源，已暂停等待接管' }
  if (
    !toggle ||
    spirit?.percentKnown === false ||
    spirit?.percent === undefined ||
    battle.overcharge === undefined
  )
    return
  const weaponCosts = battle.actions
    .filter((action) => action.kind === 'weapon' && action.overchargeCost !== undefined)
    .map((action) => action.overchargeCost!)
  const nextSkillCost = weaponCosts.length ? Math.min(...weaponCosts) : 0
  if (battle.spiritStance) {
    if (
      spirit.percent <= spiritFloor ||
      battle.overcharge <= settings.spiritOffAt ||
      (settings.spiritPolicy === 'skills' &&
        settings.useWeaponSkills &&
        nextSkillCost > 0 &&
        battle.overcharge < nextSkillCost + settings.overchargeReserve + 10)
    )
      return { action: toggle, target: 0, reason: '关闭灵力姿态，保留灵力与关键技能过载' }
    return
  }
  const required =
    settings.spiritPolicy === 'skills' && settings.useWeaponSkills
      ? Math.max(settings.spiritOnAt, nextSkillCost + settings.overchargeReserve + 35)
      : settings.spiritOnAt
  if (
    battle.overcharge >= required &&
    spirit.percent >= spiritFloor + 10 &&
    health > healAt + 5 &&
    battle.monsters.some((monster) => !monster.defeated && (monster.healthPercent ?? 0) > 40)
  )
    return { action: toggle, target: 0, reason: '资源充足，开启灵力姿态' }
}

export function decideBuffMaintenance(state: CombatTacticsContext): AutoBattleDecision | undefined {
  const { battle, settings, actions, healAt } = state
  const health = battle.vitals.find((vital) => vital.key === 'health')?.percent ?? 0
  const effectsKnown = battle.activeEffects !== undefined || battle.effectIds !== undefined
  const has = (ids: string[]) =>
    battle.activeEffects !== undefined
      ? hasActiveBattleEffect(battle.activeEffects, ids)
      : battle.effectIds?.some((id) => ids.includes(id))
  if (!effectsKnown) return
  const regen = actions.find((action) => action.kind === 'regen')
  if (
    settings.maintainRegen &&
    health < 90 &&
    !has(['regen', 'regeneration']) &&
    regen &&
    canSpendMana(state, regen, 0)
  )
    return { action: regen, target: 0, reason: '补充再生，保留治疗魔力' }
  if (
    !settings.maintainBuffs ||
    health <= healAt + 5 ||
    battle.monsters.filter((monster) => !monster.defeated && (monster.healthPercent ?? 0) > 0)
      .length < 2
  )
    return
  for (const [id, ids] of Object.entries(protectiveEffects)) {
    if (
      (id === 'heartseeker' && settings.style !== 'physical') ||
      (id === 'arcanefocus' && settings.style !== 'magic')
    )
      continue
    if (id === 'sparkoflife' || id === 'spiritshield') {
      const spirit = battle.vitals.find((vital) => vital.key === 'spirit')
      if (
        spirit?.percentKnown === false ||
        (spirit?.percent ?? 0) < Math.max(50, settings.spiritReserve + 10)
      )
        continue
    }
    const action = actions.find(
      (candidate) => candidate.kind === 'buff' && battleIdentity(candidate.sourceName || '') === id,
    )
    if (action && !has(ids) && canSpendMana(state, action, 0))
      return { action, target: 0, reason: '补充缺失的保护增益，保留治疗魔力' }
  }
}

/** Follow-up skills require effects on the current target, rather than a queued combo. */
export function decideWeaponSkill(state: CombatTacticsContext): AutoBattleDecision | undefined {
  const { battle, settings, actions } = state
  if (!settings.useWeaponSkills || !battle.weaponStyle) return
  const monsters = battle.monsters.filter(
    (monster) =>
      !monster.defeated &&
      (monster.healthPercent ?? 0) > 0 &&
      monster.activeEffects !== undefined &&
      !hasActiveBattleEffect(monster.activeEffects, [
        'sleep',
        'asleep',
        'sleeping',
        'confuse',
        'confused',
      ]) &&
      (settings.targeting !== 'selected' || monster.id === state.target),
  )
  const candidates: Array<{
    action: HentaiVerseBattleAction
    target: number
    priority: number
    reason: string
  }> = []
  const livingCount = battle.monsters.filter(
    (monster) => !monster.defeated && (monster.healthPercent ?? 0) > 0,
  ).length
  const protectedTarget = battle.monsters.some(
    (monster) =>
      !monster.defeated &&
      hasActiveBattleEffect(monster.activeEffects, [
        'sleep',
        'asleep',
        'sleeping',
        'confuse',
        'confused',
      ]),
  )
  for (const action of actions) {
    const id = battleIdentity(action.sourceName || '')
    if (
      action.kind !== 'weapon' ||
      weaponSkillStyles[id] !== battle.weaponStyle ||
      (battle.overcharge ?? 0) - action.overchargeCost! - (battle.spiritStance ? 10 : 0) <
        settings.overchargeReserve
    )
      continue
    if (
      protectedTarget &&
      ['rendingblow', 'shatterstrike', 'frenziedblows', 'skywardsword'].includes(id)
    )
      continue
    for (const monster of monsters) {
      const has = (ids: string[]) => hasActiveBattleEffect(monster.activeEffects, ids)
      const stunned = has(['stunned', 'stun'])
      const bleeding = has(['bleedingwound', 'bleedingwounds', 'bleeding'])
      const armor = has(['penetratedarmor', 'penetratedarmour'])
      const armorStacks = monster.activeEffects?.find((effect) =>
        ['penetratedarmor', 'penetratedarmour'].includes(effect.id),
      )?.stacks
      const blind = has(['blind', 'blinded'])
      let priority = 0
      let reason = ''
      if (id === 'mercifulblow' && bleeding && monster.healthPercent! < 25) {
        priority = 100
        reason = '目标流血且生命低于斩杀线，使用武器终结技'
      } else if (id === 'vitalstrike' && stunned) {
        priority = 90
        reason = '目标已眩晕，衔接要害打击'
      } else if (id === 'backstab' && blind) {
        priority = 85
        reason = '目标已致盲，衔接背刺'
      } else if (id === 'shatterstrike' && armor && !stunned) {
        priority = 80
        reason = '目标已有破甲，衔接碎裂打击'
      } else if (id === 'shieldbash' && !stunned && monster.healthPercent! > 25) {
        priority = 60
        reason = '盾击控制目标，为单手连招创造条件'
      } else if (
        id === 'rendingblow' &&
        (!armor || (armorStacks !== undefined && armorStacks < 3)) &&
        monster.healthPercent! > 30
      ) {
        priority = 65
        reason = '施加破甲，为双手连招创造条件'
      } else if (id === 'irisstrike' && !blind && monster.healthPercent! > 30) {
        priority = 60
        reason = '施加致盲，为双持连招创造条件'
      } else if (id === 'skywardsword' && (!armor || !bleeding) && monster.healthPercent! > 40) {
        priority = 65
        reason = '使用二天技能施加破甲与流血'
      } else if (id === 'concussivestrike' && !stunned && monster.healthPercent! > 25) {
        priority = 60
        reason = '使用法杖技能控制目标并争取回蓝机会'
      } else if (id === 'greatcleave' && monster.healthPercent! > 50) {
        priority = 40
        reason = '过载有余量，使用强力武器攻击'
      } else if (id === 'frenziedblows' && livingCount > 1) {
        priority = 70
        reason = '存在多个目标，使用双持群体攻击'
      }
      if (priority) candidates.push({ action, target: monster.id, priority, reason })
    }
  }
  candidates.sort(
    (left, right) =>
      right.priority - left.priority ||
      Number(right.target === state.target) - Number(left.target === state.target),
  )
  return candidates[0]
}

export function decideDebuff(state: CombatTacticsContext): AutoBattleDecision | undefined {
  const { battle, settings, actions, context } = state
  if (settings.debuffs === 'off') return
  const living = battle.monsters.filter(
    (monster) => !monster.defeated && (monster.healthPercent ?? 0) > 0,
  )
  const monsters = living.filter(
    (monster) =>
      monster.activeEffects !== undefined &&
      (monster.healthPercent ?? 0) >= 40 &&
      !hasActiveBattleEffect(monster.activeEffects, [
        'stunned',
        'sleep',
        'asleep',
        'sleeping',
        'confuse',
        'confused',
      ]),
  )
  monsters.sort(
    (left, right) => Number(right.id === state.target) - Number(left.id === state.target),
  )
  for (const id of ['weaken', 'silence', 'slow', 'blind', 'imperil']) {
    const action = actions.find(
      (candidate) =>
        candidate.kind === 'debuff' && battleIdentity(candidate.sourceName || '') === id,
    )
    if (!action) continue
    for (const monster of monsters) {
      if (
        hasActiveBattleEffect(monster.activeEffects, debuffEffects[id]!) ||
        context.failedDebuffs?.includes(`${monster.id}:${id}`) ||
        !canSpendMana(state, action, monster.id)
      )
        continue
      const threat = monster.specialAttackObserved || context.specialThreats?.includes(monster.id)
      const damage = context.recentHealthLoss ?? 0
      const shouldCast =
        id === 'weaken'
          ? damage >= 8 || threat
          : id === 'silence'
            ? threat && Math.max(monster.magicPercent ?? 0, monster.spiritPercent ?? 0) >= 50
            : id === 'slow'
              ? damage >= 10 || living.length >= 3
              : id === 'blind'
                ? damage >= 10
                : settings.debuffs === 'balanced' && monster.healthPercent! >= 60
      if (shouldCast)
        return {
          action,
          target: monster.id,
          reason:
            id === 'imperil'
              ? '目标仍有较多生命，施加减防以提高后续输出'
              : id === 'silence'
                ? '目标已有特殊攻击记录，优先施加沉默'
                : '承伤或敌人数较高，施加防御性减益',
        }
    }
  }
}

export function selectOffensiveSpell(
  state: CombatTacticsContext,
): HentaiVerseBattleAction | undefined {
  const { battle, settings, actions } = state
  const living = battle.monsters.filter(
    (monster) => !monster.defeated && (monster.healthPercent ?? 0) > 0,
  )
  // Multi-target spells can wake controlled secondary targets even when aiming elsewhere.
  if (
    living.some((monster) =>
      hasActiveBattleEffect(monster.activeEffects, [
        'sleep',
        'asleep',
        'sleeping',
        'confuse',
        'confused',
      ]),
    )
  )
    return
  const spells = actions.filter(
    (action) =>
      action.kind === 'offense' &&
      (settings.spellSelection === 'adaptive' ||
        `${action.mode}:${action.skill}` === settings.spell) &&
      canSpendMana(state, action, state.target),
  )
  spells.sort((left, right) => {
    const a = offensiveSpells[battleIdentity(left.sourceName || '')]
    const b = offensiveSpells[battleIdentity(right.sourceName || '')]
    const costA = battleManaCost(battle, left, state.target)!
    const costB = battleManaCost(battle, right, state.target)!
    return (
      Math.min(living.length, b?.targets ?? 1) - Math.min(living.length, a?.targets ?? 1) ||
      (costA <= 1 && costB <= 1 ? (b?.tier ?? 0) - (a?.tier ?? 0) : costA - costB) ||
      Number(`${right.mode}:${right.skill}` === settings.spell) -
        Number(`${left.mode}:${left.skill}` === settings.spell)
    )
  })
  return spells[0]
}
