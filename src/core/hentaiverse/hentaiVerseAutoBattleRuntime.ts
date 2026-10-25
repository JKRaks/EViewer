import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import {
  decideAutoBattleAction,
  type AutoBattleContext,
  type AutoBattleSettings,
} from './hentaiVerseAutoBattle'
import type { HentaiVerseBattleAction, HentaiVerseBattleSnapshot } from './model/hentaiVerse'
import { battleIdentity, debuffEffects, hasActiveBattleEffect } from './hentaiVerseBattleSkills'
import {
  continueHentaiVerseBattleRound,
  hentaiVerseState,
  performHentaiVerseBattleAction,
} from './hentaiVerseStore'

type AutoBattlePhase =
  | 'idle'
  | 'waiting'
  | 'submitting'
  | 'round-waiting'
  | 'pausing'
  | 'paused'
  | 'completed'

/** One executor per mounted battle panel. The store remains the single action gate. */
export function useHentaiVerseAutoBattle(
  settings: Ref<AutoBattleSettings>,
  selectedTarget: () => number | undefined,
  onError: (error: unknown) => void,
) {
  const autoRunning = ref(false)
  const autoPhase = ref<AutoBattlePhase>('idle')
  const autoCountdown = ref(0)
  const autoReason = ref('')
  const autoAction = ref('')
  const autoTarget = ref<number>()
  const roundWaiting = ref(false)
  const delaySeconds = ref(3)
  const pendingAction = ref('')
  const context: AutoBattleContext = {}
  const recentLosses: number[] = []
  let runId = 0
  let cancelDelay: (() => void) | undefined
  const busy = () => hentaiVerseState.actionPending || hentaiVerseState.battleLoading

  function pauseAutoBattle(reason = '自动战斗已暂停') {
    runId++
    cancelDelay?.()
    autoRunning.value = false
    autoCountdown.value = 0
    roundWaiting.value = false
    autoReason.value = reason
    if (!busy()) {
      autoAction.value = ''
      autoTarget.value = undefined
    }
    autoPhase.value = hentaiVerseState.battle?.completed
      ? 'completed'
      : busy()
        ? 'pausing'
        : 'paused'
  }

  function waitForStep(id: number, seconds: number) {
    delaySeconds.value = seconds
    autoCountdown.value = seconds
    return new Promise<boolean>((resolve) => {
      const deadline = Date.now() + seconds * 1000
      const finish = (continueRun: boolean) => {
        window.clearInterval(timer)
        if (cancelDelay === cancel) cancelDelay = undefined
        resolve(continueRun)
      }
      const cancel = () => finish(false)
      const timer = window.setInterval(() => {
        if (id !== runId || document.hidden) return finish(false)
        autoCountdown.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        if (!autoCountdown.value) finish(true)
      }, 200)
      cancelDelay = cancel
    })
  }

  async function executeAction(
    before: HentaiVerseBattleSnapshot,
    action: HentaiVerseBattleAction,
    target: number,
    id: number,
  ) {
    autoPhase.value = 'submitting'
    pendingAction.value = action.mode + ':' + action.skill
    try {
      const after = await performHentaiVerseBattleAction(action.mode, target, action.skill, true)
      if (id !== runId) return
      if (!after || after !== hentaiVerseState.battle) {
        pauseAutoBattle('战斗状态已更新，自动战斗已暂停')
        return
      }
      const healthBefore = before.vitals.find((vital) => vital.key === 'health')
      const healthAfter = after.vitals.find((vital) => vital.key === 'health')
      if (
        healthBefore?.percentKnown !== false &&
        healthAfter?.percentKnown !== false &&
        Number.isFinite(healthBefore?.percent) &&
        Number.isFinite(healthAfter?.percent)
      ) {
        recentLosses.push(Math.max(0, healthBefore!.percent - healthAfter!.percent))
        if (recentLosses.length > 3) recentLosses.shift()
        context.recentHealthLoss = Math.max(...recentLosses)
      }
      context.consecutiveDefends =
        action.mode === 'defend' ? (context.consecutiveDefends ?? 0) + 1 : 0
      const threats = new Set(context.specialThreats)
      after.monsters.forEach((monster) => {
        if (monster.specialAttackObserved) threats.add(monster.id)
      })
      context.specialThreats = Array.from(threats)
      if (action.kind === 'debuff') {
        const id = battleIdentity(action.sourceName || '')
        const monster = after.monsters.find((item) => item.id === target)
        if (
          monster &&
          !monster.defeated &&
          !hasActiveBattleEffect(monster.activeEffects, debuffEffects[id] || [])
        )
          context.failedDebuffs = [...(context.failedDebuffs || []), `${target}:${id}`]
      }
    } finally {
      pendingAction.value = ''
    }
  }

  async function run(singleStep: boolean) {
    const initial = hentaiVerseState.battle
    if (
      !initial ||
      autoRunning.value ||
      busy() ||
      hentaiVerseState.error ||
      initial.completed ||
      initial.verificationRequired ||
      document.hidden
    )
      return
    const id = ++runId
    autoRunning.value = true
    try {
      while (id === runId) {
        const current = hentaiVerseState.battle
        if (
          !current ||
          current.completed ||
          current.verificationRequired ||
          document.hidden ||
          busy()
        )
          return
        if (current.roundCompleted) {
          autoAction.value = ''
          autoTarget.value = undefined
          if (singleStep || !settings.value.continueRounds) {
            autoReason.value = '本轮已结束，等待手动继续'
            return
          }
          autoPhase.value = 'round-waiting'
          roundWaiting.value = true
          autoReason.value = '等待进入下一轮'
          if (!(await waitForStep(id, settings.value.roundDelay)) || id !== runId) return
          roundWaiting.value = false
          autoPhase.value = 'submitting'
          const nextRound = await continueHentaiVerseBattleRound()
          if (id !== runId) return
          if (!nextRound || nextRound !== hentaiVerseState.battle) {
            pauseAutoBattle('战斗状态已更新，自动战斗已暂停')
            return
          }
          if (hentaiVerseState.battle?.roundCompleted && !hentaiVerseState.battle.completed)
            throw new Error('未能确认下一轮，请恢复战斗状态')
          continue
        }
        const decision = decideAutoBattleAction(current, settings.value, selectedTarget(), context)
        autoReason.value = decision.reason
        autoAction.value = decision.action?.label || ''
        autoTarget.value = decision.action?.target === 'enemy' ? decision.target : undefined
        if (!decision.action) return
        if (!singleStep) {
          autoPhase.value = 'waiting'
          if (!(await waitForStep(id, settings.value.actionDelay)) || id !== runId) return
        }
        const latest = hentaiVerseState.battle
        if (!latest || busy() || hentaiVerseState.error || id !== runId) return
        const next = decideAutoBattleAction(latest, settings.value, selectedTarget(), context)
        autoReason.value = next.reason
        autoAction.value = next.action?.label || ''
        autoTarget.value = next.action?.target === 'enemy' ? next.target : undefined
        if (!next.action || next.target === undefined) return
        await executeAction(latest, next.action, next.target, id)
        if (singleStep) return
      }
    } catch (error) {
      if (id === runId) {
        autoReason.value = '战斗状态待确认，请从服务器恢复'
        onError(error)
      }
    } finally {
      if (id === runId) {
        autoRunning.value = false
        autoCountdown.value = 0
        roundWaiting.value = false
        autoPhase.value = hentaiVerseState.battle?.completed ? 'completed' : 'paused'
      }
    }
  }

  function startAutoBattle() {
    return run(false)
  }
  function stepAutoBattle() {
    return run(true)
  }

  async function continueRound(automatic = false) {
    if (busy() || hentaiVerseState.error) return
    pauseAutoBattle()
    const id = runId
    autoPhase.value = 'submitting'
    try {
      const nextRound = await continueHentaiVerseBattleRound()
      if (
        automatic &&
        id === runId &&
        nextRound &&
        nextRound === hentaiVerseState.battle &&
        !document.hidden
      ) {
        if (hentaiVerseState.battle.roundCompleted && !hentaiVerseState.battle.completed)
          throw new Error('未能确认下一轮，请恢复战斗状态')
        await startAutoBattle()
      }
    } catch (error) {
      if (id === runId) onError(error)
    } finally {
      if (id === runId && !autoRunning.value) autoPhase.value = 'paused'
    }
  }

  watch(
    [() => hentaiVerseState.battle, () => hentaiVerseState.error],
    ([current, error], [previous]) => {
      if (!current || !previous || previous.roundCompleted) {
        recentLosses.length = 0
        context.recentHealthLoss = 0
        context.consecutiveDefends = 0
        context.failedDebuffs = []
        context.specialThreats = []
      }
      if (!current) pauseAutoBattle()
      else if (current.verificationRequired) pauseAutoBattle('源站需要手动验证，自动战斗已暂停')
      else if (error) pauseAutoBattle('战斗状态待确认，请从服务器恢复')
      else if (current.completed) pauseAutoBattle('本次战斗已结束')
      else if (current.roundCompleted && !settings.value.continueRounds)
        pauseAutoBattle('本轮已结束，等待手动继续')
      else if (current !== previous && autoRunning.value && autoPhase.value !== 'submitting')
        pauseAutoBattle('战斗状态已更新，自动战斗已暂停')
    },
    { flush: 'sync' },
  )
  watch(settings, () => pauseAutoBattle(), { deep: true, flush: 'sync' })
  watch(
    () => busy(),
    (pending) => {
      if (!pending && autoPhase.value === 'pausing') {
        autoPhase.value = 'paused'
        autoAction.value = ''
        autoTarget.value = undefined
      }
    },
  )
  const handleVisibility = () => {
    if (document.hidden) pauseAutoBattle('页面已隐藏，自动战斗已暂停')
  }
  onMounted(() => document.addEventListener('visibilitychange', handleVisibility))
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibility)
    pauseAutoBattle()
  })

  return {
    autoRunning,
    autoPhase,
    autoCountdown,
    autoReason,
    autoAction,
    autoTarget,
    roundWaiting,
    delaySeconds,
    pendingAction,
    startAutoBattle,
    stepAutoBattle,
    pauseAutoBattle,
    continueRound,
  }
}
