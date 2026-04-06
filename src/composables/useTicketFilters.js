import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { computed, ref } from 'vue';

export const PAGE_SIZE_DEFAULT = 5;
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
export const FILTER_DEBOUNCE_MS = 300;

const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

function createInitialFilters() {
    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        timestamp: {
            operator: FilterOperator.AND,
            constraints: [
                { value: todayStart(), matchMode: FilterMatchMode.DATE_AFTER },
                { value: new Date(), matchMode: FilterMatchMode.DATE_BEFORE }
            ]
        },
        started_at: {
            operator: FilterOperator.AND,
            constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE }
            ]
        },
        updated_at: {
            operator: FilterOperator.AND,
            constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE }
            ]
        },
        ticketid: { value: null, matchMode: FilterMatchMode.EQUALS },
        topic: { value: [], matchMode: 'containsAny' },
        brand: { value: [], matchMode: 'containsAny' },
        vip_level: { value: [], matchMode: 'containsAny' },
        customer_email: { value: [], matchMode: 'containsAny' },
        agent_email: { value: [], matchMode: 'containsAny' },
        csat_score: { value: null, matchMode: FilterMatchMode.EQUALS },
        _chatTagsString: { value: [], matchMode: 'containsAny' },
        chat_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
        email_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
        sentiment: { value: null, matchMode: FilterMatchMode.EQUALS },
        sentiment_reason: { value: null, matchMode: FilterMatchMode.CONTAINS },
        summary: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}

export function useTicketFilters() {
    const filters = ref(createInitialFilters());

    const lazyParams = ref({
        page: 1,
        limit: PAGE_SIZE_DEFAULT,
        sortField: 'timestamp',
        sortOrder: -1
    });

    const activeQuickFilter = ref('today');

    // ── Extract flat filter params from PrimeVue filter model ──
    function extractFilterParams() {
        return {
            globalFilter: filters.value.global?.value || '',
            ticketid: filters.value.ticketid?.value,
            brand: filters.value.brand?.value ?? [],
            topic: filters.value.topic?.value ?? [],
            vip_level: filters.value.vip_level?.value ?? [],
            customer_email: filters.value.customer_email?.value ?? [],
            agent_email: filters.value.agent_email?.value ?? [],
            _chatTagsString: filters.value._chatTagsString?.value ?? [],
            csat_score: filters.value.csat_score?.value,
            sentiment: filters.value.sentiment?.value,
            sentiment_reason: filters.value.sentiment_reason?.value,
            chat_transcript: filters.value.chat_transcript?.value,
            email_transcript: filters.value.email_transcript?.value,
            summary: filters.value.summary?.value,
            startDate: filters.value.timestamp?.constraints?.[0]?.value,
            endDate: filters.value.timestamp?.constraints?.[1]?.value,
            startedAtStart: filters.value.started_at?.constraints?.[0]?.value,
            startedAtEnd: filters.value.started_at?.constraints?.[1]?.value,
            updatedAtStart: filters.value.updated_at?.constraints?.[0]?.value,
            updatedAtEnd: filters.value.updated_at?.constraints?.[1]?.value
        };
    }

    // ── Date computed getters/setters for template v-model ──
    const fromDate = computed({
        get: () => filters.value.timestamp?.constraints?.[0]?.value ?? null,
        set: (val) => { if (filters.value.timestamp?.constraints?.[0]) filters.value.timestamp.constraints[0].value = val; }
    });

    const toDate = computed({
        get: () => filters.value.timestamp?.constraints?.[1]?.value ?? null,
        set: (val) => { if (filters.value.timestamp?.constraints?.[1]) filters.value.timestamp.constraints[1].value = val; }
    });

    const startedAtFrom = computed({
        get: () => filters.value.started_at?.constraints?.[0]?.value ?? null,
        set: (val) => { if (filters.value.started_at?.constraints?.[0]) filters.value.started_at.constraints[0].value = val; }
    });

    const startedAtTo = computed({
        get: () => filters.value.started_at?.constraints?.[1]?.value ?? null,
        set: (val) => { if (filters.value.started_at?.constraints?.[1]) filters.value.started_at.constraints[1].value = val; }
    });

    const updatedAtFrom = computed({
        get: () => filters.value.updated_at?.constraints?.[0]?.value ?? null,
        set: (val) => { if (filters.value.updated_at?.constraints?.[0]) filters.value.updated_at.constraints[0].value = val; }
    });

    const updatedAtTo = computed({
        get: () => filters.value.updated_at?.constraints?.[1]?.value ?? null,
        set: (val) => { if (filters.value.updated_at?.constraints?.[1]) filters.value.updated_at.constraints[1].value = val; }
    });

    // ── Quick date filter — modifies state only, caller handles fetch ──
    function applyQuickDateFilter(period) {
        if (activeQuickFilter.value === period) {
            activeQuickFilter.value = null;
            if (filters.value?.timestamp?.constraints) {
                filters.value.timestamp.constraints[0].value = null;
                filters.value.timestamp.constraints[1].value = null;
            }
            return;
        }

        activeQuickFilter.value = period;
        const start = new Date();
        const end = new Date();

        if (period === 'today') start.setHours(0, 0, 0, 0);
        else if (period === 'week') (start.setDate(start.getDate() - 7), start.setHours(0, 0, 0, 0));
        else if (period === 'month') (start.setMonth(start.getMonth() - 1), start.setHours(0, 0, 0, 0));
        else if (period === '2 months') (start.setMonth(start.getMonth() - 2), start.setHours(0, 0, 0, 0));
        else if (period === '3 months') (start.setMonth(start.getMonth() - 3), start.setHours(0, 0, 0, 0));

        if (filters.value?.timestamp?.constraints) {
            filters.value.timestamp.constraints[0].value = start;
            filters.value.timestamp.constraints[1].value = end;
        }

        lazyParams.value.page = 1;
    }

    // ── Reset all filters — modifies state only, caller handles fetch ──
    function resetFilters() {
        filters.value = createInitialFilters();
        filters.value.timestamp.constraints[0].value = null;
        filters.value.timestamp.constraints[1].value = null;
        activeQuickFilter.value = null;
        lazyParams.value.page = 1;
        lazyParams.value.limit = PAGE_SIZE_DEFAULT;
    }

    return {
        filters, lazyParams, activeQuickFilter,
        extractFilterParams,
        fromDate, toDate, startedAtFrom, startedAtTo, updatedAtFrom, updatedAtTo,
        applyQuickDateFilter, resetFilters
    };
}
