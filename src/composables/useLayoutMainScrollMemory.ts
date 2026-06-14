import { nextTick, ref } from 'vue'

const getLayoutMainElement = () => {
  return document.querySelector('.layout-main') as HTMLElement | null
}

export function useLayoutMainScrollMemory(storageKey: string) {
  const scrollPosition = ref(0)

  const persistScrollPosition = () => {
    const mainElement = getLayoutMainElement()
    if (!mainElement) {
      return
    }

    scrollPosition.value = mainElement.scrollTop
    sessionStorage.setItem(storageKey, String(scrollPosition.value))
  }

  const applyScrollTop = (scrollTop: number) => {
    const mainElement = getLayoutMainElement()
    if (mainElement) {
      mainElement.scrollTo({ top: scrollTop, behavior: 'auto' })
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
    const mainElement = getLayoutMainElement()
    mainElement?.removeEventListener('scroll', handleScroll)
    mainElement?.addEventListener('scroll', handleScroll, { passive: true })
  }

  const unbindScrollListener = () => {
    const mainElement = getLayoutMainElement()
    mainElement?.removeEventListener('scroll', handleScroll)
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
