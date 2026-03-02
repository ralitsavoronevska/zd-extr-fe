<script setup>
import logoDark from '@/assets/logo-dark.svg';
import logoLight from '@/assets/logo-light.svg';
import { useLayout } from '@/layout/composables/layout';
import { computed } from 'vue';

const { isDarkTheme } = useLayout();
const mode = computed(() => (isDarkTheme.value ? logoDark : logoLight));
</script>

<template>
    <img :src="mode" class="logo" width="160" height="32" alt="Logo" />
</template>
