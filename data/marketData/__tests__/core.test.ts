import { applyLiveOptionMarketData, applyOpportunityMarketData } from '../core';
import type { MarketDataStore } from '../types';

const createMockStore = (tables: Record<string, Record<string, Record<string, any>>>) => {
    const ensureRow = (tableId: string, rowId: string) => {
        if (!tables[tableId]) tables[tableId] = {};
        if (!tables[tableId][rowId]) tables[tableId][rowId] = {};
        return tables[tableId][rowId];
    };

    const store: MarketDataStore & { tables: typeof tables } = {
        tables,
        getRow: (tableId, rowId) => tables[tableId]?.[rowId] || {},
        setRow: (tableId, rowId, row) => {
            if (!tables[tableId]) tables[tableId] = {};
            tables[tableId][rowId] = row;
            return store;
        },
        setCell: (tableId, rowId, cellId, value) => {
            const row = ensureRow(tableId, rowId);
            row[cellId] = value;
            return store;
        },
        delCell: (tableId, rowId, cellId) => {
            if (!tables[tableId]?.[rowId]) return store;
            delete tables[tableId][rowId][cellId];
            return store;
        },
        getTable: (tableId) => tables[tableId] || {},
        transaction: (actions) => actions()
    };

    return store;
};

describe('marketData core', () => {
    it('applies opportunity prices and updates net liq', () => {
        const store = createMockStore({
            portfolio: { main: { cash: 1000, netLiq: 0 } },
            positions: { AAPL: { symbol: 'AAPL', quantity: 2, averageCost: 10, currentPrice: 10 } }
        });

        const snapshot = applyOpportunityMarketData([
            { symbol: 'AAPL', strategy: 'Covered Call', strike: 1, expiration: '2026-01-01', premium: 1, winProb: 50, ivRank: 20, reasoning: '', currentPrice: 12 }
        ], store);

        expect(snapshot.updatedSymbols).toEqual(['AAPL']);
        expect(store.tables.positions.AAPL.currentPrice).toBe(12);
        expect(store.tables.portfolio.main.netLiq).toBe(1024);
    });

    it('applies live option legs and clears missing legs', () => {
        const store = createMockStore({
            portfolio: { main: { cash: 0, netLiq: 0 } },
            positions: {
                TSLA: { symbol: 'TSLA', quantity: 1, averageCost: 100, currentPrice: 100, cspYield: 4.5 }
            }
        });

        const snapshot = applyLiveOptionMarketData([
            {
                symbol: 'TSLA',
                currentPrice: 110,
                csp: null,
                cc: {
                    strike: 120,
                    expiration: '2026-02-06',
                    premium: 5,
                    annualizedYield: 12.5,
                    premiumSource: 'mid'
                }
            }
        ], store);

        expect(snapshot.updatedSymbols).toEqual(['TSLA']);
        expect(store.tables.positions.TSLA.currentPrice).toBe(110);
        expect(store.tables.positions.TSLA.cspYield).toBeUndefined();
        expect(store.tables.positions.TSLA.ccYield).toBe(12.5);
        expect(store.tables.positions.TSLA.ccPremium).toBe(5);
        expect(store.tables.positions.TSLA.ccStrike).toBe(120);
        expect(store.tables.portfolio.main.netLiq).toBe(110);
    });
});
