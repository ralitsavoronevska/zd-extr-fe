<script setup>
import statsData from '@/data/statsData.json';
const statsList = statsData;
</script>

<template>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3" v-for="stats in statsList" :key="stats.id">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">{{ stats.title }}</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ stats.quantity }}</div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i :class="`pi ${stats.icon} text-xl`"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ stats.details_primary }}</span>
            <span class="text-muted-color ml-2">{{ stats.details_secondary }}</span>
        </div>
    </div>
</template>
