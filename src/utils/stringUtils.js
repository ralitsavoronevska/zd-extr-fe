/**
 * Formats dates, splits lines after dates and separators,
 * and removes any markdown image syntax like ![](...) or ![]()
 */
export function cleanAndFormatString(input) {
    if (!input || typeof input !== 'string') return input;

    // Remove markdown images
    let cleaned = input
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/!\[\]\(.*?\)/g, '')
        .replace(/!\[.*?\]\(\s*blob:.*?\)/g, '')
        .replace(/!\[\]/g, '');

    // Normalize broken ISO dates (remove unwanted spaces)
    cleaned = cleaned
        .replace(/\s*([+:])\s*/g, '$1')
        .replace(/T\s+/g, 'T')
        .replace(/\s+(\d{2}:\d{2})/g, '$1')
        .replace(/(\d{2})\s*([+-]\d{2}:\d{2})/g, '$1$2');

    // Format dates: first one inline, others with double newline before
    const dateRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2})/g;
    let dateCount = 0;

    let result = cleaned.replace(dateRegex, (match) => {
        try {
            const date = new Date(match);
            if (isNaN(date.getTime())) return match;

            const formatted = new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(date);

            dateCount++;
            return dateCount === 1 ? formatted : `\n\n${formatted}`;
        } catch {
            return match;
        }
    });

    // Replace separators with newline
    result = result.replace(/\s*(?:\|+|[-–—]+|and|,\s*)\s*/gi, '\n');

    // Clean up multiple newlines
    result = result.replace(/\n{4,}/g, '\n\n').trim();

    return result;
}
