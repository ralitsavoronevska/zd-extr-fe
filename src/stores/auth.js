import { acceptHMRUpdate, defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/services/authApi';

const LOGIN_ENDPOINT = '/api/login/';
const LOGOUT_ENDPOINT = '/api/logout/';

export const useAuthStore = defineStore('auth', () => {
    // In-memory only by design — the token is lost on page refresh.
    // The server is the source of truth for the session; we only hold the bearer
    // token for the duration of the current tab. No localStorage / sessionStorage /
    // cookie persistence so XSS can't exfiltrate the token.
    const token = ref(null);
    const user = ref(null); // { id, username, is_admin }
    const isLoading = ref(false);
    const error = ref(null);

    const isAuthenticated = computed(() => !!token.value);
    const isAdmin = computed(() => !!user.value?.is_admin);

    function setAuthHeader(value) {
        if (value) api.defaults.headers.common['Authorization'] = value;
        else delete api.defaults.headers.common['Authorization'];
    }

    async function login(username, password) {
        error.value = null;
        isLoading.value = true;
        try {
            const res = await api.post(LOGIN_ENDPOINT, { username, password });
            token.value = res.data.token;
            user.value = res.data.user;
            // Note the "Token" prefix (DRF TokenAuthentication), NOT "Bearer"
            setAuthHeader(`Token ${token.value}`);
            return { success: true };
        } catch (err) {
            const data = err.response?.data;
            error.value = data?.detail || data?.non_field_errors?.[0] || err.message || 'Login failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function logout() {
        // Best-effort server notification — if it fails (network, already-invalid
        // token) we still clear local state so the user ends up signed out.
        try {
            if (token.value) await api.post(LOGOUT_ENDPOINT);
        } catch (err) {
            console.warn('Logout API call failed — clearing local state anyway:', err?.message || err);
        } finally {
            setAuthHeader(null);
            token.value = null;
            user.value = null;
            error.value = null;
        }
    }

    function initializeAuth() {
        // Nothing to restore — token is in-memory only. On every fresh page load
        // the user starts unauthenticated and will be routed to /login by the guard.
        isLoading.value = false;
    }

    // Kept for backward compatibility with existing consumers (`hasRole('admin')`).
    // Django backend only exposes `is_admin`; any non-admin role check resolves
    // to "authenticated" since the API has no other role dimension.
    function hasRole(roleToCheck) {
        if (roleToCheck === 'admin') return isAdmin.value;
        return isAuthenticated.value;
    }

    return {
        token,
        user,
        isLoading,
        error,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        initializeAuth,
        hasRole
    };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
