import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { emptyToNone } from '@/utils/normalization';

const USE_MOCKED = import.meta.env.VITE_USE_MOCKED_DATA === 'true';

// ── Fields that get emptyToNone normalization (short categorical fields) ──
const NORMALIZE_FIELDS = ['topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', 'sentiment'];

// ── Fields the API returns in Title Case that the frontend expects lowercase ──
const LOWERCASE_FIELDS = ['vip_level', 'sentiment', 'csat_score'];

// ── Helpers ──
const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number') return [String(value)];
    return [];
};

// ── Build _chatTagsString from chat_tags[] (shared by mock + API normalization) ──
function buildChatTagsString(tags) {
    return toArray(tags)
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim().toLowerCase())
        .sort()
        .join(', ');
}

// ── Process a single raw ticket into the shape the table expects (mock mode) ──
function mockedProcessTicket(ticket) {
    const normalized = Object.fromEntries(NORMALIZE_FIELDS.map((field) => [field, emptyToNone(ticket[field])]));

    return {
        ...ticket,
        ...normalized,
        timestamp: new Date(ticket.timestamp),
        started_at: ticket.started_at ? new Date(ticket.started_at) : null,
        updated_at: ticket.updated_at ? new Date(ticket.updated_at) : null,
        _chatTagsString: buildChatTagsString(ticket.chat_tags)
    };
}

/**
 * Normalize an API response record:
 * - emptyToNone on categorical fields
 * - lowercase vip_level, sentiment, csat_score (API returns Title Case, frontend expects lowercase)
 * - convert date strings to Date objects
 * - stringify ticketid (API returns integer, frontend uses string)
 * - build _chatTagsString from chat_tags[] for filter compatibility
 */
function normalizeApiRecord(ticket) {
    const normalized = Object.fromEntries(NORMALIZE_FIELDS.map((field) => [field, emptyToNone(ticket[field])]));

    for (const field of LOWERCASE_FIELDS) {
        if (typeof normalized[field] === 'string' && normalized[field] !== 'none') {
            normalized[field] = normalized[field].toLowerCase();
        }
    }

    return {
        ...ticket,
        ...normalized,
        ticketid: String(ticket.ticketid),
        timestamp: ticket.timestamp ? new Date(ticket.timestamp) : null,
        started_at: ticket.started_at ? new Date(ticket.started_at) : null,
        updated_at: ticket.updated_at ? new Date(ticket.updated_at) : null,
        has_chat_transcript: ticket.has_chat_transcript === true,
        has_email_transcript: ticket.has_email_transcript === true,
        _chatTagsString: buildChatTagsString(ticket.chat_tags)
    };
}

// ── Yield to the browser event loop between processing batches ──
function yieldToMain() {
    if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
        return scheduler.yield();
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
}

const PROCESS_BATCH_SIZE = 150;

