<script setup lang="ts">
import { t } from '@/i18n'

import FeedbackHost from '@/components/primitives/FeedbackHost.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import SiteHeader from '@/components/SiteHeader.vue'
import BrowserAssistantNotice from '@/components/BrowserAssistantNotice.vue'
import { connectionSettings } from '@/core/connector/connectionSettings'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  LoaderCircle as Loading,
  Menu as IconMenu,
  Search,
  UserRound as UserFilled,
  House,
  Moon,
  Sun as Sunny,
  Monitor as MoonNight,
  Settings as Setting,
  Star as StarFilled,
  Zap as Lightning,
  Clock,
} from '@lucide/vue'
import { notify } from '@/components/primitives/feedback'
import type { Component } from 'vue'
import {
  getLayoutScrollElement,
  getLayoutScrollTarget,
  getLayoutScrollTop,
  initializeLayoutScrollMode,
  layoutScrollModeChange,
  scrollLayoutTo,
} from '@/composables/layoutScroll'
import { useFloatingActions } from '@/composables/useFloatingActions'
import { useAuthState } from '@/core/auth/authState'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import { hentaiVerseState } from '@/core/hentaiverse/hentaiVerseRuntime'
import { themeModes as themeModeList } from '@/core/theme/themePalette'
import { initializeThemeSettings, themeSettings } from '@/core/theme/themeSettings'

const EncounterPrompt = defineAsyncComponent(
  () => import('@/components/hentaiverse/EncounterPrompt.vue'),
)
const BattleFloatingPanel = defineAsyncComponent(
  () => import('@/components/hentaiverse/BattleFloatingPanel.vue'),
)

interface FloatingMenuItem {
  key: string
  path?: string
  label: string
  icon: Component
  active?: boolean
  onClick?: () => void
  className?: string
  requiresAuth?: boolean
}

const route = useRoute()
const router = useRouter()
const menuExpanded = ref(false)
const isMobile = ref(false)
const showFloatingButtons = ref(true)
const lastScrollTop = ref(0)
const scrollThreshold = 48
const stopScrollModeSync = initializeLayoutScrollMode()
let scrollTarget: HTMLElement | Window | null = null
const { pageFloatingActions, clearFloatingActions } = useFloatingActions()
const authState = useAuthState()
const cacheSettings = useIndexedDbCacheSettings()
const stopThemeSync = initializeThemeSettings()

const cachedViews = ref<string[]>([
  'HomeView',
  'BookList',
  'BookInfoView',
  'FavoritesView',
  'ToplistDetailView',
])
const themeModeMeta = {
  auto: {
    label: '自动主题',
    icon: MoonNight,
  },
  dark: {
    label: '深色模式',
    icon: Moon,
  },
  light: {
    label: '浅色模式',
    icon: Sunny,
  },
}

const activeMenu = computed(() => route.path)
const activeThemeMode = computed({
  get: () => themeSettings.mode,
  set: (value) => {
    themeSettings.mode = value
  },
})
const visiblePageActions = computed(() => {
  return pageFloatingActions.value
    .filter((item) => item.show !== false && item.placement !== 'menu')
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
})
const menuItems = computed<FloatingMenuItem[]>(() => [
  ...pageFloatingActions.value
    .filter((item) => item.show !== false && item.placement === 'menu')
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item) => ({
      key: item.key,
      label: item.label ?? item.key,
      icon: item.icon,
      active: item.active,
      onClick: item.onClick,
      className: item.className,
    })),
  ...(cacheSettings.enabled && cacheSettings.cacheReadingHistory
    ? [{ key: 'reading-history', path: '/history', label: t('浏览历史'), icon: Clock }]
    : []),
  {
    key: 'favorites',
    path: '/favorites',
    label: t('个人收藏'),
    icon: StarFilled,
    requiresAuth: true,
  },
  {
    key: 'hentaiverse',
    path: '/hentaiverse',
    label: 'HentaiVerse',
    icon: Lightning,
    requiresAuth: true,
  },
  {
    key: 'theme',
    label: t(themeModeMeta[activeThemeMode.value].label),
    icon: themeModeMeta[activeThemeMode.value].icon,
    active: activeThemeMode.value !== 'auto',
    onClick: toggleThemeMode,
  },
  {
    key: 'login',
    path: '/login',
    label: t('账号信息'),
    icon: UserFilled,
  },
  {
    key: 'settings',
    path: '/settings',
    label: t('系统设置'),
    icon: Setting,
  },
])

