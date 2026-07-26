import type {
  HentaiVerseBattleMode,
  HentaiVerseBattleSnapshot,
} from './model/hentaiVerse'
import { parseEncounterFromGalleryHtml } from './hentaiVerseParser'
import { HentaiVerseBusi } from './hentaiVerseBusi'
import { hentaiVerseState } from './hentaiVerseRuntime'

export { hentaiVerseState } from './hentaiVerseRuntime'

const busi = new HentaiVerseBusi()

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
  hentaiVerseState.battleLoading = true
  hentaiVerseState.error = ''
  try {
    hentaiVerseState.battle = await busi.enterBattle(encounter)
    hentaiVerseState.battleVisible = true
    hentaiVerseState.battleMinimized = false
    hentaiVerseState.encounter = undefined
  } catch (error) {
    hentaiVerseState.error = error instanceof Error ? error.message : '进入 HentaiVerse 战斗失败'
    throw error
  } finally {
    hentaiVerseState.battleLoading = false
  }
}

export async function performHentaiVerseBattleAction(
  mode: HentaiVerseBattleMode,
  target: number,
  skill = 0,
) {
  const current = hentaiVerseState.battle
  if (!current || hentaiVerseState.actionPending || current.completed) return
  hentaiVerseState.actionPending = true
  hentaiVerseState.error = ''
  try {
    hentaiVerseState.battle = await busi.sendBattleAction(current, mode, target, skill)
  } catch (error) {
    hentaiVerseState.error = error instanceof Error ? error.message : '战斗动作状态未知，请恢复战斗确认'
    throw error
  } finally {
    hentaiVerseState.actionPending = false
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
  hentaiVerseState.encounter = undefined
  hentaiVerseState.battle = undefined
  hentaiVerseState.battleVisible = false
  hentaiVerseState.battleMinimized = false
  hentaiVerseState.battleLoading = false
  hentaiVerseState.actionPending = false
  hentaiVerseState.error = ''
}
