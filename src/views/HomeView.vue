<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  Calendar,
  Expand,
  Fold,
  Histogram,
  Menu as MenuIcon,
  TrendCharts,
} from '@element-plus/icons-vue'
import { getLayoutScrollTop, scrollLayoutTo } from '@/composables/layoutScroll'
import HomeYesterdayPanel from '@/components/HomeYesterdayPanel.vue'
import HomePopularPanel from '@/components/HomePopularPanel.vue'
import ToplistOverviewPanel from '@/components/ToplistOverviewPanel.vue'

defineOptions({ name: 'HomeView' })

const activePanel = ref('yesterday')
const sidebarCollapsed = ref(false)
const isMobile = ref(false)
const panels = {
  yesterday: HomeYesterdayPanel,
  popular: HomePopularPanel,
  overview: ToplistOverviewPanel,
}
const activePanelComponent = computed(() => panels[activePanel.value as keyof typeof panels])

async function selectPanel(index: string) {
  if (!(index in panels)) return
  if (isMobile.value) sidebarCollapsed.value = true
  if (index === activePanel.value) return

  sessionStorage.setItem(`home-panel-scroll:${activePanel.value}`, String(getLayoutScrollTop()))

  activePanel.value = index
  await nextTick()
  const targetPosition = Number(sessionStorage.getItem(`home-panel-scroll:${index}`) || '0')
  requestAnimationFrame(() => scrollLayoutTo(targetPosition))
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function syncSidebarViewport() {
  const nextMobile = window.innerWidth < 768
  if (nextMobile !== isMobile.value) {
    isMobile.value = nextMobile
    sidebarCollapsed.value = nextMobile
  }
}

onMounted(() => {
  syncSidebarViewport()
  window.addEventListener('resize', syncSidebarViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncSidebarViewport)
})
</script>

<template>
  <div class="home-view">
    <button
      v-if="isMobile && !sidebarCollapsed"
      type="button"
      class="sidebar-scrim"
      aria-label="关闭首页导航"
      @click="sidebarCollapsed = true"
    />

    <div class="home-shell" :class="{ 'is-collapsed': sidebarCollapsed }">
      <aside
        class="home-sidebar"
        :class="{ 'is-mobile': isMobile }"
        :aria-hidden="isMobile && sidebarCollapsed"
        :inert="isMobile && sidebarCollapsed"
      >
        <div class="sidebar-header">
          <span v-show="!sidebarCollapsed" class="sidebar-title">EHViewer</span>
          <el-tooltip :content="sidebarCollapsed ? '展开导航' : '收起导航'" placement="right">
            <el-button
              class="sidebar-toggle"
              :icon="sidebarCollapsed ? Expand : Fold"
              circle
              :aria-label="sidebarCollapsed ? '展开首页导航' : '收起首页导航'"
              :aria-expanded="!sidebarCollapsed"
              @click="toggleSidebar"
            />
          </el-tooltip>
        </div>

        <el-menu
          :default-active="activePanel"
          :collapse="!isMobile && sidebarCollapsed"
          :collapse-transition="false"
          class="home-menu"
          @select="selectPanel"
        >
          <el-menu-item index="yesterday" aria-label="昨日热门">
            <el-icon><Calendar /></el-icon>
            <template #title>昨日热门</template>
          </el-menu-item>
          <el-menu-item index="popular" aria-label="最近流行">
            <el-icon><TrendCharts /></el-icon>
            <template #title>最近流行</template>
          </el-menu-item>
          <el-menu-item index="overview" aria-label="排行总览">
            <el-icon><Histogram /></el-icon>
            <template #title>排行总览</template>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="home-content">
        <KeepAlive>
          <component :is="activePanelComponent">
            <template #navigation>
              <el-button
                v-if="isMobile"
                class="mobile-menu-trigger"
                :icon="MenuIcon"
                circle
                aria-label="打开首页导航"
                @click="toggleSidebar"
              />
            </template>
          </component>
        </KeepAlive>
      </main>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  position: relative;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.home-shell {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  transition: grid-template-columns 0.2s ease;
}

.home-shell.is-collapsed {
  grid-template-columns: 56px minmax(0, 1fr);
}

.home-sidebar {
  position: sticky;
  top: 0;
  z-index: 6;
  width: 100%;
  padding: 8px 0;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 8px 8px;
}

.sidebar-title {
  padding-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar-toggle {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-color: transparent;
  background-color: transparent;
}

.home-menu {
  width: 100%;
  border-right: 0;
  background-color: transparent;
}

.home-menu :deep(.el-menu-item) {
  height: 44px;
  margin: 2px 0;
  padding: 0 14px !important;
  border-radius: 6px;
  color: var(--el-text-color-regular);
  line-height: 44px;
}

.home-menu :deep(.el-menu-item:hover) {
  background-color: var(--el-fill-color-light);
}

.home-menu :deep(.el-menu-item.is-active) {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
  font-weight: 600;
}

.home-menu :deep(.el-menu-item .el-icon) {
  font-size: 17px;
}

.home-shell.is-collapsed .sidebar-header {
  justify-content: center;
  padding-inline: 0;
}

.home-shell.is-collapsed .home-menu :deep(.el-menu-item) {
  justify-content: center;
  width: 44px;
  padding: 0 !important;
}

.home-content {
  min-width: 0;
}

.mobile-menu-trigger,
.sidebar-scrim {
  display: none;
}

@media (max-width: 767px) {
  .home-shell,
  .home-shell.is-collapsed {
    display: block;
  }

  .mobile-menu-trigger {
    display: inline-flex;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-color: var(--el-border-color-lighter);
    background-color: var(--el-bg-color);
  }

  .sidebar-scrim {
    position: fixed;
    inset: 0;
    z-index: 1190;
    display: block;
    padding: 0;
    background-color: var(--el-overlay-color-lighter);
    border: 0;
  }

  .home-sidebar.is-mobile {
    position: fixed;
    top: max(10px, env(safe-area-inset-top));
    left: 10px;
    z-index: 1200;
    width: 180px;
    max-height: calc(100dvh - 20px - env(safe-area-inset-top));
    padding: 8px;
    overflow-y: auto;
    background-color: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    box-shadow: var(--el-box-shadow-light);
    transform: translateX(0);
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }

  .home-shell.is-collapsed .home-sidebar.is-mobile {
    opacity: 0;
    transform: translateX(calc(-100% - 20px));
    pointer-events: none;
  }

  .home-sidebar.is-mobile .sidebar-header {
    padding-inline: 4px;
  }
}
</style>
