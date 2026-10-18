import 'reflect-metadata'
import './assets/main.css'

import { createApp } from 'vue'

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
void router.isReady().then(scheduleInterfaceFonts)
