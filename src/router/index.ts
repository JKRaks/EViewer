import { createRouter, createWebHistory } from 'vue-router'
import { connectionSettings } from '@/core/connector/connectionSettings'
import ConnectionGuideView from '@/views/ConnectionGuideView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/connection-guide',
      name: 'connection-guide',
      component: ConnectionGuideView,
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/booklist',
      name: 'booklist',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/BookListView.vue'),
    },
    {
      path: '/bookinfo',
      name: 'bookinfo',
      component: () => import('@/views/BookInfoView.vue'),
    },
    {
      path: '/viewer',
      name: 'viewerview',
      component: () => import('@/views/ViewerView.vue'),
    },
    {
      path: '/history',
      name: 'reading-history',
      component: () => import('@/views/ReadingHistoryView.vue'),
    },
    {
      path: '/download',
      name: 'download',
      component: () => import('@/views/DownloadView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SystemSettingsView.vue'),
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/views/FavoritesView.vue'),
    },
    {
      path: '/toplists',
      name: 'toplists',
      component: () => import('@/views/ToplistDetailView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/hentaiverse',
      name: 'hentaiverse',
      component: () => import('@/views/HentaiVerseView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.query.site === 'eh' || to.query.site === 'ex') connectionSettings.site = to.query.site
})

export default router
