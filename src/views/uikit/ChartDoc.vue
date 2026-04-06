<script setup>
import { useLayout } from '@/layout/composables/layout';
import { onMounted, ref, watch, computed } from 'vue';
import { useTopicCharts } from '@/composables/useChartAggregations';

const { layoutConfig, isDarkTheme } = useLayout();

const { barDataTotalNegative, lineDataPercent, hasChartData } = useTopicCharts();

// Fixed chart area height + space for 45° rotated x-axis labels
const CHART_HEIGHT = 500;
// Width grows with topic count so every bar is visible; minimum 1200px
const topicCount = computed(() => barDataTotalNegative.value?.labels?.length ?? 0);
const chartWidth = computed(() => Math.max(1400, topicCount.value * 90));

const barChartOptions = ref(null);
const lineChartOptions = ref(null);

onMounted(() => setChartOptions());
watch([() => layoutConfig.primary, isDarkTheme], setChartOptions);

function setChartOptions() {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color');
    const textSecondary = style.getPropertyValue('--text-color-secondary');
    const surfaceBorder = style.getPropertyValue('--surface-border');

    const sharedScales = {
        x: {
            ticks: { color: textSecondary, maxRotation: 45, minRotation: 45, autoSkip: false },
            grid: { color: surfaceBorder }
        },
        y: {
            ticks: { color: textSecondary },
            grid: { color: surfaceBorder }
        }
    };

    barChartOptions.value = {
        responsive: false,
        indexAxis: 'x',
        plugins: {
            legend: {
                labels: {
                    color: textColor,
                    useBorderRadius: true,
                    borderRadius: 3,
                    boxWidth: 18,
                    boxHeight: 18,
                    font: { size: 14 },
                    generateLabels: (chart) =>
                        chart.data.datasets.map((ds, i) => {
                            const visible = chart.isDatasetVisible(i);
                            const color = ds.borderColor || ds.backgroundColor;
                            return {
                                text: (visible ? '\u2611 ' : '\u2610 ') + ds.label,
                                fillStyle: visible ? color : 'transparent',
                                strokeStyle: color,
                                lineWidth: 2,
                                hidden: !visible,
                                datasetIndex: i
                            };
                        })
                }
            }
        },
        datasets: {
            bar: { barThickness: 32, maxBarThickness: 40 }
        },
        scales: sharedScales
    };

    lineChartOptions.value = {
        responsive: false,
        indexAxis: 'x',
        plugins: {
            legend: { display: false }
        },
        scales: sharedScales
    };
}
</script>

<template>
    <div class="card pt-2 my-8" v-if="hasChartData">
        <h2 class="font-semibold text-xl mb-6">Bar Chart – Topics Distribution</h2>

        <div v-if="barChartOptions" class="grid grid-cols-1 gap-8">
            <!-- Chart 1: Total + Negative Chats -->
            <div>
                <h3 class="font-medium text-center mb-3">Number of Chats</h3>
                <div class="w-full overflow-x-auto flex justify-center">
                    <Chart type="bar" :data="barDataTotalNegative" :options="barChartOptions" :width="chartWidth" :height="CHART_HEIGHT" />
                </div>
            </div>

            <!-- Chart 2: % Negative Chats (line) -->
            <div>
                <h3 class="font-medium text-center mb-3">% Negative Chats per Topic</h3>
                <div class="w-full overflow-x-auto flex justify-center">
                    <Chart type="line" :data="lineDataPercent" :options="lineChartOptions" :width="chartWidth" :height="CHART_HEIGHT" />
                </div>
            </div>
        </div>
    </div>
</template>
