import 'reflect-metadata'
import './assets/main.css'

import { createApp, nextTick } from 'vue'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { busy, intersectMore } from './directives/interface'
import { scheduleInterfaceFonts } from './lib/interfaceFonts'

const app = createApp(App)

app.use(router)
app.use(i18n)
app.directive('busy', busy)
app.directive('intersect-more', intersectMore)

app.mount('#app')

async function finishAppLaunch() {
  await nextTick()
  scheduleInterfaceFonts()
  const launch = document.getElementById('app-launch')
  const appRoot = document.getElementById('app')
  if (!launch || !appRoot) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    launch.remove()
    return
  }

  // Finish every stroke before revealing the already-mounted page. Theme/motion changes can
  // cancel CSS animations, in which case the transition can continue without waiting on them.
  await Promise.all(
    launch.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
  )
  const dot = launch.querySelector('.launch-dot')
  const bloom = launch.querySelector<HTMLElement>('.launch-bloom')
  if (!dot || !bloom) {
    launch.remove()
    return
  }

  const dotBounds = dot.getBoundingClientRect()
  const centerX = dotBounds.left + dotBounds.width / 2
  const centerY = dotBounds.top + dotBounds.height / 2
  const dotRadius = dotBounds.width / 2
  const radius =
    Math.ceil(
      Math.hypot(Math.max(centerX, innerWidth - centerX), Math.max(centerY, innerHeight - centerY)),
    ) + 2
  const appBounds = appRoot.getBoundingClientRect()
  const origin = `${centerX - appBounds.left}px ${centerY - appBounds.top}px`
  const timing: KeyframeAnimationOptions = {
    duration: 320,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'both',
  }

  bloom.style.cssText = `left:${centerX}px;top:${centerY}px;width:${dotBounds.width}px;height:${dotBounds.width}px;visibility:visible`
  appRoot.classList.add('is-revealing')
  // A thin accent edge expands from the full stop while the real page opens inside it.
  const reveal = appRoot.animate(
    { clipPath: [`circle(0px at ${origin})`, `circle(${radius}px at ${origin})`] },
    timing,
  )
  const ripple = bloom.animate(
    {
      transform: [
        'translate(-50%, -50%) scale(1)',
        `translate(-50%, -50%) scale(${radius / dotRadius})`,
      ],
    },
    timing,
  )
  await Promise.all([reveal.finished, ripple.finished])
  launch.remove()
  appRoot.classList.remove('is-revealing')
  reveal.cancel()
}

// Enter once the route and the writing are ready; gallery requests and fonts stay independent.
void router.isReady().then(finishAppLaunch, finishAppLaunch)
