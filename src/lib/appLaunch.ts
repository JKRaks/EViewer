import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { loadInterfaceFonts } from './interfaceFonts'

const pending = new Map<Promise<void>, AppLaunchPhase>()
let enterPage: (() => void) | undefined
let enterRequested = false

/** A first-screen task settles on success, empty content or error, exactly once. */
export function useAppLaunchReadiness(busy: () => boolean, phase: AppLaunchPhase = 'content') {
  if (!document.getElementById('app-launch')) return
  let settle!: () => void
  const ready = new Promise<void>((resolve) => {
    settle = resolve
  })
  pending.set(ready, phase)
  let stop: (() => void) | undefined
  let settled = false
  const release = () => {
    settled = true
    stop?.()
    pending.delete(ready)
    const remainingPhase = [...pending.values()].at(-1)
    if (remainingPhase) window.__eviewerLaunch?.phase(remainingPhase)
    settle()
  }
  onMounted(async () => {
    // Let the component's own mounted hooks start their initial requests first.
    await nextTick()
    if (settled) return
    stop = watch(
      busy,
      (loading) => {
        if (loading) window.__eviewerLaunch?.phase(phase)
        else release()
      },
      { immediate: true, flush: 'post' },
    )
    if (settled) stop()
  })
  onBeforeUnmount(release)
}

/** A reading-position dialog must be visible before it can ask for user input. */
export function allowAppLaunchInteraction() {
  enterRequested = true
  enterPage?.()
}

async function waitForFirstScreen(signal: AbortSignal, appRoot: HTMLElement) {
  while (pending.size && !signal.aborted) await Promise.all([...pending.keys()])
  if (signal.aborted) return
  window.__eviewerLaunch?.phase('layout')
  await nextTick()
  await loadInterfaceFonts().catch(() => undefined)
  if (signal.aborted) return
  // Hidden content still needs layout to discover the font subsets used by this screen.
  appRoot.getBoundingClientRect()
  await document.fonts.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  if (signal.aborted) return

  // Only visible images get a small decode budget; the rest of the gallery stays lazy.
  const images = [...document.querySelectorAll<HTMLImageElement>('#app img')].filter((image) => {
    const bounds = image.getBoundingClientRect()
    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.bottom > 0 &&
      bounds.right > 0 &&
      bounds.top < innerHeight &&
      bounds.left < innerWidth &&
      (image.currentSrc !== '' || image.src !== '')
    )
  })
  await new Promise<void>((resolve) => {
    const cleanups: (() => void)[] = []
    const finish = () => {
      clearTimeout(timer)
      cleanups.forEach((cleanup) => cleanup())
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = window.setTimeout(finish, 1200)
    signal.addEventListener('abort', finish, { once: true })
    void Promise.all(
      images.map(
        (image) =>
          new Promise<void>((done) => {
            const failed = () => done()
            const loaded = () => {
              if (image.complete && image.naturalWidth)
                void image
                  .decode()
                  .catch(() => {})
                  .then(done)
              else done()
            }
            if (image.complete) loaded()
            else {
              image.loading = 'eager'
              image.addEventListener('load', loaded, { once: true })
              image.addEventListener('error', failed, { once: true })
              cleanups.push(() => {
                image.removeEventListener('load', loaded)
                image.removeEventListener('error', failed)
              })
            }
          }),
      ),
    ).then(finish)
  })
  if (signal.aborted) return
  // Font metrics and decoded cover ratios can both resize masonry cards. Let Vue and
  // ResizeObserver commit those changes behind the launch screen before the dot expands.
  await nextTick()
  appRoot.getBoundingClientRect()
  await document.fonts.ready
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function revealPage(launch: HTMLElement, appRoot: HTMLElement) {
  await Promise.all(
    [...launch.querySelectorAll('.launch-stroke')].flatMap((stroke) =>
      stroke.getAnimations().map((animation) => animation.finished.catch(() => {})),
    ),
  )
  const dot = launch.querySelector('.launch-dot')
  const bloom = launch.querySelector<HTMLElement>('.launch-bloom')
  appRoot.style.visibility = 'visible'
  if (dot && bloom && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const bounds = dot.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const radius =
      Math.ceil(
        Math.hypot(
          Math.max(centerX, innerWidth - centerX),
          Math.max(centerY, innerHeight - centerY),
        ),
      ) + 2
    const appBounds = appRoot.getBoundingClientRect()
    const origin = `${centerX - appBounds.left}px ${centerY - appBounds.top}px`
    const timing: KeyframeAnimationOptions = {
      duration: 320,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'both',
    }
    bloom.style.cssText = `left:${centerX}px;top:${centerY}px;width:${bounds.width}px;height:${bounds.width}px;visibility:visible`
    appRoot.classList.add('is-revealing')
    const reveal = appRoot.animate(
      { clipPath: [`circle(0px at ${origin})`, `circle(${radius}px at ${origin})`] },
      timing,
    )
    const ripple = bloom.animate(
      {
        transform: [
          'translate(-50%, -50%) scale(1)',
          `translate(-50%, -50%) scale(${radius / (bounds.width / 2)})`,
        ],
      },
      timing,
    )
    await Promise.all(
      [reveal.finished, ripple.finished].map((finished) => finished.catch(() => {})),
    )
    appRoot.classList.remove('is-revealing')
    reveal.cancel()
  }
  window.__eviewerLaunch?.dispose()
  launch.remove()
  appRoot.removeAttribute('aria-hidden')
  appRoot.removeAttribute('inert')
  appRoot.style.removeProperty('visibility')
}

/** Coordinate route CSS, real page tasks and the handwriting without delaying its first paint. */
export async function finishAppLaunch() {
  const launch = document.getElementById('app-launch')
  const appRoot = document.getElementById('app')
  if (!launch || !appRoot) return
  try {
    await Promise.all(
      [...document.querySelectorAll<HTMLLinkElement>('link[data-launch-style]')].map(
        (link) =>
          new Promise<void>((resolve, reject) => {
            if (link.sheet) return resolve()
            if (link.dataset.failed)
              return reject(new Error('Application stylesheet failed to load'))
            link.addEventListener('load', () => resolve(), { once: true })
            link.addEventListener(
              'error',
              () => reject(new Error('Application stylesheet failed to load')),
              { once: true },
            )
          }),
      ),
    )
    await nextTick()
    window.__eviewerLaunch?.usable()
    const controller = new AbortController()
    const skipped = new Promise<void>((resolve) => {
      enterPage = () => {
        controller.abort()
        resolve()
      }
      if (enterRequested) enterPage()
    })
    window.addEventListener('eviewer:launch-skip', allowAppLaunchInteraction)
    await Promise.race([waitForFirstScreen(controller.signal, appRoot), skipped])
    window.removeEventListener('eviewer:launch-skip', allowAppLaunchInteraction)
    enterPage = undefined
    await revealPage(launch, appRoot)
    // A new service worker precaches route chunks only after the first screen is usable.
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      const register = () => {
        void navigator.serviceWorker
          .register(`${import.meta.env.BASE_URL}sw.js`, {
            scope: import.meta.env.BASE_URL,
          })
          .catch((error) => console.warn('离线缓存注册失败:', error))
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 2500 })
      else setTimeout(register, 300)
    }
  } catch {
    window.__eviewerLaunch?.fail()
  }
}
