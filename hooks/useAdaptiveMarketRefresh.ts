import { useEffect, useMemo, useRef, useState } from 'react';
import type { DteWindow } from '@wheel-strat/shared';
import { refreshLiveOptionData } from '@/data/marketData';
import { useAppState } from '@/hooks/useAppState';

type AdaptiveRefreshOptions = {
    symbols: string[];
    enabled?: boolean;
    targetWinProb: number;
    dteWindow?: DteWindow;
};

const WIFI_INTERVAL_MS = 15000;
const CELLULAR_INTERVAL_MS = 30000;
const DEFAULT_INTERVAL_MS = 20000;

export function useAdaptiveMarketRefresh({
    symbols,
    enabled = true,
    targetWinProb,
    dteWindow
}: AdaptiveRefreshOptions) {
    const appState = useAppState();
    const [connectionType, setConnectionType] = useState<string | null>(null);
    const inflightRef = useRef(false);

    useEffect(() => {
        let isMounted = true;
        const connection = (globalThis as any)?.navigator?.connection;
        const resolveType = () => {
            if (!connection) return null;
            const type = connection.type || connection.effectiveType;
            return typeof type === 'string' ? type : null;
        };
        if (isMounted) {
            setConnectionType(resolveType());
        }
        const handler = () => {
            if (isMounted) {
                setConnectionType(resolveType());
            }
        };
        if (connection?.addEventListener) {
            connection.addEventListener('change', handler);
        }
        return () => {
            isMounted = false;
            if (connection?.removeEventListener) {
                connection.removeEventListener('change', handler);
            }
        };
    }, []);

    const symbolsKey = useMemo(() => (
        symbols.map((symbol) => symbol.toUpperCase()).sort().join('|')
    ), [symbols]);

    const normalizedSymbols = useMemo(() => (
        symbolsKey ? symbolsKey.split('|').filter(Boolean) : []
    ), [symbolsKey]);

    const intervalMs = useMemo(() => {
        if (!enabled) return null;
        if (appState !== 'active') return null;
        if (connectionType === 'none' || connectionType === 'unknown') return null;
        if (connectionType === 'wifi' || connectionType === 'ethernet') return WIFI_INTERVAL_MS;
        if (connectionType === 'cellular') return CELLULAR_INTERVAL_MS;
        return DEFAULT_INTERVAL_MS;
    }, [enabled, appState, connectionType]);

    useEffect(() => {
        if (!intervalMs) return;
        if (!symbolsKey) return;
        let cancelled = false;
        const tick = async () => {
            if (cancelled || inflightRef.current) return;
            inflightRef.current = true;
            try {
                if (normalizedSymbols.length === 0) return;
                await refreshLiveOptionData(normalizedSymbols, targetWinProb, dteWindow, undefined, {
                    source: 'adaptive_refresh',
                    logThresholdMs: 3000,
                    skipGreeks: true
                });
            } catch (error) {
                console.warn('Adaptive refresh failed:', error);
            } finally {
                inflightRef.current = false;
            }
        };
        tick();
        const interval = setInterval(tick, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [intervalMs, symbolsKey, normalizedSymbols, targetWinProb, dteWindow]);
}
