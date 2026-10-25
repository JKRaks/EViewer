import type { HentaiVerseBattleMode, HentaiVerseBattleSnapshot } from './model/hentaiVerse'
import { parseEncounterFromGalleryHtml } from './hentaiVerseParser'
import { HentaiVerseBusi } from './hentaiVerseBusi'
import { hentaiVerseState } from './hentaiVerseRuntime'
import { canUseAutomaticBattleAction } from './hentaiVerseAutoBattle'
import { watch } from 'vue'
import { authState } from '@/core/auth/authState'
import { currentHentaiVerseSignal, hentaiVerseWorld } from './hentaiVerseWorld'

export { hentaiVerseState } from './hentaiVerseRuntime'

const busi = new HentaiVerseBusi()
let generation = 0
watch(
  () => [
    authState.source,
    authState.site,
    authState.loggedIn,
    authState.memberId,
    hentaiVerseWorld.value,
  ],
  () => clearHentaiVerseState(),
  { flush: 'sync' },
)

export function inspectGalleryHtmlForEncounter(html: string) {
  const encounter = parseEncounterFromGalleryHtml(html)
  if (encounter && encounter.token !== hentaiVerseState.encounter?.token) {
    hentaiVerseState.encounter = encounter
  }
}

export function dismissHentaiVerseEncounter() {
  hentaiVerseState.encounter = undefined
}

export async function enterHentaiVerseBattle(encounter = hentaiVerseState.encounter?.token) {
  if (hentaiVerseState.battleLoading) return
  // Gallery encounters belong to Persistent, regardless of the last maintenance page.
  if (encounter) hentaiVerseWorld.value = 'persistent'
  hentaiVerseState.battleLoading = true
  hentaiVerseState.error = ''
  const signal = currentHentaiVerseSignal()
  const startedGeneration = generation
  try {
    const battle = await busi.enterBattle(encounter)
    if (signal.aborted || startedGeneration !== generation) return
    hentaiVerseState.battle = battle
    hentaiVerseState.battleVisible = true
    hentaiVerseState.battleMinimized = false
    hentaiVerseState.encounter = undefined
  } catch (error) {
    if (signal.aborted || startedGeneration !== generation) return
    hentaiVerseState.error = error instanceof Error ? error.message : '进入 HentaiVerse 战斗失败'
    throw error
  } finally {
    if (startedGeneration === generation) hentaiVerseState.battleLoading = false
  }
}

export async function performHentaiVerseBattleAction(
  mode: HentaiVerseBattleMode,
  target: number,
  skill = 0,
  automatic = false,
) {
  const current = hentaiVerseState.battle
  if (!current || current.completed || current.roundCompleted || current.verificationRequired)
    throw new Error('当前没有可执行的战斗动作')
  if (hentaiVerseState.actionPending) throw new Error('前一战斗动作尚未完成')
  if (automatic) {
    const action = current.actions.find((item) => item.mode === mode && item.skill === skill)
    if (!action || !canUseAutomaticBattleAction(current, action, target))
      throw new Error('自动战斗操作已不可用，已暂停')
    if (
      action.target === 'enemy' &&
      !current.monsters.some(
        (monster) =>
          monster.id === target &&
          !monster.defeated &&
          monster.healthPercent !== undefined &&
          monster.healthPercent > 0,
      )
    )
      throw new Error('自动战斗目标已不可用，已暂停')
  }
  hentaiVerseState.actionPending = true
  const startedGeneration = generation
  hentaiVerseState.error = ''
  try {
    const next = await busi.sendBattleAction(current, mode, target, skill, automatic)
    if (hentaiVerseState.battle === current) {
      hentaiVerseState.battle = next
      if (next.verificationRequired) hentaiVerseState.battleVisible = true
      return hentaiVerseState.battle
    }
  } catch (error) {
    if (hentaiVerseState.battle === current)
      hentaiVerseState.error =
        error instanceof Error ? error.message : '战斗动作状态未知，请恢复战斗确认'
    throw error
  } finally {
    if (startedGeneration === generation) hentaiVerseState.actionPending = false
  }
}

export async function continueHentaiVerseBattleRound() {
  const current = hentaiVerseState.battle
  if (
    !current?.roundCompleted ||
    current.completed ||
    hentaiVerseState.battleLoading ||
    hentaiVerseState.actionPending
  )
    return
  hentaiVerseState.battleLoading = true
  const startedGeneration = generation
  hentaiVerseState.error = ''
  try {
    const next = await busi.continueBattleRound(current)
    if (hentaiVerseState.battle === current) {
      hentaiVerseState.battle = next
      if (next.verificationRequired) hentaiVerseState.battleVisible = true
      return hentaiVerseState.battle
    }
  } catch (error) {
    if (hentaiVerseState.battle === current)
      hentaiVerseState.error = error instanceof Error ? error.message : '继续战斗失败'
    throw error
  } finally {
    if (startedGeneration === generation) hentaiVerseState.battleLoading = false
  }
}

export function hideHentaiVerseBattle() {
  hentaiVerseState.battleVisible = false
}

export function showHentaiVerseBattle() {
  if (hentaiVerseState.battle) hentaiVerseState.battleVisible = true
}

export function showHentaiVerseBattleSnapshot(snapshot: HentaiVerseBattleSnapshot) {
  hentaiVerseState.battle = snapshot
  hentaiVerseState.battleVisible = true
  hentaiVerseState.battleMinimized = false
  hentaiVerseState.error = ''
}

export function clearHentaiVerseState() {
  generation++
  hentaiVerseState.encounter = undefined
  hentaiVerseState.battle = undefined
  hentaiVerseState.battleVisible = false
  hentaiVerseState.battleMinimized = false
  hentaiVerseState.battleLoading = false
  hentaiVerseState.actionPending = false
  hentaiVerseState.error = ''
}
