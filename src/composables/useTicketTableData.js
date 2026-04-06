import { computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useTicketDataStore } from '@/stores/ticketData';
import { useTableStore } from '@/stores/tableStore';
import { useAuthStore } from '@/stores/auth';
import { useFacetedFilterOptions } from '@/composables/useFacetedFilterOptions';
import { useCsvExport } from '@/composables/useCsvExport';
import { applyMockedTicketFilters } from '@/utils/mockedTicketFilters';
import { maskEmail } from '@/utils/stringUtils';
import { buildTicketListParams, buildExportParams, exportTicketsCsv } from '@/services/ticketApi';
import { formatDate } from '@/utils/dateUtils';
import { PAGE_SIZE_DEFAULT, FILTER_DEBOUNCE_MS } from '@/composables/useTicketFilters';

const USE_MOCKED = import.meta.env.VITE_USE_MOCKED_DATA === 'true';

/**
 * Dual-mode data pipeline for the ticket DataTable.
 * Handles: data fetching, pagination events, faceted filter options,
 * CSV export, and wraps quick-date / clear-filter with fetch triggers.
 *
 * @param {Object} filterState — return value of useTicketFilters()
 * @param {import('vue').Ref} dataTableRef — template ref for the DataTable (mock CSV export)
 */
export function useTicketTableData(filterState, dataTableRef) {
    const { filters, lazyParams, extractFilterParams, resetFilters, applyQuickDateFilter } = filterState;

    const tableStore = useTableStore();
    const ticketDataStore = useTicketDataStore();
    const authStore = useAuthStore();
    const { isLoading } = storeToRefs(ticketDataStore);
    const isAdmin = computed(() => authStore.hasRole('admin'));

    // ════════════════════════════════════════════════════════════════════
    //  MOCK MODE — client-side filtering, pagination, faceted options
    // ════════════════════════════════════════════════════════════════════
    let mockedFilteredTickets;
    let mockedPaginatedTickets;
    let mockedTotalRecords;
    let availableTopics, availableBrands, availableVipLevels, availableCustomerEmails, availableAgentEmails, availableChatTags, availableSentiments, availableCsatScores;

    if (USE_MOCKED) {
        const { mockedFullProcessedTickets } = storeToRefs(ticketDataStore);

        mockedFilteredTickets = computed(() => applyMockedTicketFilters(mockedFullProcessedTickets.value, extractFilterParams()));

        mockedPaginatedTickets = computed(() => {
            const start = (lazyParams.value.page - 1) * lazyParams.value.limit;
            return mockedFilteredTickets.value.slice(start, start + lazyParams.value.limit);
        });

        mockedTotalRecords = computed(() => mockedFilteredTickets.value.length);

        const faceted = useFacetedFilterOptions(filters, mockedFullProcessedTickets);
        availableTopics = faceted.availableTopics;
        availableBrands = faceted.availableBrands;
        availableVipLevels = faceted.availableVipLevels;
        availableCustomerEmails = faceted.availableCustomerEmails;
        availableAgentEmails = faceted.availableAgentEmails;
        availableChatTags = faceted.availableChatTags;
        availableSentiments = faceted.availableSentiments;
        availableCsatScores = faceted.availableCsatScores;

        // Sync filtered data to tableStore for charts/stats/VIP
        watch(
            mockedFilteredTickets,
            (newFiltered) => {
                tableStore.setMockedFilteredTickets(newFiltered);
                lazyParams.value.page = 1;
            },
            { immediate: true }
        );
    }

    // ════════════════════════════════════════════════════════════════════
    //  API MODE — server-side filtering, pagination, aggregations
    // ════════════════════════════════════════════════════════════════════
    let fetchDataDebounceTimer = null;

    async function fetchData() {
        if (USE_MOCKED) return;

        const filterParams = extractFilterParams();
        const listParams = buildTicketListParams(filterParams, {
            page: lazyParams.value.page,
            rows: lazyParams.value.limit,
            sortField: lazyParams.value.sortField,
            sortOrder: lazyParams.value.sortOrder
        });

        await Promise.all([ticketDataStore.fetchTickets(listParams), tableStore.fetchAllAggregations(filterParams)]);
    }

    function debouncedFetchData() {
        if (USE_MOCKED) return;
        clearTimeout(fetchDataDebounceTimer);
        fetchDataDebounceTimer = setTimeout(() => {
            lazyParams.value.page = 1;
            fetchData();
        }, FILTER_DEBOUNCE_MS);
    }

    // Watch filter changes in API mode — debounced
    if (!USE_MOCKED) {
        watch(
            () => JSON.stringify(extractFilterParams()),
            () => debouncedFetchData(),
            { deep: false }
        );
    }

    // ════════════════════════════════════════════════════════════════════
    //  UNIFIED — data bindings that work in both modes
    // ════════════════════════════════════════════════════════════════════

    const rawTableData = computed(() => {
        if (USE_MOCKED) return mockedPaginatedTickets?.value ?? [];
        return ticketDataStore.tickets;
    });

    // SECURITY: UI-only masking — real emails are still in API responses and Pinia state.
    // Remove once backend implements server-side masking (see CLAUDE.md "Backend requirement").
    const tableData = computed(() => {
        const rows = rawTableData.value;
        if (isAdmin.value || !rows.length) return rows;
        return rows.map((row) => ({ ...row, customer_email: maskEmail(row.customer_email) }));
    });

    const totalRecords = computed(() => {
        if (USE_MOCKED) return mockedTotalRecords?.value ?? 0;
        return ticketDataStore.totalCount;
    });

    // Faceted filter options — API mode reads from tableStore.filterOptions
    if (!USE_MOCKED) {
        const sortedOptions = (key) => computed(() => [...(tableStore.filterOptions?.[key] ?? [])].sort((a, b) => String(a).localeCompare(String(b))));
        availableTopics = sortedOptions('topic');
        availableBrands = sortedOptions('brand');
        availableVipLevels = sortedOptions('vip_level');
        availableCustomerEmails = sortedOptions('customer_email');
        availableAgentEmails = sortedOptions('agent_email');
        availableChatTags = sortedOptions('chat_tags');
        availableSentiments = sortedOptions('sentiment');
        availableCsatScores = sortedOptions('csat_score');
    }

    // ── Export ──
    const { exportToCSV } = USE_MOCKED
        ? useCsvExport(dataTableRef, mockedFilteredTickets, formatDate)
        : {
              exportToCSV: async () => {
                  const params = buildExportParams(extractFilterParams());
                  await exportTicketsCsv(params);
              }
          };

    // ── Event handlers ──
    function onPage(event) {
        lazyParams.value.page = event?.page ? event.page + 1 : 1;
        lazyParams.value.limit = event?.rows || PAGE_SIZE_DEFAULT;
        if (!USE_MOCKED) fetchData();
    }

    function onSort(event) {
        if (!USE_MOCKED && event?.sortField) {
            lazyParams.value.sortField = event.sortField;
            lazyParams.value.sortOrder = event.sortOrder ?? -1;
            fetchData();
        }
    }

    function onFilter() {
        lazyParams.value.page = 1;
        if (!USE_MOCKED) debouncedFetchData();
    }

    // ── Wrapped filter actions (state change + fetch) ──
    function setQuickDateFilter(period) {
        applyQuickDateFilter(period);
        if (!USE_MOCKED) fetchData();
    }

    function clearFilter() {
        resetFilters();
        if (!USE_MOCKED) fetchData();
    }

    // ── Init ──
    onMounted(async () => {
        await ticketDataStore.lazyInit();
        if (!USE_MOCKED) {
            tableStore.fetchAllAggregations(extractFilterParams());
        }
    });

    return {
        isLoading, isAdmin, maskEmail,
        tableData, totalRecords,
        availableTopics, availableBrands, availableVipLevels,
        availableCustomerEmails, availableAgentEmails, availableChatTags,
        availableSentiments, availableCsatScores,
        exportToCSV,
        onPage, onSort, onFilter,
        setQuickDateFilter, clearFilter
    };
}
