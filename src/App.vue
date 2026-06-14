<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  Menu as IconMenu,
  Fold,
  Expand,
  HotWater,
  DishDot,
  MoreFilled,
  Search,
  ArrowLeft,
  ToiletPaper,
  Loading,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const drawer = ref(false)
const isCollapse = ref(false)
const isLandscape = ref(true)
const isMobile = ref(false)
const moreMenuVisible = ref(false)
const showNavBars = ref(true)
const lastScrollTop = ref(0)
const scrollThreshold = 50

// 需要缓存的页面路由名称列表
const cachedViews = ref<string[]>(['BookList', 'Popular'])

// 菜单项配置
const menuItems = [
  { path: '/popular', label: '最流行', icon: HotWater },
  { path: '/toplist', label: '必吃榜', icon: DishDot },
  { path: '/booklist', label: '探花郎', icon: Search },
]

// 底部导航最多显示数量
const MAX_BOTTOM_ITEMS = 3

// 底部显示的菜单项
const visibleBottomItems = computed(() => {
  return menuItems.slice(0, MAX_BOTTOM_ITEMS)
})

// 折叠的菜单项
const hiddenBottomItems = computed(() => {
  return menuItems.slice(MAX_BOTTOM_ITEMS)
})

// 是否需要显示"更多"按钮
const hasMoreItems = computed(() => {
  return menuItems.length > MAX_BOTTOM_ITEMS
})

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 检查当前路由是否在隐藏菜单中
const isActiveInHidden = computed(() => {
  return hiddenBottomItems.value.some((item) => item.path === route.path)
})

// 是否显示返回按钮
const showBackButton = computed(() => {
  return window.history.length > 1
})

// 判断是否显示左侧边栏
const showAsidebar = computed(() => {
  if (isLandscape.value && !isMobile.value) return true
  if (!isMobile.value && !isLandscape.value) return true
  return false
})

// 判断是否显示顶部导航
const showTopNav = computed(() => {
  return isMobile.value && !isLandscape.value
})

// 判断是否显示底部导航
const showBottomNav = computed(() => {
  return isMobile.value && !isLandscape.value
})

// 判断是否显示抽屉触发按钮
const showDrawerButton = computed(() => {
  return isMobile.value && isLandscape.value
})

// 检测屏幕方向和尺寸
const checkOrientation = () => {
  const width = window.innerWidth
  const height = window.innerHeight

  isMobile.value = width < 768
  isLandscape.value = width > height
}

// 处理菜单选择
const handleSelect = () => {
  drawer.value = false
}

// 处理更多菜单项点击
const handleMoreItemClick = (path: string) => {
  router.push(path)
  moreMenuVisible.value = false
}

// 处理返回按钮点击
const handleBack = () => {
  router.back()
}

// 处理搜索按钮点击
const handleHistory = () => {
  router.push('/history')
}

// 切换侧边栏折叠状态
const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

// 处理主内容区滚动
const handleMainScroll = (event: Event) => {
  if (!isMobile.value || isLandscape.value) {
    return
  }

  const target = event.target as HTMLElement
  const scrollTop = target.scrollTop

  if (scrollTop > lastScrollTop.value && scrollTop > scrollThreshold) {
    showNavBars.value = false
  } else if (scrollTop < lastScrollTop.value || scrollTop <= scrollThreshold) {
    showNavBars.value = true
  }

  lastScrollTop.value = scrollTop
}

onMounted(() => {
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
})
</script>

<template>
  <el-container
    class="layout-container"
    :class="{ 'is-mobile': isMobile, 'is-landscape': isLandscape && !isMobile }"
  >
    <!-- 桌面端/平板横屏 - 左侧导航 -->
    <el-aside v-if="showAsidebar" class="layout-aside" :width="isCollapse ? '64px' : '200px'">
      <div class="aside-header">
        <div class="logo-wrapper" v-show="!isCollapse">
          <img alt="Vue logo" src="@/assets/logo.svg" class="logo" />
          <span class="title">EViewer</span>
        </div>
        <div class="logo-wrapper-collapsed" v-show="isCollapse">
          <img alt="Vue logo" src="@/assets/logo.svg" class="logo" />
        </div>
      </div>

      <el-menu :default-active="activeMenu" :collapse="isCollapse" class="aside-menu" router>
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>

      <div class="collapse-btn-wrapper">
        <el-button
          class="collapse-btn"
          :icon="isCollapse ? Expand : Fold"
          @click="toggleCollapse"
          text
        />
      </div>
    </el-aside>

    <el-container class="main-container">
      <!-- 移动端竖屏 - 顶部导航 -->
      <el-header
        v-if="showTopNav"
        class="layout-header-mobile"
        :class="{ 'nav-hidden': !showNavBars }"
      >
        <div class="header-content-mobile">
          <el-button
            v-if="showBackButton"
            class="header-btn header-back-btn"
            :icon="ArrowLeft"
            @click="handleBack"
            text
            circle
          />
          <div v-else class="header-placeholder"></div>

          <div class="logo-wrapper">
            <img alt="Vue logo" src="@/assets/logo.svg" class="logo" />
            <span class="title">EViewer</span>
          </div>

          <el-button
            class="header-btn header-history-btn"
            :icon="ToiletPaper"
            @click="handleHistory"
            text
            circle
          />
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="layout-main" @scroll="handleMainScroll">
        <Suspense>
          <template #default>
            <RouterView v-slot="{ Component, route }">
              <!-- 使用 KeepAlive 缓存组件,移除 Transition -->
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

      <!-- 移动端竖屏 - 底部导航 -->
      <el-footer
        v-if="showBottomNav"
        class="layout-footer-mobile"
        :class="{ 'nav-hidden': !showNavBars }"
      >
        <div class="bottom-menu">
          <div
            v-for="item in visibleBottomItems"
            :key="item.path"
            class="bottom-menu-item"
            :class="{ 'is-active': activeMenu === item.path }"
            @click="router.push(item.path)"
          >
            <el-icon :size="24"><component :is="item.icon" /></el-icon>
            <span class="menu-label">{{ item.label }}</span>
          </div>

          <el-popover
            v-if="hasMoreItems"
            v-model:visible="moreMenuVisible"
            placement="top"
            :width="160"
            trigger="click"
          >
            <template #reference>
              <div class="bottom-menu-item" :class="{ 'is-active': isActiveInHidden }">
                <el-icon :size="24"><MoreFilled /></el-icon>
                <span class="menu-label">更多</span>
              </div>
            </template>
            <div class="more-menu-list">
              <div
                v-for="item in hiddenBottomItems"
                :key="item.path"
                class="more-menu-item"
                :class="{ 'is-active': activeMenu === item.path }"
                @click="handleMoreItemClick(item.path)"
              >
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </el-popover>
        </div>
      </el-footer>

      <!-- 移动端横屏 - 抽屉触发按钮 -->
      <div v-if="showDrawerButton" class="mobile-landscape-menu">
        <el-button class="menu-trigger-btn" :icon="IconMenu" @click="drawer = true" circle />
      </div>
    </el-container>

    <!-- 移动端横屏抽屉菜单 -->
    <el-drawer v-model="drawer" title="菜单" direction="ltr" size="60%" :with-header="true">
      <el-menu :default-active="activeMenu" class="drawer-menu" router @select="handleSelect">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </el-container>
</template>

<style lang="css">
.el-aside.layout-aside {
  overflow: hidden;
}
</style>
