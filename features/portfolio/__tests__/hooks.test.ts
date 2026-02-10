import { renderHook, act } from '@testing-library/react-native';
import { usePortfolio, useGroupedPositions, useRealizedPnL } from '../hooks';
import { AllTheProviders } from '@/__tests__/__helpers__/wrappers';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { store } from '@/data/store';
import { Trade } from '@wheel-strat/shared';

describe('Portfolio Hooks', () => {
    beforeEach(() => {
        clearTestStore();
    });

    it('should return portfolio and positions data', () => {
        store.setRow('portfolio', 'main', { cash: 5000, netLiq: 15000 });
        store.setRow('positions', 'AAPL', { symbol: 'AAPL', quantity: 10, averageCost: 150 });

        const { result } = renderHook(() => usePortfolio(), { wrapper: AllTheProviders });

        expect(result.current.portfolio.cash).toBe(5000);
        expect(result.current.positions['AAPL']).toBeDefined();
        expect(result.current.positions['AAPL'].quantity).toBe(10);
    });

    it('should group stock and options by symbol', () => {
        store.setRow('positions', 'NVDA', { symbol: 'NVDA', quantity: 100, averageCost: 400 });
        store.setRow('optionPositions', 'opt_1', { symbol: 'NVDA', quantity: -1, strike: 450, right: 'C' });

        const { result } = renderHook(() => useGroupedPositions(), { wrapper: AllTheProviders });

        const nvdaGroup = result.current.find(g => g.symbol === 'NVDA');
        expect(nvdaGroup).toBeDefined();
        expect(nvdaGroup?.stock).toBeDefined();
        expect(nvdaGroup?.options).toHaveLength(1);
    });

    it('should calculate realized P&L from trades', () => {
        const trades: Record<string, Trade> = {
            t1: { id: 't1', symbol: 'AAPL', type: 'BUY', quantity: 10, price: 100, date: '2026-01-01', total: 1000 },
            t2: { id: 't2', symbol: 'AAPL', type: 'SELL', quantity: 10, price: 120, date: '2026-01-02', total: 1200 },
        };

        Object.entries(trades).forEach(([id, trade]) => {
            store.setRow('trades', id, trade as any);
        });

        const { result } = renderHook(() => useRealizedPnL(), { wrapper: AllTheProviders });

        expect(result.current.realizedPnL).toBe(200); // (120 - 100) * 10
    });
});
