import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://13.61.14.255',
    withCredentials: true, // Required for HttpOnly cookies
    timeout: 10000
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Auto-refresh on 401 (Django JWT)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                await api.post('/api/token/refresh/', {}, { withCredentials: true });
                return api(originalRequest);
            } catch (refreshError) {
                const authStore = (await import('@/stores/auth')).useAuthStore();
                await authStore.logout();
                window.location.href = `${import.meta.env.BASE_URL}login`;
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
