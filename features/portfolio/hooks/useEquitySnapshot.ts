import { useEffect } from 'react';
import { store } from '@/data/store';

export function useEquitySnapshot(netLiq?: number) {
    useEffect(() => {
        const netLiqValue = Number(netLiq);
        if (!Number.isFinite(netLiqValue) || netLiqValue <= 0) return;
        const today = new Date().toISOString().slice(0, 10);
        const lastSnapshot = store.getCell('syncMetadata', 'main', 'lastEquitySnapshot');
        if (lastSnapshot === today) return;
        const existing = store.getRow('equityCurve', today);
        if (!existing || !existing.date) {
            store.setRow('equityCurve', today, {
                date: today,
                netLiq: netLiqValue,
                createdAt: new Date().toISOString()
            });
        }
        store.setCell('syncMetadata', 'main', 'lastEquitySnapshot', today);
    }, [netLiq]);
}
