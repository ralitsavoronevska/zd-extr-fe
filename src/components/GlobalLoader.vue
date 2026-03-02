<script setup>
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';

const authStore = useAuthStore();
const { isLoading } = storeToRefs(authStore);
</script>

<template>
    <div v-if="isLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm transition-opacity duration-300">
        <div class="flex flex-col items-center gap-4">
            <i class="pi pi-spin pi-spinner text-5xl text-primary"></i>
            <span class="text-lg font-medium text-white">Loading authentication...</span>
        </div>
    </div>
</template>
