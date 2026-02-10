import { useMemo } from 'react';
import { getMarketStatus } from '@/utils/marketHours';
import { coerceToDate, formatTimeSince, DateInput } from '@/utils/time';

export interface FreshnessState {
    isStale: boolean;
    needsHardRefresh: boolean;
    ageLabel: string;
}

/**
 * Centralized hook to determine data freshness based on premium requirements:
 * - Stale: > 15 minutes when market is open
 * - Needs Hard Refresh: > 60 minutes when market is open
 */
export function useDataFreshness(timestamp?: DateInput): FreshnessState {
    const marketStatus = getMarketStatus();
    
    return useMemo(() => {
        const date = coerceToDate(timestamp);
        if (!date || typeof date.getTime !== 'function') {
            return { isStale: true, needsHardRefresh: true, ageLabel: 'Never' };
        }

        const diffMs = Date.now() - date.getTime();
        const diffMins = diffMs / 60000;

        const isStale = marketStatus.isOpen && diffMins > 15;
        const needsHardRefresh = marketStatus.isOpen && diffMins > 60;

        return {
            isStale,
            needsHardRefresh,
            ageLabel: formatTimeSince(date)
        };
    }, [timestamp, marketStatus.isOpen]);
}
