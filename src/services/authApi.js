import axios from 'axios';

// Shared axios instance used by every API call (auth + ticket endpoints).
// The dev Vite proxy forwards /api/* to VITE_API_URL or http://13.53.64.132.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '',
    timeout: 10000,
    paramsSerializer: {
        // Serialize arrays as repeated params: topic=X&topic=Y (not topic[]=X)
        indexes: null
    }
});

let _authStore = null;
const getAuthStore = async () => {
    if (!_authStore) {
        const { useAuthStore } = await import('@/stores/auth');
        _authStore = useAuthStore();
    }
    return _authStore;
};

// DRF TokenAuthentication tokens don't expire, so there's no refresh flow.
// A 401 means the token is invalid or the session was revoked server-side —
// clear local auth state and send the user back to /login.
//
// Exceptions: login/logout themselves can legitimately return 401 (bad credentials
// on login, already-revoked token on logout). Triggering logout+redirect from
// those would cause an infinite recursion (logout 401 → logout → logout 401 → …)
// and would also redirect the user away from the login page on wrong credentials.
//
// One-shot flag prevents concurrent 401s (multiple in-flight requests all
// invalidated at once) from triggering multiple logout()s and redirects. The
// flag never resets because we're about to do a full page reload anyway.
let _handling401 = false;

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const url = error.config?.url || '';
        const isAuthRequest = url.endsWith('/api/login/') || url.endsWith('/api/logout/');
        if (error.response?.status === 401 && !isAuthRequest && !_handling401) {
            _handling401 = true;
            const authStore = await getAuthStore();
            if (authStore.isAuthenticated) {
                await authStore.logout();
                window.location.href = `${import.meta.env.BASE_URL}login`;
            }
        }
        return Promise.reject(error);
    }
);

export default api;
