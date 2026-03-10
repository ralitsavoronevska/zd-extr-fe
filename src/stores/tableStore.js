import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { NEGATIVE_SENTIMENTS } from '@/config/enums';

export const useTableStore = defineStore('table', () => {
    const filteredTickets = ref([]);

    function setFilteredTickets(rows) {
        filteredTickets.value = rows || [];
    }

    // ────────────────────────────────────────────────
    // Aggregations for charts (memoized by Vue computed)
    // ────────────────────────────────────────────────
    const topicStats = computed(() => {
        const stats = {};

        filteredTickets.value.forEach((c) => {
            const topic = c.topic?.trim() || 'Unknown';
            if (!stats[topic]) {
                stats[topic] = {
                    total: 0,
                    negative: 0
                };
            }
            stats[topic].total++;

            const isNegative = NEGATIVE_SENTIMENTS.includes(c.sentiment?.toLowerCase());
            if (isNegative) {
                stats[topic].negative++;
            }
        });

        return Object.entries(stats)
            .map(([topic, counts]) => ({
                topic,
                total: counts.total,
                negative: counts.negative,
                percentNegative: counts.total > 0 ? (counts.negative / counts.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);
    });

    const chartLabels = computed(() => topicStats.value.map((s) => s.topic));
    const totalChatsData = computed(() => topicStats.value.map((s) => s.total));
    const negativeChatsData = computed(() => topicStats.value.map((s) => s.negative));
    const percentNegativeData = computed(() => topicStats.value.map((s) => s.percentNegative.toFixed(1)));

    return {
        filteredTickets,
        setFilteredTickets,
        topicStats,
        chartLabels,
        totalChatsData,
        negativeChatsData,
        percentNegativeData
    };
});
