<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Menu as IconMenu, Search, ArrowLeft, Loading } from '@element-plus/icons-vue'
import { useFloatingActions } from '@/composables/useFloatingActions'

const route = useRoute()
const router = useRouter()
const drawer = ref(false)
const isMobile = ref(false)
const showFloatingButtons = ref(true)
const lastScrollTop = ref(0)
const scrollThreshold = 48
const { pageFloatingActions, clearFloatingActions } = useFloatingActions()

// 需要缓存的页面路由名称列表
const cachedViews = ref<string[]>(['BookList'])

// 菜单项配置
const menuItems = [{ path: '/booklist', label: '探花郎', icon: Search }]

// 当前激活的菜单
const activeMenu = computed(() => route.path)
const visiblePageActions = computed(() => {
  return pageFloatingActions.value
    .filter((item) => item.show !== false)
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
})

// 是否显示返回按钮
const showBackButton = computed(() => {
  return window.history.length > 1
})

const checkViewport = () => {
  isMobile.value = window.innerWidth < 768
}

// 处理菜单选择
const handleSelect = () => {
  drawer.value = false
}

// 处理返回按钮点击
const handleBack = () => {
  router.back()
}

const goBookList = () => {
  if (route.path !== '/booklist') {
    router.push('/booklist')
  }
}

// 处理主内容区滚动
const handleMainScroll = (event: Event) => {
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
  checkViewport()
  window.addEventListener('resize', checkViewport)
  window.addEventListener('orientationchange', checkViewport)
})

watch(
  () => route.fullPath,
  () => {
    clearFloatingActions()
  },
)

onUnmounted(() => {
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
      <el-button class="floating-btn" :icon="IconMenu" circle @click="drawer = true" />
    </div>

    <el-drawer v-model="drawer" title="菜单" direction="rtl" size="280px" :with-header="true">
      <el-menu :default-active="activeMenu" class="drawer-menu" router @select="handleSelect">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </el-container>
</template>
