import api from '@/services/authApi';
import { ref } from 'vue';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// ── Module-level cache (shared across ALL component instances) ──
let isInitialized = false;
let initPromise = null;

const allChatTags = ref([]);
const allTopics = ref([]);
const allBrands = ref([]);
const allVipLevels = ref([]);
const allCustomerEmails = ref([]);
const allAgentEmails = ref([]);
const fullProcessedTickets = ref([]);
const isLoading = ref(false);

// ── Helpers ──
const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number') return [String(value)];
    return [];
};

const emptyToNone = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? 'none' : trimmed;
    }
    return value ?? 'none';
};

// ── Process raw records into the shape the table expects ──
function processRecords(rawData) {
    const tagSet = new Set(),
        topicSet = new Set(),
        brandSet = new Set();
    const vipSet = new Set(),
        custEmailSet = new Set(),
        agentEmailSet = new Set();

    const processed = rawData.map((customer) => {
        const tags = toArray(customer.chat_tags).filter((t) => typeof t === 'string' && t.trim());

        tags.forEach((tag) => tagSet.add(tag.trim()));
        toArray(customer.topic).forEach((v) => v?.trim() && topicSet.add(v.trim()));
        toArray(customer.brand).forEach((v) => v?.trim() && brandSet.add(v.trim()));
        toArray(customer.vip_level).forEach((v) => v?.trim() && vipSet.add(v.trim()));
        toArray(customer.customer_email).forEach((v) => v?.trim() && custEmailSet.add(v.trim()));
        toArray(customer.agent_email).forEach((v) => v?.trim() && agentEmailSet.add(v.trim()));

        return {
            ...customer,
            timestamp: new Date(customer.timestamp),
            topic: emptyToNone(customer.topic),
            brand: emptyToNone(customer.brand),
            vip_level: emptyToNone(customer.vip_level),
            customer_email: emptyToNone(customer.customer_email),
            agent_email: emptyToNone(customer.agent_email),
            csat_score: emptyToNone(customer.csat_score),
            sentiment: emptyToNone(customer.sentiment),
            summary: emptyToNone(customer.summary),
            chat_transcript: emptyToNone(customer.chat_transcript),
            email_transcript: emptyToNone(customer.email_transcript),
            _chatTagsString: tags
                .map((t) => t.trim().toLowerCase())
                .sort()
                .join(', ')
        };
    });

    const sort = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    allChatTags.value = [...tagSet].sort(sort);
    allTopics.value = [...topicSet].sort(sort);
    allBrands.value = [...brandSet].sort(sort);
    allVipLevels.value = [...vipSet].sort(sort);
    allCustomerEmails.value = [...custEmailSet].sort(sort);
    allAgentEmails.value = [...agentEmailSet].sort(sort);
    fullProcessedTickets.value = processed;
}

// ── Single fetch — runs once, shared across all instances ──
async function lazyInit() {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        isLoading.value = true;
        try {
            if (USE_MOCK) {
                const { default: mockData } = await import('@/services/mock-ticket-summaries.json');
                processRecords(mockData);
            } else {
                const response = await api.get('/api/ticket-summaries/');
                const raw = Array.isArray(response.data) ? response.data : (response.data.results ?? []);
                processRecords(raw);
            }
            isInitialized = true;
        } catch (err) {
            console.error('useArrayMultiSelects: failed to load tickets', err);
        } finally {
            isLoading.value = false;
            initPromise = null;
        }
    })();

    return initPromise;
}

// Pre-fetch immediately on first import
lazyInit();

export function useArrayMultiSelects() {
    return {
        allChatTags,
        allTopics,
        allBrands,
        allVipLevels,
        allCustomerEmails,
        allAgentEmails,
        fullProcessedTickets,
        isLoading,
        _lazyInit: lazyInit
    };
}
