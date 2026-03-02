import { cleanAndFormatString } from '@/utils/stringUtils';

export function useCustomerNormalizer() {
    const normalizeCustomer = (customer) => {
        const normalized = { ...customer };

        normalized.timestamp = new Date(customer.timestamp);

        normalized.vip_level = !customer.vip_level || customer.vip_level.toString().trim().toLowerCase() === 'null' ? 'none' : customer.vip_level.toString().trim().toLowerCase();

        normalized.customer_email = !customer.customer_email || customer.customer_email.toString().trim().toLowerCase() === 'null' ? 'none' : customer.customer_email.toString().trim().toLowerCase();

        normalized.agent_email = !customer.agent_email || customer.agent_email.toString().trim().toLowerCase() === 'null' ? 'none' : customer.agent_email.toString().trim().toLowerCase();

        normalized.summary = !customer.summary || customer.summary.toString().trim().toLowerCase() === 'null' ? 'No Data' : customer.summary;

        // Optional: normalize sentiment/vip_level case
        if (normalized.vip_level) normalized.vip_level = normalized.vip_level.toLowerCase();
        if (normalized.sentiment) normalized.sentiment = normalized.sentiment.toLowerCase();

        // Clean transcripts
        if (normalized.chat_transcript) {
            normalized.chat_transcript = cleanAndFormatString(normalized.chat_transcript);
        }
        if (normalized.email_transcript) {
            normalized.email_transcript = cleanAndFormatString(normalized.email_transcript);
        }

        return normalized;
    };

    return { normalizeCustomer };
}
