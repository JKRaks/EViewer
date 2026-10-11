export const layoutScrollModeChange = 'layout-scroll-mode-change'

export function usesInternalLayoutScroll() {
  return document.documentElement.classList.contains('app-standalone')
}

export function getLayoutScrollElement(): HTMLElement | null {
  return usesInternalLayoutScroll()
    ? document.querySelector<HTMLElement>('.layout-main')
    : document.scrollingElement as HTMLElement | null
}

export function getLayoutScrollTarget(): HTMLElement | Window | null {
  return usesInternalLayoutScroll() ? getLayoutScrollElement() : window
}

export function getLayoutScrollTop() {
  return getLayoutScrollElement()?.scrollTop ?? 0
}

export function scrollLayoutTo(top: number) {
  if (usesInternalLayoutScroll()) {
    getLayoutScrollElement()?.scrollTo({ top, behavior: 'auto' })
  } else {
    window.scrollTo({ top, behavior: 'auto' })
  }
}

export function getLayoutScrollViewport() {
  const element = getLayoutScrollElement()
  if (usesInternalLayoutScroll() && element) {
    const top = element.getBoundingClientRect().top + element.clientTop
    return { top, bottom: top + element.clientHeight }
  }
  return { top: 0, bottom: window.innerHeight }
}

export function initializeLayoutScrollMode() {
  const displayMode = window.matchMedia('(display-mode: standalone)')
  const appleNavigator = navigator as Navigator & { standalone?: boolean }
  const applyMode = () => {
    document.documentElement.classList.toggle(
      'app-standalone',
      displayMode.matches || appleNavigator.standalone === true,
    )
  }
  const handleChange = () => {
    const position = getLayoutScrollTop()
    applyMode()
    if (usesInternalLayoutScroll()) window.scrollTo({ top: 0, behavior: 'auto' })
    window.dispatchEvent(new Event(layoutScrollModeChange))
    requestAnimationFrame(() => scrollLayoutTo(position))
  }
  applyMode()
  displayMode.addEventListener('change', handleChange)
  return () => displayMode.removeEventListener('change', handleChange)
}
