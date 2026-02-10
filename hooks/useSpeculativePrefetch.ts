import { useEffect, useMemo, useRef } from 'react';
import type { DteWindow, Position, RiskLevel } from '@wheel-strat/shared';
import { getActionableSymbols, prefetchActionablePositions, PREFETCH_COOLDOWN_MS } from '@/services/marketPrefetch';

export function useSpeculativePrefetch(
    positions: Record<string, Position>,
    riskLevel: RiskLevel,
    dteWindow: DteWindow,
    enabled = true
) {
    const actionableSymbols = useMemo(
        () => getActionableSymbols(positions),
        [positions]
    );
    const lastPrefetchAt = useRef(0);

    useEffect(() => {
        if (!enabled) return;
        if (actionableSymbols.length === 0) return;

        const now = Date.now();
        if (now - lastPrefetchAt.current < PREFETCH_COOLDOWN_MS) return;
        lastPrefetchAt.current = now;

        prefetchActionablePositions(actionableSymbols, { riskLevel, dteWindow })
            .catch((error) => {
                console.warn('[prefetch] speculative prefetch failed', error);
            });
    }, [actionableSymbols, enabled, riskLevel, dteWindow]);
}