const showBackButton = computed(() => {
  return route.name !== 'home'
})

const getRouteScrollKey = (routePath: string) => {
  return `layout-scroll:${routePath}`
}

const persistCurrentRouteScroll = (routePath = route.fullPath) => {
  const mainElement = getLayoutScrollElement()
  if (!mainElement) {
    return
  }

  sessionStorage.setItem(getRouteScrollKey(routePath), String(getLayoutScrollTop()))
}

const restoreRouteScroll = async (routePath = route.fullPath) => {
  await nextTick()

  const mainElement = getLayoutScrollElement()
  if (!mainElement) {
    return
  }

  const storedPosition = Number(sessionStorage.getItem(getRouteScrollKey(routePath)) || '0')
  const routePathname = routePath.split('?')[0]
  const shouldRestorePosition =
    routePathname === '/' ||
    routePathname === '/booklist' ||
    routePathname === '/favorites' ||
    routePathname === '/toplists'
  const targetPosition = shouldRestorePosition ? storedPosition : 0
  lastScrollTop.value = targetPosition

  requestAnimationFrame(() => {
    scrollLayoutTo(targetPosition)
    requestAnimationFrame(() => {
      scrollLayoutTo(targetPosition)
    })
  })
}

const checkViewport = () => {
  isMobile.value = window.innerWidth < 768
}

const handleBack = () => {
  if (window.history.state?.back) {
    router.back()
    return
  }

  void router.push('/')
}

const toggleMenu = () => {
  menuExpanded.value = !menuExpanded.value
}

const toggleThemeMode = () => {
  const currentIndex = themeModeList.indexOf(activeThemeMode.value)
  const nextIndex = (currentIndex + 1) % themeModeList.length
  activeThemeMode.value = themeModeList[nextIndex] ?? 'auto'
}

const goMenuItem = (item: (typeof menuItems.value)[number]) => {
  menuExpanded.value = false

  if (item.requiresAuth && !authState.loggedIn) {
    notify.warning(t('请先维护认证信息后再查看个人收藏'))
    if (route.path !== '/login') void router.push('/login')
    return
  }

  if (item.onClick) {
    item.onClick()
    return
  }

  if (item.path && route.path !== item.path) {
    router.push(item.path)
  }
}

const goBookList = () => {
  if (route.path !== '/booklist') {
    router.push('/booklist')
  }
}

const goHome = () => {
  if (route.path !== '/') {
    router.push('/')
  }
}

const handleMainScroll = () => {
  persistCurrentRouteScroll()

  if (!isMobile.value) {
    return
  }

  const scrollTop = getLayoutScrollTop()

  if (scrollTop > lastScrollTop.value && scrollTop > scrollThreshold) {
    showFloatingButtons.value = false
  } else if (scrollTop < lastScrollTop.value || scrollTop <= scrollThreshold) {
    showFloatingButtons.value = true
  }

  lastScrollTop.value = scrollTop
}

const bindLayoutScroll = () => {
  scrollTarget?.removeEventListener('scroll', handleMainScroll)
  scrollTarget = getLayoutScrollTarget()
  scrollTarget?.addEventListener('scroll', handleMainScroll, { passive: true })
}

onMounted(() => {
  bindLayoutScroll()
  window.addEventListener(layoutScrollModeChange, bindLayoutScroll)
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  checkViewport()
  window.addEventListener('resize', checkViewport)
  window.addEventListener('orientationchange', checkViewport)
  void restoreRouteScroll()
})

