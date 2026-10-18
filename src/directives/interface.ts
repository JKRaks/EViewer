import type { Directive } from 'vue'
import { t } from '@/i18n'
import {
  getLayoutScrollElement,
  getLayoutScrollViewport,
  layoutScrollModeChange,
  usesInternalLayoutScroll,
} from '@/composables/layoutScroll'

export const busy: Directive<HTMLElement, boolean> = {
  mounted(element, binding) {
    const indicator = document.createElement('span')
    indicator.className = 'busy-indicator'
    indicator.setAttribute('role', 'status')
    indicator.setAttribute('aria-label', t('加载中'))
    indicator.innerHTML = '<span class="busy-spinner"></span>'
    element.append(indicator)
    element.classList.add('busy-region')
    element.setAttribute('aria-busy', String(!!binding.value))
  },
  updated(element, binding) {
    element.setAttribute('aria-busy', String(!!binding.value))
    element.querySelector('.busy-indicator')?.setAttribute('aria-label', t('加载中'))
  },
}

interface MoreElement extends HTMLElement {
  moreObserver?: IntersectionObserver
  moreCallback?: () => void
  moreSentinel?: HTMLElement
  moreFrame?: number
  moreModeChanged?: () => void
}

function requestMoreWhenVisible(element: MoreElement) {
  cancelAnimationFrame(element.moreFrame ?? 0)
  element.moreFrame = requestAnimationFrame(() => {
    const bounds = element.moreSentinel?.getBoundingClientRect()
    const viewport = getLayoutScrollViewport()
    if (
      bounds &&
      bounds.top <= viewport.bottom + 300 &&
      bounds.bottom >= viewport.top - 300 &&
      element.getAttribute('data-load-disabled') !== 'true'
    )
      element.moreCallback?.()
  })
}

export const intersectMore: Directive<MoreElement, () => void> = {
  mounted(element, binding) {
    const sentinel = document.createElement('span')
    sentinel.className = 'infinite-sentinel'
    element.moreSentinel = sentinel
    element.append(sentinel)
    element.moreCallback = binding.value
    element.moreModeChanged = () => {
      element.moreObserver?.disconnect()
      element.moreObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) requestMoreWhenVisible(element)
        },
        { root: usesInternalLayoutScroll() ? getLayoutScrollElement() : null, rootMargin: '300px' },
      )
      element.moreObserver.observe(sentinel)
      requestMoreWhenVisible(element)
    }
    element.moreModeChanged()
    window.addEventListener(layoutScrollModeChange, element.moreModeChanged)
  },
  updated(element, binding) {
    element.moreCallback = binding.value
    if (element.moreSentinel && element.lastElementChild !== element.moreSentinel)
      element.append(element.moreSentinel)
    requestMoreWhenVisible(element)
  },
  unmounted(element) {
    element.moreObserver?.disconnect()
    cancelAnimationFrame(element.moreFrame ?? 0)
    if (element.moreModeChanged)
      window.removeEventListener(layoutScrollModeChange, element.moreModeChanged)
  },
}
