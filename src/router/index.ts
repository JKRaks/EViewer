import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
  ],
})

export default router
