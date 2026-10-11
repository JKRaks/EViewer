<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Loading,
  Menu as IconMenu,
  Search,
  UserFilled,
  House,
  Moon,
  Sunny,
  MoonNight,
  Setting,
  StarFilled,
  Lightning,
  Clock,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import type { Component } from 'vue'
import { useFloatingActions } from '@/composables/useFloatingActions'
import { useAuthState } from '@/core/auth/authState'
import { useIndexedDbCacheSettings } from '@/core/cache/cacheSettings'
import { hentaiVerseState } from '@/core/hentaiverse/hentaiVerseRuntime'
import { useGlobalState } from './core/common/globalStore'

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
const { pageFloatingActions, clearFloatingActions } = useFloatingActions()
const globalState = useGlobalState()
const authState = useAuthState()
const cacheSettings = useIndexedDbCacheSettings()
const themeModeList = ['auto', 'dark', 'light'] as const
let systemThemeMedia: MediaQueryList | null = null

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
const activeThemeMode = computed(() => {
  return themeModeList.includes(globalState.theme as (typeof themeModeList)[number])
    ? (globalState.theme as (typeof themeModeList)[number])
    : 'auto'
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
    ? [{ key: 'reading-history', path: '/history', label: '浏览历史', icon: Clock }]
    : []),
  {
    key: 'favorites',
    path: '/favorites',
    label: '个人收藏',
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
    label: themeModeMeta[activeThemeMode.value].label,
    icon: themeModeMeta[activeThemeMode.value].icon,
    active: activeThemeMode.value !== 'auto',
    onClick: toggleThemeMode,
  },
  {
    key: 'login',
    path: '/login',
    label: '账号信息',
    icon: UserFilled,
  },
  {
    key: 'settings',
    path: '/settings',
    label: '系统设置',
    icon: Setting,
  },
])

const showBackButton = computed(() => {
  return route.name !== 'home'
})

const getLayoutMainElement = () => {
  return document.querySelector('.layout-main') as HTMLElement | null
}

const getRouteScrollKey = (routePath: string) => {
  return `layout-scroll:${routePath}`
}

const persistCurrentRouteScroll = (routePath = route.fullPath) => {
  const mainElement = getLayoutMainElement()
  if (!mainElement) {
    return
  }

  sessionStorage.setItem(getRouteScrollKey(routePath), String(mainElement.scrollTop))
}

const restoreRouteScroll = async (routePath = route.fullPath) => {
  await nextTick()

  const mainElement = getLayoutMainElement()
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
    mainElement.scrollTo({ top: targetPosition, behavior: 'auto' })
    requestAnimationFrame(() => {
      const secondMainElement = getLayoutMainElement()
      secondMainElement?.scrollTo({ top: targetPosition, behavior: 'auto' })
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

const applyThemeMode = () => {
  const isDark =
    activeThemeMode.value === 'dark' ||
    (activeThemeMode.value === 'auto' && systemThemeMedia?.matches === true)

  document.documentElement.classList.toggle('dark', isDark)
}

const handleSystemThemeChange = () => {
  if (activeThemeMode.value === 'auto') {
    applyThemeMode()
  }
}

const toggleThemeMode = () => {
  const currentIndex = themeModeList.indexOf(activeThemeMode.value)
  const nextIndex = (currentIndex + 1) % themeModeList.length
  globalState.theme = themeModeList[nextIndex] ?? 'auto'
}

const goMenuItem = (item: (typeof menuItems.value)[number]) => {
  menuExpanded.value = false

  if (item.requiresAuth && !authState.loggedIn) {
    ElMessage.warning('请先维护认证信息后再查看个人收藏')
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

const handleMainScroll = (event: Event) => {
  persistCurrentRouteScroll()

  if (!isMobile.value) {
    return
  }

  const target = event.target as HTMLElement
  const scrollTop = target.scrollTop

  if (scrollTop > lastScrollTop.value && scrollTop > scrollThreshold) {
    showFloatingButtons.value = false
  } else if (scrollTop < lastScrollTop.value || scrollTop <= scrollThreshold) {
    showFloatingButtons.value = true
  }

  lastScrollTop.value = scrollTop
}

onMounted(() => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeMedia.addEventListener('change', handleSystemThemeChange)
  applyThemeMode()
  checkViewport()
  window.addEventListener('resize', checkViewport)
  window.addEventListener('orientationchange', checkViewport)
  void restoreRouteScroll()
})

watch(activeThemeMode, applyThemeMode)

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
  systemThemeMedia?.removeEventListener('change', handleSystemThemeChange)
  window.removeEventListener('resize', checkViewport)
  window.removeEventListener('orientationchange', checkViewport)
})
</script>

<template>
  <el-config-provider size="small" :z-index="3000">
    <el-container class="layout-container" :class="{ 'is-mobile': isMobile }">
      <el-main class="layout-main" @scroll="handleMainScroll">
        <Suspense>
          <template #default>
            <RouterView v-slot="{ Component, route }">
              <KeepAlive :include="cachedViews">
                <component :is="Component" :key="route.path" />
              </KeepAlive>
            </RouterView>
          </template>
          <template #fallback>
            <div class="loading-container">
              <el-icon class="is-loading" :size="40">
                <Loading />
              </el-icon>
              <p>加载中...</p>
            </div>
          </template>
        </Suspense>
      </el-main>

      <div class="floating-actions" :class="{ 'is-hidden': !showFloatingButtons }">
        <el-button
          v-if="showBackButton"
          class="floating-btn"
          :icon="ArrowLeft"
          circle
          @click="handleBack"
        />
        <el-button
          class="floating-btn"
          :class="{ 'is-active': activeMenu === '/' }"
          :icon="House"
          circle
          @click="goHome"
        />
        <el-button
          class="floating-btn"
          :class="{ 'is-active': activeMenu === '/booklist' }"
          :icon="Search"
          circle
          @click="goBookList"
        />
        <el-button
          v-for="action in visiblePageActions"
          :key="action.key"
          class="floating-btn"
          :class="[{ 'is-active': action.active }, action.className]"
          circle
          @click="action.onClick"
        >
          <el-icon>
            <component :is="action.icon" />
          </el-icon>
        </el-button>

        <div class="floating-menu-wrapper">
          <div class="floating-menu" :class="{ 'is-expanded': menuExpanded }">
            <el-button
              v-for="item in menuItems"
              :key="item.key"
              class="floating-btn floating-sub-btn"
              :class="[{ 'is-active': item.active || activeMenu === item.path }, item.className]"
              @click="goMenuItem(item)"
            >
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <span class="floating-sub-label">{{ item.label }}</span>
            </el-button>
          </div>

          <el-button
            class="floating-btn floating-menu-toggle"
            :class="{ 'is-active': menuExpanded }"
            :icon="IconMenu"
            circle
            @click="toggleMenu"
          />
        </div>
      </div>
      <EncounterPrompt v-if="hentaiVerseState.encounter" />
      <BattleFloatingPanel v-if="hentaiVerseState.battle" />
    </el-container>
  </el-config-provider>
</template>
