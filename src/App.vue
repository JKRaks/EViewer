<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
} from '@element-plus/icons-vue'
import { useFloatingActions } from '@/composables/useFloatingActions'
import { useGlobalState } from './core/common/globalStore'

const route = useRoute()
const router = useRouter()
const menuExpanded = ref(false)
const isMobile = ref(false)
const showFloatingButtons = ref(true)
const lastScrollTop = ref(0)
const scrollThreshold = 48
const { pageFloatingActions, clearFloatingActions } = useFloatingActions()
const globalState = useGlobalState()
const themeModeList = ['auto', 'dark', 'light'] as const
let systemThemeMedia: MediaQueryList | null = null

const cachedViews = ref<string[]>(['HomeView', 'BookList', 'BookInfoView'])
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
const menuItems = computed(() => [
  {
    key: 'settings',
    path: '/settings',
    label: '系统设置',
    icon: Setting,
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
])
const visiblePageActions = computed(() => {
  return pageFloatingActions.value
    .filter((item) => item.show !== false)
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
})

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
  const targetPosition = routePath === '/booklist' ? storedPosition : 0

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
            :class="{ 'is-active': item.active || activeMenu === item.path }"
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
  </el-container>
</template>
