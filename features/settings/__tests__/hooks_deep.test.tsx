import { renderHook, act } from '@testing-library/react-native';
import { useRiskProfile, useDteWindow, useTraderLevel } from '../hooks';
import { renderWithProviders, AllTheProviders } from '@/__tests__/__helpers__/wrappers';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { store } from '@/data/store';

describe('Settings Hooks Deep', () => {
    beforeEach(() => {
        clearTestStore();
        // Initialize defaults
        store.setRow('appSettings', 'main', {
            riskLevel: 'Moderate',
            dteWindow: 'three_weeks',
            traderLevel: 'Intermediate'
        });
    });

    it('should read and update Risk Profile', () => {
        const { result } = renderHook(() => useRiskProfile(), { wrapper: AllTheProviders });
        
        expect(result.current.currentRisk).toBe('Moderate');

        act(() => {
            result.current.setRiskLevel('Aggressive');
        });

        expect(result.current.currentRisk).toBe('Aggressive');
        expect(store.getCell('appSettings', 'main', 'riskLevel')).toBe('Aggressive');
    });

    it('should read and update DTE Window', () => {
        const { result } = renderHook(() => useDteWindow(), { wrapper: AllTheProviders });
        
        expect(result.current.currentDteWindow).toBe('three_weeks');

        act(() => {
            result.current.setDteWindow('one_week');
        });

        expect(result.current.currentDteWindow).toBe('one_week');
        expect(store.getCell('appSettings', 'main', 'dteWindow')).toBe('one_week');
    });

    it('should read and update Trader Level', () => {
        const { result } = renderHook(() => useTraderLevel(), { wrapper: AllTheProviders });
        
        expect(result.current.currentTraderLevel).toBe('Intermediate');

        act(() => {
            result.current.setTraderLevel('Expert');
        });

        expect(result.current.currentTraderLevel).toBe('Expert');
        expect(store.getCell('appSettings', 'main', 'traderLevel')).toBe('Expert');
    });
});
