<script setup>
import { useArrayMultiSelects } from '@/composables/useArrayMultiSelects';
import { computed } from 'vue';

const { fullProcessedTickets } = useArrayMultiSelects();

const tickets = computed(() => fullProcessedTickets.value);

// ── Row 1 ──────────────────────────────────────────

// Card 1: Total Tickets
const totalTickets = computed(() => tickets.value.length);

// Card 2: CSAT Score
const csatStats = computed(() => {
    let good = 0,
        bad = 0;
    tickets.value.forEach((t) => {
        const score = t.csat_score?.toLowerCase();
        if (score === 'good') good++;
        else if (score === 'bad') bad++;
    });
    const rated = good + bad;
    const pct = rated > 0 ? ((good / rated) * 100).toFixed(1) : '0';
    return { pct, good, bad, rated };
});

// Card 3: Negative Sentiment
const sentimentStats = computed(() => {
    let negative = 0,
        veryNegative = 0;
    tickets.value.forEach((t) => {
        const s = t.sentiment?.toLowerCase();
        if (s === 'negative') negative++;
        else if (s === 'very negative') veryNegative++;
    });
    const total = tickets.value.length;
    const pct = total > 0 ? (((negative + veryNegative) / total) * 100).toFixed(1) : '0';
    return { pct, negative, veryNegative };
});

// Card 4: Unrated Tickets
const unratedStats = computed(() => {
    const unrated = tickets.value.filter((t) => t.csat_score?.toLowerCase() === 'unoffered').length;
    const total = tickets.value.length;
    const pct = total > 0 ? ((unrated / total) * 100).toFixed(1) : '0';
    return { unrated, pct };
});

// ── Row 2 ──────────────────────────────────────────

// Card 5: Active Brands
const brandStats = computed(() => {
    const brands = new Set(tickets.value.map((t) => t.brand).filter((b) => b && b !== 'none'));
    return { count: brands.size };
});

// Card 6: VIP Tickets
const vipStats = computed(() => {
    const vipLevels = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    let platinum = 0,
        gold = 0,
        other = 0;
    tickets.value.forEach((t) => {
        const level = t.vip_level?.toLowerCase();
        if (!vipLevels.includes(level)) return;
        if (level === 'platinum' || level === 'diamond') platinum++;
        else if (level === 'gold') gold++;
        else other++;
    });
    const total = platinum + gold + other;
    return { total, platinum, gold, other };
});

// Card 7: Compliance OK
const complianceOk = computed(() => {
    const ok = tickets.value.filter((t) => /compliance[:\s]+ok/i.test(t.summary || '')).length;
    const total = tickets.value.length;
    const pct = total > 0 ? ((ok / total) * 100).toFixed(1) : '0';
    return { ok, pct };
});

// Card 8: Compliance Issues
const complianceIssue = computed(() => {
    const issue = tickets.value.filter((t) => /compliance[:\s]+issue/i.test(t.summary || '')).length;
    const missing = tickets.value.filter((t) => !/compliance/i.test(t.summary || '')).length;
    return { issue, missing };
});
</script>

<template>
    <!-- Row 1 -->
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Total Tickets</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ totalTickets.toLocaleString() }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-ticket text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ totalTickets.toLocaleString() }}</span>
            <span class="text-muted-color ml-2">tickets in total</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">CSAT Score</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ csatStats.pct }}%</div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-star text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ csatStats.good.toLocaleString() }} good</span>
            <span class="text-muted-color ml-2">· {{ csatStats.bad.toLocaleString() }} bad rated</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Negative Sentiment</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ sentimentStats.pct }}%</div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-face-smile text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ sentimentStats.veryNegative.toLocaleString() }} very negative</span>
            <span class="text-muted-color ml-2">· {{ sentimentStats.negative.toLocaleString() }} negative</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Unrated Tickets</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ unratedStats.unrated.toLocaleString() }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-minus-circle text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ unratedStats.pct }}%</span>
            <span class="text-muted-color ml-2">of all tickets unoffered</span>
        </div>
    </div>

    <!-- Row 2 -->
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Active Brands</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ brandStats.count }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-building text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ brandStats.count }}</span>
            <span class="text-muted-color ml-2">brands across all tickets</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">VIP Tickets</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ vipStats.total.toLocaleString() }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-crown text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ vipStats.platinum.toLocaleString() }} platinum/diamond</span>
            <span class="text-muted-color ml-2">· {{ vipStats.gold.toLocaleString() }} gold</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Compliance OK</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ complianceOk.ok.toLocaleString() }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-check-circle text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ complianceOk.pct }}%</span>
            <span class="text-muted-color ml-2">of all tickets compliant</span>
        </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">Compliance Issues</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ complianceIssue.issue.toLocaleString() }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i class="pi pi-exclamation-triangle text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ complianceIssue.missing.toLocaleString() }} missing</span>
            <span class="text-muted-color ml-2">no compliance data</span>
        </div>
    </div>
</template>
