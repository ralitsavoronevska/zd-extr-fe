import { acceptHMRUpdate, defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/services/authApi';
import { logger } from '@/utils/logger';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
const TOKEN_ENDPOINT = '/api/token/';
const TOKEN_REFRESH_ENDPOINT = '/api/token/refresh/';

export const useAuthStore = defineStore('auth', () => {
    // JWT-mode tokens are intentionally closure-scoped to keep them out of
    // the reactive graph and DevTools snapshots.
    let _access = null;
    let _refresh = null;
    let _username = null;
    const _authVersion = ref(0);

    // Firebase-mode state
    const user = ref(null);
    const role = ref(null);

    const isLoading = ref(false);
    const error = ref(null);

    const isAuthenticated = computed(() => {
        if (USE_FIREBASE) {
            return Boolean(user.value?.uid);
        }
        _authVersion.value; // subscribe
        return _access !== null;
    });

    const username = computed(() => {
        if (USE_FIREBASE) {
            return user.value?.displayName || user.value?.email || null;
        }
        _authVersion.value;
        return _username;
    });

    function setAuthHeader(access) {
        if (access) api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        else delete api.defaults.headers.common['Authorization'];
    }

    function applyTokens(access, refresh, usernameValue) {
        _access = access;
        _refresh = refresh;
        if (usernameValue !== undefined) _username = usernameValue;
        _authVersion.value++;
    }

    function hasRefreshToken() {
        return _refresh !== null;
    }

    async function fetchUserDataFromFirestore(uid, email) {
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('@/firebase');

            const userDocRef = doc(db, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                user.value = {
                    uid,
                    email,
                    displayName: data.displayName || null
                };
                role.value = data.role || null;
                logger.info(`Fetched Firestore user data for uid=${uid}`);
            } else {
                user.value = { uid, email, displayName: null };
                role.value = null;
                logger.warn(`Firestore user doc not found for uid=${uid}`);
            }
        } catch (err) {
            logger.error('Failed to fetch Firestore user doc:', err?.message || err);
            throw err;
        }
    }

    async function loginWithFirebase(email, password) {
        try {
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            const { auth } = await import('@/firebase');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const fbUser = userCredential.user;
            await fetchUserDataFromFirestore(fbUser.uid, fbUser.email);
            return { success: true };
        } catch (err) {
            const msg = err?.code === 'auth/user-not-found'
                ? 'User not found'
                : err?.code === 'auth/wrong-password'
                    ? 'Incorrect password'
                    : err?.code === 'auth/invalid-email'
                        ? 'Invalid email address'
                        : err?.code === 'auth/too-many-requests'
                            ? 'Too many attempts. Try again later.'
                            : err?.message || 'Login failed';
            error.value = msg;
            throw err;
        }
    }

    async function loginWithJWT(usernameInput, password) {
        try {
            const res = await api.post(TOKEN_ENDPOINT, { username: usernameInput, password });
            const data = res?.data;
            if (!data?.access || !data?.refresh) {
                throw new Error('Malformed login response');
            }
            applyTokens(data.access, data.refresh, usernameInput);
            setAuthHeader(data.access);
            return { success: true };
        } catch (err) {
            const data = err.response?.data;
            error.value = data?.detail || data?.non_field_errors?.[0] || err.message || 'Login failed';
            throw err;
        }
    }

    async function login(emailOrUsername, password) {
        error.value = null;
        isLoading.value = true;
        try {
            if (USE_FIREBASE) {
                return await loginWithFirebase(emailOrUsername, password);
            }
            return await loginWithJWT(emailOrUsername, password);
        } finally {
            isLoading.value = false;
        }
    }

    async function refresh() {
        if (USE_FIREBASE) {
            throw new Error('Refresh not supported in Firebase mode');
        }
        if (!_refresh) throw new Error('No refresh token available');
        const res = await api.post(TOKEN_REFRESH_ENDPOINT, { refresh: _refresh });
        const data = res?.data;
        if (!data?.access) {
            throw new Error('Malformed refresh response');
        }
        applyTokens(data.access, data.refresh ?? _refresh);
        setAuthHeader(data.access);
        return data.access;
    }

    async function logout() {
        error.value = null;
        if (USE_FIREBASE) {
            try {
                const { signOut } = await import('firebase/auth');
                const { auth } = await import('@/firebase');
                await signOut(auth);
            } catch (err) {
                logger.warn('Firebase signOut failed:', err?.message || err);
            }
            user.value = null;
            role.value = null;
            return;
        }
        setAuthHeader(null);
        applyTokens(null, null, null);
    }

    function initializeAuth() {
        isLoading.value = false;
    }

    function clearError() {
        error.value = null;
    }

    function hasRole(requiredRole) {
        if (!USE_FIREBASE) return false;
        return role.value === requiredRole;
    }

    return {
        isLoading,
        error,
        user,
        role,
        isAuthenticated,
        username,
        login,
        logout,
        refresh,
        initializeAuth,
        clearError,
        hasRefreshToken,
        hasRole
    };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
