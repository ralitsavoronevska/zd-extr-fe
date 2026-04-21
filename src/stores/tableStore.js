import { acceptHMRUpdate, defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { NEGATIVE_SENTIMENTS } from '@/config/mockedEnums';

// O(1) lookup instead of Array.includes O(n) — called per row (mock mode only)
const NEGATIVE_SET = new Set(NEGATIVE_SENTIMENTS);

// Compliance regex patterns (shared with useMockedStatsAggregation logic)
const COMPLIANCE_OK_RE = /compliance[:\s]+ok/i;
const COMPLIANCE_ISSUE_RE = /compliance[:\s]+issue/i;
const COMPLIANCE_WORD_RE = /compliance/i;

export const useTableStore = defineStore('table', () => {
    // ════════════════════════════════════════════════════════════════════
    //  MOCK MODE — client-side filtered data + aggregations
    // ════════════════════════════════════════════════════════════════════
    const mockedFilteredTickets = shallowRef([]);

    function setMockedFilteredTickets(rows) {
        mockedFilteredTickets.value = rows || [];
    }

    const mockedTopicStats = computed(() => {
        const stats = {};

        mockedFilteredTickets.value.forEach((c) => {
            const topic = c.topic || 'Unknown';
            if (!stats[topic]) {
                stats[topic] = { total: 0, negative: 0 };
            }
            stats[topic].total++;
            if (NEGATIVE_SET.has(c.sentiment?.toLowerCase())) {
                stats[topic].negative++;
            }
        });

        return Object.entries(stats)
            .map(([topic, counts]) => ({
                topic,
                total: counts.total,
                negative: counts.negative,
                percent_negative: counts.total > 0 ? (counts.negative / counts.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);
    });

    // ════════════════════════════════════════════════════════════════════
    //  API MODE — server response containers
    // ════════════════════════════════════════════════════════════════════
    const filterOptions = ref(null);
    const narrowedFilterOptions = ref(null);
    const stats = ref(null);
    const topicChartData = ref(null);
    const vipCsatData = ref(null);

    // Loading states for aggregation endpoints
    const isAggregationsLoading = ref(false);

    // Generation counter — prevents stale responses from overwriting fresh data
    // when the user changes filters faster than the server responds
    let aggregationGeneration = 0;

    /** FULL options — date-range only, for active field dropdowns. */
    async function fetchFilterOptionsFromApi(filters) {
        const { buildFilterOptionsParams, fetchFilterOptions } = await import('@/services/ticketApi');
        const params = buildFilterOptionsParams(filters);
        filterOptions.value = await fetchFilterOptions(params);
        if (import.meta.env.DEV) {
            console.group('[tableStore] fetchFilterOptionsFromApi (FULL — date only)');
            console.log('Params:', params);
            console.log('topics:', filterOptions.value?.topic?.length, '| brands:', filterOptions.value?.brand?.length, '| vipLevels:', filterOptions.value?.vip_level?.length, '| sentiments:', filterOptions.value?.sentiment?.length, '| csatScores:', filterOptions.value?.csat_score?.length);
            console.groupEnd();
        }
    }

    /** NARROWED options — date-range + attribute filters, for inactive field dropdowns. */
    async function fetchNarrowedFilterOptions(filters) {
        const { buildNarrowedFilterOptionsParams, fetchFilterOptions } = await import('@/services/ticketApi');
        const params = buildNarrowedFilterOptionsParams(filters);
        narrowedFilterOptions.value = await fetchFilterOptions(params);
        if (import.meta.env.DEV) {
            console.group('[tableStore] fetchNarrowedFilterOptions (NARROWED — date + attributes)');
            console.log('Params:', params);
            console.log('topics:', narrowedFilterOptions.value?.topic?.length, '| brands:', narrowedFilterOptions.value?.brand?.length, '| vipLevels:', narrowedFilterOptions.value?.vip_level?.length, '| sentiments:', narrowedFilterOptions.value?.sentiment?.length, '| csatScores:', narrowedFilterOptions.value?.csat_score?.length);
            console.groupEnd();
        }
    }

    async function fetchStats(filters) {
        const { buildStatsParams, fetchTicketStats } = await import('@/services/ticketApi');
        stats.value = await fetchTicketStats(buildStatsParams(filters));
    }

    async function fetchTopicChart(filters) {
        const { buildTopicChartParams, fetchTopicChartData: apiFetch } = await import('@/services/ticketApi');
        topicChartData.value = await apiFetch(buildTopicChartParams(filters));
    }

    async function fetchVipCsat(filters) {
        const { buildVipCsatParams, fetchVipCsatData: apiFetch } = await import('@/services/ticketApi');
        vipCsatData.value = await apiFetch(buildVipCsatParams(filters));
    }

    /**
     * Fetches ONLY filter-options endpoints (full + narrowed). Used for ticketid lookups
     * where stats/chart/vip are computed client-side from the single ticket.
     */
    async function fetchFilterOptionsOnly(filters) {
        const generation = ++aggregationGeneration;
        isAggregationsLoading.value = true;
        try {
            const results = await Promise.allSettled([fetchFilterOptionsFromApi(filters), fetchNarrowedFilterOptions(filters)]);

            if (generation !== aggregationGeneration) return;

            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    const names = ['filterOptions', 'narrowedFilterOptions'];
                    console.error(`Failed to fetch ${names[i]}:`, result.reason?.message || result.reason);
                }
            });
        } finally {
            if (generation === aggregationGeneration) {
                isAggregationsLoading.value = false;
            }
        }
    }

    /**
     * Populate stats / topicChartData / vipCsatData from a single normalized ticket.
     * Used when the user filters by ticketid — the backend doesn't honor the ticketid
     * query param on aggregation endpoints, so we compute the aggregation shapes
     * client-side to keep the charts/stats/VIP widgets in sync with the table.
     */
    function setSingleTicketAggregations(ticket) {
        if (!ticket) {
            stats.value = null;
            topicChartData.value = null;
            vipCsatData.value = null;
            return;
        }

        const csat = ticket.csat_score?.toLowerCase() || '';
        const sentiment = ticket.sentiment?.toLowerCase() || '';
        const vip = ticket.vip_level?.toLowerCase() || '';
        const summary = ticket.summary || '';
        const isNegative = NEGATIVE_SET.has(sentiment);
        const isRated = csat === 'good' || csat === 'bad';

        // ── Stats (shape matches /api/ticket-stats/) ──
        stats.value = {
            total_tickets: 1,
            csat: {
                good: csat === 'good' ? 1 : 0,
                bad: csat === 'bad' ? 1 : 0,
                unoffered: csat === 'unoffered' ? 1 : 0
            },
            sentiment: {
                positive: sentiment === 'positive' ? 1 : 0,
                very_positive: sentiment === 'very positive' ? 1 : 0,
                neutral: sentiment === 'neutral' ? 1 : 0,
                negative: sentiment === 'negative' ? 1 : 0,
                very_negative: sentiment === 'very negative' ? 1 : 0
            },
            brands_count: ticket.brand && ticket.brand !== 'none' ? 1 : 0,
            vip: {
                platinum: vip === 'platinum' ? 1 : 0,
                diamond: vip === 'diamond' ? 1 : 0,
                gold: vip === 'gold' ? 1 : 0,
                silver: vip === 'silver' ? 1 : 0,
                bronze: vip === 'bronze' ? 1 : 0
            },
            compliance: {
                ok: COMPLIANCE_OK_RE.test(summary) ? 1 : 0,
                issue: COMPLIANCE_ISSUE_RE.test(summary) ? 1 : 0,
                missing: !COMPLIANCE_WORD_RE.test(summary) ? 1 : 0
            },
            unrated_tickets: csat === 'unoffered' ? 1 : 0
        };

        // ── Topic chart (shape matches /api/topic-chart-data/) ──
        topicChartData.value = {
            topics: [
                {
                    topic: ticket.topic || 'Unknown',
                    total: 1,
                    negative: isNegative ? 1 : 0,
                    percent_negative: isNegative ? 100 : 0
                }
            ]
        };

        // ── VIP CSAT (shape matches /api/vip-csat-data/) ──
        // Render ONLY the ticket's segment row instead of all 7 — otherwise an
        // unoffered ticket would display identical 0/0/0 cells across every segment
        // and the user couldn't tell which VIP tier the ticket belongs to.
        // The `TOTAL` row is still rendered by useApiVipAggregation from the `totals` field.
        const ts = ticket.timestamp instanceof Date ? ticket.timestamp : new Date(ticket.timestamp);
        const dayStart = new Date(ts);
        dayStart.setHours(0, 0, 0, 0);
        const dateKey = dayStart.toISOString().split('T')[0];
        const segment = vip || 'none';
        const cell = {
            good: csat === 'good' ? 1 : 0,
            bad: csat === 'bad' ? 1 : 0,
            rated: isRated ? 1 : 0
        };

        vipCsatData.value = {
            segments: [segment],
            dates: [dateKey],
            data: { [segment]: { [dateKey]: { ...cell } } },
            totals: { [dateKey]: { ...cell } }
        };
    }

    /**
     * Fetches all aggregation endpoints in parallel.
     * Accepts raw filter object from extractFilterParams() — each endpoint builds its own params.
     */
    async function fetchAllAggregations(filters) {
        const generation = ++aggregationGeneration;
        isAggregationsLoading.value = true;
        try {
            const results = await Promise.allSettled([fetchFilterOptionsFromApi(filters), fetchNarrowedFilterOptions(filters), fetchStats(filters), fetchTopicChart(filters), fetchVipCsat(filters)]);

            // Discard results if a newer request was fired while we were waiting
            if (generation !== aggregationGeneration) return;

            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    const names = ['filterOptions', 'narrowedFilterOptions', 'stats', 'topicChartData', 'vipCsatData'];
                    console.error(`Failed to fetch ${names[i]}:`, result.reason?.message || result.reason);
                }
            });
        } finally {
            if (generation === aggregationGeneration) {
                isAggregationsLoading.value = false;
            }
        }
    }

    return {
        // Mock mode
        mockedFilteredTickets,
        setMockedFilteredTickets,
        mockedTopicStats,

        // API mode
        filterOptions,
        narrowedFilterOptions,
        stats,
        topicChartData,
        vipCsatData,
        isAggregationsLoading,
        fetchFilterOptionsFromApi,
        fetchNarrowedFilterOptions,
        fetchStats,
        fetchTopicChart,
        fetchVipCsat,
        fetchAllAggregations,
        fetchFilterOptionsOnly,
        setSingleTicketAggregations
    };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useTableStore, import.meta.hot));
}
