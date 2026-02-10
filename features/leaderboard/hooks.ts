import { useCallback, useEffect, useState, useRef } from 'react';
import { LeaderboardEntry } from '@wheel-strat/shared';
import { fetchLeaderboard } from '@/services/api';
import { store } from '@/data/store';

export function useLeaderboard() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(() => {
        const stored = store.getCell('syncMetadata', 'main', 'lastLeaderboardUpdate');
        return stored ? new Date(String(stored)) : null;
    });
    const lastFetchTime = useRef<number>(0);

    const refresh = useCallback(async (force = false) => {
        // 1. Check persistence before fetching
        const lastUpdate = store.getCell('syncMetadata', 'main', 'lastLeaderboardUpdate');
        const lastUpdateMs = lastUpdate ? new Date(String(lastUpdate)).getTime() : 0;
        const now = Date.now();
        
        // Skip fetch if fresh enough (5 mins) unless forced or empty
        if (!force && (now - lastUpdateMs < 300000) && entries.length > 0) {
            return;
        }

        setLoading(true);
        setError(null);
        lastFetchTime.current = now;

        const result = await fetchLeaderboard(force);
        if (result.error) {
            setError(result.error.message);
            setLoading(false);
            return;
        }

        const data = result.data;

        const sorted = [...(data?.leaderboard ?? [])].sort((a, b) => {
            const aYield = Number.isFinite(a.yieldPct) ? a.yieldPct : -Infinity;
            const bYield = Number.isFinite(b.yieldPct) ? b.yieldPct : -Infinity;
            if (aYield !== bYield) return bYield - aYield;
            return (b.tradeCount || 0) - (a.tradeCount || 0);
        });
        
        setEntries(sorted);
        
        // Use server provided timestamp if available, otherwise use now to indicate a successful check
        const nextUpdate = data?.updatedAt ? new Date(data.updatedAt) : new Date();
        const nextUpdateIso = nextUpdate.toISOString();
        
        setUpdatedAt(nextUpdate);
        store.setCell('syncMetadata', 'main', 'lastLeaderboardUpdate', nextUpdateIso);
        
        setLoading(false);
    }, [entries.length]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { entries, loading, error, updatedAt, refresh };
}
