import { computed, ref, watch } from 'vue'
import { currentTransportSignal } from '@/core/connector/connectionSettings'

export type HentaiVerseWorld = 'persistent' | 'isekai'

export const hentaiVerseWorld = ref<HentaiVerseWorld>('persistent')
export const hentaiVerseSourceUrl = computed(() =>
  hentaiVerseWorld.value === 'isekai'
    ? 'https://hentaiverse.org/isekai/'
    : 'https://hentaiverse.org/',
)
let controller = new AbortController()
watch(
  hentaiVerseWorld,
  () => {
    controller.abort()
    controller = new AbortController()
  },
  { flush: 'sync' },
)

export function currentHentaiVerseSignal() {
  return AbortSignal.any([currentTransportSignal(), controller.signal])
}