watch(
  () => route.fullPath,
  async (newRoutePath, oldRoutePath) => {
    if (oldRoutePath) {
      persistCurrentRouteScroll(oldRoutePath)
    }

    clearFloatingActions()
    menuExpanded.value = false
    await restoreRouteScroll(newRoutePath)
  },
)

onUnmounted(() => {
  stopScrollModeSync()
  scrollTarget?.removeEventListener('scroll', handleMainScroll)
  window.removeEventListener(layoutScrollModeChange, bindLayoutScroll)
  stopThemeSync()
  window.removeEventListener('resize', checkViewport)
  window.removeEventListener('orientationchange', checkViewport)
})
</script>

<template>
  <TooltipProvider :delay-duration="350">
    <div
      class="layout-container"
      :class="{ 'is-mobile': isMobile, 'hv-theme': route.path === '/hentaiverse' }"
    >
      <div class="layout-safe-area" aria-hidden="true" />
      <main class="layout-main">
        <SiteHeader v-if="route.path !== '/viewer'" />
        <BrowserAssistantNotice />
        <Suspense>
          <template #default>
            <RouterView v-slot="{ Component, route }">
              <KeepAlive
                :key="`${connectionSettings.mode}:${connectionSettings.site}`"
                :include="cachedViews"
              >
                <component :is="Component" :key="route.path" />
              </KeepAlive>
            </RouterView>
          </template>
          <template #fallback>
            <div class="loading-container">
              <IconFrame class="is-loading" :size="40">
                <Loading />
              </IconFrame>
              <p>{{ t('加载中...') }}</p>
            </div>
          </template>
        </Suspense>
      </main>

      <div class="floating-actions" :class="{ 'is-hidden': !showFloatingButtons }">
        <ActionButton
          v-if="showBackButton"
          class="floating-btn"
          :icon="ArrowLeft"
          size="icon"
          :aria-label="t('返回上一页')"
          @click="handleBack"
        />
        <ActionButton
          class="floating-btn"
          :class="{ 'is-active': activeMenu === '/' }"
          :icon="House"
          size="icon"
          :aria-label="t('首页')"
          @click="goHome"
        />
        <ActionButton
          class="floating-btn"
          :class="{ 'is-active': activeMenu === '/booklist' }"
          :icon="Search"
          size="icon"
          :aria-label="t('搜索画册')"
          @click="goBookList"
        />
        <ActionButton
          v-for="action in visiblePageActions"
          :key="action.key"
          class="floating-btn"
          :class="[{ 'is-active': action.active }, action.className]"
          size="icon"
          :aria-label="t(action.label || action.key)"
          @click="action.onClick"
        >
          <IconFrame>
            <component :is="action.icon" />
          </IconFrame>
        </ActionButton>

        <div class="floating-menu-wrapper">
          <div
            class="floating-menu"
            :class="{ 'is-expanded': menuExpanded }"
            :inert="!menuExpanded"
            @keydown.esc="menuExpanded = false"
          >
            <ActionButton
              v-for="item in menuItems"
              :key="item.key"
              class="floating-btn floating-sub-btn"
              :class="[{ 'is-active': item.active || activeMenu === item.path }, item.className]"
              @click="goMenuItem(item)"
            >
              <IconFrame>
                <component :is="item.icon" />
              </IconFrame>
              <span class="floating-sub-label">{{ t(item.label) }}</span>
            </ActionButton>
          </div>

          <ActionButton
            class="floating-btn floating-menu-toggle"
            :class="{ 'is-active': menuExpanded }"
            :icon="IconMenu"
            size="icon"
            :aria-label="t('更多操作')"
            :aria-expanded="menuExpanded"
            @click="toggleMenu"
          />
        </div>
      </div>
      <EncounterPrompt v-if="hentaiVerseState.encounter" />
      <BattleFloatingPanel v-if="hentaiVerseState.battle" />
    </div>
    <FeedbackHost />
  </TooltipProvider>
</template>
