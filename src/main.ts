import 'reflect-metadata'
import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { busy, intersectMore } from './directives/interface'
import { finishAppLaunch } from './lib/appLaunch'
import { loadInterfaceFonts } from './lib/interfaceFonts'

window.__eviewerLaunch?.phase('interface')

const app = createApp(App)

app.use(router)
app.use(i18n)
app.directive('busy', busy)
app.directive('intersect-more', intersectMore)

app.mount('#app')

// Keep the inline wordmark independent, while fonts and route content prepare together.
void loadInterfaceFonts().catch((error) => {
  console.warn('界面字体加载失败，继续使用系统字体:', error)
})

void router.isReady().then(finishAppLaunch, () => window.__eviewerLaunch?.fail())
