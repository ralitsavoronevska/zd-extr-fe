import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/login',
        name: 'login',
        component: () => import('@/views/pages/auth/Login.vue'),
        meta: { requiresGuest: true, hideNavbar: true }
    },
    {
        path: '/',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/error',
        name: 'error',
        component: () => import('@/views/pages/auth/Error.vue'),
        meta: { hideNavbar: true }
    },
    {
        path: '/access-denied',
        name: 'access-denied',
        component: () => import('@/views/pages/auth/Access.vue'),
        meta: { hideNavbar: true }
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: () => ({ top: 0 })
});

router.beforeEach((to) => {
    const authStore = useAuthStore();

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : {} };
    }

    if (to.meta.requiresGuest && authStore.isAuthenticated) {
        return { name: 'home' };
    }

    // Prefetch ticket data as soon as auth passes — overlaps with component loading
    if (to.meta.requiresAuth && authStore.isAuthenticated) {
        import('@/stores/ticketData').then(({ useTicketDataStore }) => {
            useTicketDataStore().lazyInit();
        });
    }

    return true;
});

export default router;
