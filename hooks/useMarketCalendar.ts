import { useMemo } from 'react';
import { useTable } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { coerceToDate } from '@/utils/time';

export type MarketCalendarEvent = {
    id: string;
    date: string;
    event?: string;
    holiday?: string;
    impact?: string;
    market?: string;
    symbols?: string[];
    isOpen?: boolean;
    earlyClose?: boolean;
    source?: string;
};

const parseSymbols = (value?: string) => {
    if (!value) return undefined;
    const symbols = value.split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
    return symbols.length ? symbols : undefined;
};

export function useMarketCalendar(windowDays = 7) {
    const table = useTable('marketCalendar', store) as Record<string, Record<string, unknown>>;

    return useMemo(() => {
        const now = new Date();
        const maxDate = new Date(now.getTime() + (windowDays * 24 * 60 * 60 * 1000));

        const events = Object.entries(table || {}).map(([id, row]) => {
            const dateStr = typeof row.date === 'string' ? row.date : '';
            const dateObj = coerceToDate(dateStr);
            if (!dateObj) return null;
            if (dateObj < now || dateObj > maxDate) return null;
            return {
                id,
                date: dateStr,
                event: typeof row.event === 'string' ? row.event : undefined,
                holiday: typeof row.holiday === 'string' ? row.holiday : undefined,
                impact: typeof row.impact === 'string' ? row.impact : undefined,
                market: typeof row.market === 'string' ? row.market : undefined,
                symbols: typeof row.symbols === 'string' ? parseSymbols(row.symbols) : undefined,
                isOpen: typeof row.isOpen === 'boolean' ? row.isOpen : undefined,
                earlyClose: typeof row.earlyClose === 'boolean' ? row.earlyClose : undefined,
                source: typeof row.source === 'string' ? row.source : undefined,
            } as MarketCalendarEvent;
        }).filter((event): event is MarketCalendarEvent => Boolean(event));

        events.sort((a, b) => a.date.localeCompare(b.date));
        return { events };
    }, [table, windowDays]);
}
