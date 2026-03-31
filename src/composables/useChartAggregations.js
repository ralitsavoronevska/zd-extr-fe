import { useTableStore } from '@/stores/tableStore';
import { computed } from 'vue';

export function useTopicCharts() {
    const store = useTableStore();

    const topStats = computed(() => store.topicStats);

    // Single computed derives all chart arrays in one pass instead of four separate .map() calls
    const chartArrays = computed(() => {
        const top = topStats.value;
        const labels = new Array(top.length);
        const totals = new Array(top.length);
        const negatives = new Array(top.length);
        const percents = new Array(top.length);

        for (let i = 0; i < top.length; i++) {
            const s = top[i];
            labels[i] = s.topic;
            totals[i] = s.total;
            negatives[i] = s.negative;
            percents[i] = s.percentNegative.toFixed(1);
        }

        return { labels, totals, negatives, percents };
    });

    const barDataTotalNegative = computed(() => ({
        labels: chartArrays.value.labels,
        datasets: [
            { label: 'Total Chats', backgroundColor: '#3b82f6', data: chartArrays.value.totals },
            { label: 'Negative Chats', backgroundColor: '#f47214', data: chartArrays.value.negatives }
        ]
    }));

    const barDataNegativeOnly = computed(() => ({
        labels: chartArrays.value.labels,
        datasets: [
            { label: 'Negative Chats', backgroundColor: '#f47214', data: chartArrays.value.negatives }
        ]
    }));

    const lineDataPercent = computed(() => ({
        labels: chartArrays.value.labels,
        datasets: [
            {
                label: '% Negative Chats',
                data: chartArrays.value.percents,
                borderColor: '#f47214',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                tension: 0.4,
                fill: true
            }
        ]
    }));

    const hasChartData = computed(() => chartArrays.value.labels.length > 0);

    return {
        barDataTotalNegative,
        barDataNegativeOnly,
        lineDataPercent,
        hasChartData
    };
}
