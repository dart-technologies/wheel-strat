import { renderHook } from '@testing-library/react-native';
import { useMarketCalendar } from '../useMarketCalendar';
import { AllTheProviders } from '@/__tests__/__helpers__/wrappers';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { store } from '@/data/store';

describe('useMarketCalendar', () => {
    beforeEach(() => {
        clearTestStore();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-08T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should filter events within the window', () => {
        store.setRow('marketCalendar', 'event_1', {
            date: '2026-02-09',
            event: 'CPI Data',
            impact: 'high'
        });
        store.setRow('marketCalendar', 'event_2', {
            date: '2026-03-01', // Outside 7-day window
            event: 'Far Future'
        });

        const { result } = renderHook(() => useMarketCalendar(7), { wrapper: AllTheProviders });

        expect(result.current.events).toHaveLength(1);
        expect(result.current.events[0].event).toBe('CPI Data');
    });

    it('should parse comma-separated symbols', () => {
        store.setRow('marketCalendar', 'event_3', {
            date: '2026-02-10',
            event: 'Tech Earnings',
            symbols: 'AAPL, MSFT ,GOOGL'
        });

        const { result } = renderHook(() => useMarketCalendar(7), { wrapper: AllTheProviders });

        expect(result.current.events[0].symbols).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    it('should return empty list if no events found', () => {
        const { result } = renderHook(() => useMarketCalendar(), { wrapper: AllTheProviders });
        expect(result.current.events).toEqual([]);
    });
});
