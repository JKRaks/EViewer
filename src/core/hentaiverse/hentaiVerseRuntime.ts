import { reactive } from 'vue'
import type { HentaiVerseBattleSnapshot, HentaiVerseEncounter } from './model/hentaiVerse'

export const hentaiVerseState = reactive({
  encounter: undefined as HentaiVerseEncounter | undefined,
  battle: undefined as HentaiVerseBattleSnapshot | undefined,
  battleVisible: false,
  battleMinimized: false,
  battleLoading: false,
  actionPending: false,
  error: '',
})
