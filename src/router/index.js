import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory } from 'vue-router';
import { logger } from '@/utils/logger';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

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

router.beforeEach((to, from) => {
    const authStore = useAuthStore();

    // Check authentication requirement
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : {} };
    }

    // Check guest requirement (redirect authenticated users away from login)
    if (to.meta.requiresGuest && authStore.isAuthenticated) {
        return { name: 'home' };
    }

    // Check role requirement (Firebase mode only)
    if (USE_FIREBASE && to.meta.requiredRole && authStore.isAuthenticated) {
        if (!authStore.hasRole(to.meta.requiredRole)) {
            logger.warn(`User ${authStore.user?.email} lacks required role '${to.meta.requiredRole}' for route '${to.path}'`);
            return { name: 'access-denied' };
        }
    }

    // No prefetch here. `useTicketTableData.onMounted` is the single owner of
    // the initial `lazyInit(filterParams)` call, threading the UI's filter
    // snapshot in. A guard-side prefetch (with no access to filter state)
    // would have to pass defaults — and because `lazyInit` caches its first
    // call via `initPromise`, those defaults would silently win over the
    // component's explicit params. Keeping a single entry point removes the
    // coupling. Cold-load cost is ~100 ms of lost overlap.
    return true;
});

export default router;
