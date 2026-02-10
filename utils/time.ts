export type DateInput =
    | string
    | number
    | Date
    | { toDate: () => Date }
    | { seconds: number; nanoseconds?: number }
    | null
    | undefined;

export function coerceToDate(date: DateInput): Date | null {
    if (!date) return null;
    if (date instanceof Date) {
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof date === 'string' || typeof date === 'number') {
        const parsed = new Date(date);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof (date as { toDate?: () => Date }).toDate === 'function') {
        try {
            const parsed = (date as { toDate: () => Date }).toDate();
            return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
        } catch {
            return null;
        }
    }
    if (typeof (date as { seconds?: number }).seconds === 'number') {
        const seconds = (date as { seconds: number }).seconds;
        const nanoseconds = (date as { nanoseconds?: number }).nanoseconds || 0;
        const parsed = new Date((seconds * 1000) + Math.floor(nanoseconds / 1e6));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

export function formatTimeSince(
    date: DateInput, 
    options: { lowercase?: boolean; compact?: boolean } = {}
): string {
    const d = coerceToDate(date);
    if (!d) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    const suffix = options.compact ? '' : ' ago';
    let unitM = options.lowercase ? 'm' : 'M';
    let unitH = options.lowercase ? 'h' : 'H';
    let unitD = options.lowercase ? 'd' : 'D';

    if (diffMins < 1) return options.compact ? 'now' : 'Just now';
    if (diffMins < 60) return `${diffMins}${unitM}${suffix}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}${unitH}${suffix}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}${unitD}${suffix}`;
}

export const parseExpirationDate = (value?: string): Date | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{8}$/.test(trimmed)) {
        const year = trimmed.slice(0, 4);
        const month = trimmed.slice(4, 6);
        const day = trimmed.slice(6, 8);
        const iso = `${year}-${month}-${day}T00:00:00Z`;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const date = new Date(`${trimmed}T00:00:00Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const getDaysToExpiration = (value?: string, now: Date = new Date()): number | null => {
    const date = parseExpirationDate(value);
    if (!date) return null;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = date.getTime() - startOfDay.getTime();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};