export const useTicketDataStore = defineStore('ticketData', () => {
    // ── Shared state ──
    const isLoading = ref(false);
    const fetchError = ref(null);

    // ── Mock-mode state ──
    const mockedFullProcessedTickets = shallowRef([]);

    // ── API-mode state ──
    const tickets = shallowRef([]);
    const totalCount = ref(0);

    // Non-reactive init tracking
    let isInitialized = false;
    let initPromise = null;

    // ════════════════════════════════════════════════════════════════════
    //  MOCK MODE — existing client-side logic (loads all data, IDB cache)
    // ════════════════════════════════════════════════════════════════════

    async function mockedProcessRecords(rawData) {
        const result = new Array(rawData.length);
        for (let i = 0; i < rawData.length; i += PROCESS_BATCH_SIZE) {
            const end = Math.min(i + PROCESS_BATCH_SIZE, rawData.length);
            for (let j = i; j < end; j++) {
                result[j] = mockedProcessTicket(rawData[j]);
            }
            if (end < rawData.length) {
                await yieldToMain();
            }
        }
        mockedFullProcessedTickets.value = result;
    }

    async function mockedFetchAndCache() {
        const { default: api } = await import('@/services/authApi');
        const response = await api.get('/api/ticket-conversation-summaries/');
        const raw = Array.isArray(response.data) ? response.data : (response.data.results ?? []);
        await mockedProcessRecords(raw);
        const { setCachedTickets } = await import('@/services/mockedTicketCache');
        setCachedTickets(mockedFullProcessedTickets.value).catch((err) => console.warn('IDB write failed:', err));
    }

    async function mockedRefreshInBackground() {
        try {
            await mockedFetchAndCache();
        } catch (err) {
            console.warn('Background refresh failed (non-fatal):', err);
        }
    }

    async function mockedLazyInit() {
        isLoading.value = true;
        fetchError.value = null;
        try {
            const { default: mockData } = await import('@/services/mocked-ticket-summaries.json');
            await mockedProcessRecords(mockData);
            isInitialized = true;
            return;
        } catch (err) {
            // If mock data not available, try IDB + API fallback
            try {
                const { getCachedTickets, isCacheStale } = await import('@/services/mockedTicketCache');
                const cached = await getCachedTickets().catch(() => null);

                if (cached?.data?.length) {
                    for (let i = 0; i < cached.data.length; i++) {
                        const t = cached.data[i];
                        if (t.timestamp && !(t.timestamp instanceof Date)) t.timestamp = new Date(t.timestamp);
                        if (t.started_at && !(t.started_at instanceof Date)) t.started_at = new Date(t.started_at);
                        if (t.updated_at && !(t.updated_at instanceof Date)) t.updated_at = new Date(t.updated_at);
                    }
                    mockedFullProcessedTickets.value = cached.data;
                    isLoading.value = false;
                    isInitialized = true;

                    if (isCacheStale(cached)) {
                        mockedRefreshInBackground().catch((e) => console.warn('Background refresh failed:', e));
                    }
                    return;
                }

                await mockedFetchAndCache();
                isInitialized = true;
            } catch (innerErr) {
                fetchError.value = innerErr;
                isInitialized = false;
                console.error('useTicketDataStore: failed to load tickets (mock mode)', innerErr);
            }
        } finally {
            isLoading.value = false;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  API MODE — server-side pagination, per-request data fetching
    // ════════════════════════════════════════════════════════════════════

    async function fetchTickets(params) {
        isLoading.value = true;
        fetchError.value = null;
        try {
            // The list endpoint ignores the `ticketid` query param — route through the
            // detail endpoint (/api/ticket-summaries/{id}/) for exact-match lookup,
            // then wrap the single result in the paginated list shape the DataTable expects.
            if (params.ticketid) {
                try {
                    const { fetchTicketDetail } = await import('@/services/ticketApi');
                    const data = await fetchTicketDetail(params.ticketid);
                    const normalized = normalizeApiRecord(data);
                    // Detail endpoint returns the actual transcript texts (not the has_* booleans);
                    // derive the booleans from content presence so the "View" buttons render correctly.
                    normalized.has_chat_transcript = !!normalized.chat_transcript;
                    normalized.has_email_transcript = !!normalized.email_transcript;
                    tickets.value = [normalized];
                    totalCount.value = 1;
                } catch (err) {
                    if (err?.response?.status === 404) {
                        tickets.value = [];
                        totalCount.value = 0;
                    } else {
                        throw err;
                    }
                }
                return;
            }

            const { fetchTicketList } = await import('@/services/ticketApi');
            const data = (await fetchTicketList(params)) ?? {};
            tickets.value = (data.results || []).map(normalizeApiRecord);
            totalCount.value = data.count || 0;
        } catch (err) {
            fetchError.value = err;
            console.error('useTicketDataStore: fetchTickets failed', err);
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchTicketById(ticketId) {
        const { fetchTicketDetail } = await import('@/services/ticketApi');
        const data = await fetchTicketDetail(ticketId);
        return normalizeApiRecord(data);
    }

    async function apiLazyInit() {
        isLoading.value = true;
        fetchError.value = null;
        try {
            const { buildTicketListParams, fetchTicketList } = await import('@/services/ticketApi');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const params = buildTicketListParams({ startDate: today, endDate: new Date() }, { page: 1, rows: 5, sortField: 'timestamp', sortOrder: -1 });
            const data = (await fetchTicketList(params)) ?? {};
            tickets.value = (data.results || []).map(normalizeApiRecord);
            totalCount.value = data.count || 0;
            isInitialized = true;
        } catch (err) {
            fetchError.value = err;
            isInitialized = false;
            console.error('useTicketDataStore: apiLazyInit failed', err);
        } finally {
            isLoading.value = false;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  SHARED — lazyInit dispatches to the correct mode
    // ════════════════════════════════════════════════════════════════════

    async function lazyInit() {
        if (isInitialized) return;
        if (initPromise) return initPromise;

        initPromise = (USE_MOCKED ? mockedLazyInit() : apiLazyInit()).finally(() => {
            initPromise = null;
        });

        return initPromise;
    }

    return {
        // Shared
        isLoading,
        fetchError,
        lazyInit,

        // Mock mode
        mockedFullProcessedTickets,

        // API mode
        tickets,
        totalCount,
        fetchTickets,
        fetchTicketById
    };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useTicketDataStore, import.meta.hot));
}
