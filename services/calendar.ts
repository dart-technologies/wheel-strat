import { store } from '@/data/store';
import type { Row } from 'tinybase';

type CalendarEntry = {
    id: string;
    date?: string;
    market?: string;
    isOpen?: boolean;
    holiday?: string;
    event?: string;
    earlyClose?: boolean;
    impact?: string;
    symbols?: string[] | string;
    updatedAt?: string;
    source?: string;
};

const toString = (value?: unknown) => (typeof value === 'string' ? value : undefined);
const toBool = (value?: unknown) => (typeof value === 'boolean' ? value : undefined);

const normalizeSymbols = (value?: string[] | string) => {
    if (Array.isArray(value)) {
        const symbols = value
            .filter((symbol) => typeof symbol === 'string')
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean);
        return symbols.length ? symbols.join(',') : undefined;
    }
    if (typeof value === 'string') {
        const symbols = value
            .split(',')
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean);
        return symbols.length ? symbols.join(',') : undefined;
    }
    return undefined;
};

export const normalizeCalendarRow = (entry: CalendarEntry): Row => {
    const row: Row = {};
    if (entry.date) row.date = entry.date;
    if (entry.market) row.market = entry.market;
    if (entry.holiday) row.holiday = entry.holiday;
    if (entry.event) row.event = entry.event;
    if (typeof entry.isOpen === 'boolean') row.isOpen = entry.isOpen;
    if (typeof entry.earlyClose === 'boolean') row.earlyClose = entry.earlyClose;
    if (entry.impact) row.impact = entry.impact;
    const symbols = normalizeSymbols(entry.symbols);
    if (symbols) row.symbols = symbols;
    if (entry.updatedAt) row.updatedAt = entry.updatedAt;
    if (entry.source) row.source = entry.source;
    return row;
};

export const syncMarketCalendarRows = (entries: CalendarEntry[]) => {
    const nextIds = new Set<string>();

    store.transaction(() => {
        entries.forEach((entry) => {
            if (!entry?.id) return;
            nextIds.add(entry.id);
            const row = normalizeCalendarRow(entry);
            const existing = store.getRow('marketCalendar', entry.id);
            store.setRow('marketCalendar', entry.id, { ...existing, ...row });
        });

        const existingIds = store.getRowIds('marketCalendar');
        existingIds.forEach((id) => {
            if (!nextIds.has(id)) {
                store.delRow('marketCalendar', id);
            }
        });
    });

    store.setCell('syncMetadata', 'main', 'lastCalendarSync', new Date().toISOString());
};
