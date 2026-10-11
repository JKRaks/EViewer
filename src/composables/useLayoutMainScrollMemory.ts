import { nextTick, ref } from 'vue'

import {
  getLayoutScrollElement,
  getLayoutScrollTarget,
  getLayoutScrollTop,
  layoutScrollModeChange,
  scrollLayoutTo,
} from './layoutScroll'

export function useLayoutMainScrollMemory(storageKey: string) {
  const scrollPosition = ref(0)
  let scrollTarget: HTMLElement | Window | null = null

  const persistScrollPosition = () => {
    const mainElement = getLayoutScrollElement()
    if (!mainElement) {
      return
    }

    scrollPosition.value = getLayoutScrollTop()
    sessionStorage.setItem(storageKey, String(scrollPosition.value))
  }

  const applyScrollTop = (scrollTop: number) => {
    const mainElement = getLayoutScrollElement()
    if (mainElement) {
      scrollLayoutTo(scrollTop)
    }
  }

  const restoreScrollPosition = async () => {
    const storedPosition = Number(sessionStorage.getItem(storageKey) || '0')
    const targetPosition = storedPosition > 0 ? storedPosition : scrollPosition.value

    await nextTick()
    requestAnimationFrame(() => {
      applyScrollTop(targetPosition)
      requestAnimationFrame(() => {
        applyScrollTop(targetPosition)
      })
    })
  }

  const handleScroll = () => {
    persistScrollPosition()
  }

  const bindScrollListener = () => {
    unbindScrollListener()
    scrollTarget = getLayoutScrollTarget()
    scrollTarget?.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener(layoutScrollModeChange, bindScrollListener)
  }

  const unbindScrollListener = () => {
    scrollTarget?.removeEventListener('scroll', handleScroll)
    scrollTarget = null
    window.removeEventListener(layoutScrollModeChange, bindScrollListener)
  }

  return {
    scrollPosition,
    persistScrollPosition,
    restoreScrollPosition,
    applyScrollTop,
    bindScrollListener,
    unbindScrollListener,
  }
}
