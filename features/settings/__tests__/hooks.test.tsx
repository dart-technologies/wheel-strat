import { renderHook, act } from '@testing-library/react-native';
import { useRiskProfile, useTraderLevel, useDteWindow, useAnalysisStaleness } from '../hooks';
import { store } from '@/data/store';
import { Provider } from 'tinybase/ui-react';
import React from 'react';

jest.mock('@/data/store', () => {
    const { createStore } = jest.requireActual('tinybase');
    return {
        store: createStore()
    };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
);

describe('settings hooks', () => {
    beforeEach(() => {
        store.delTable('appSettings');
    });

    describe('useRiskProfile', () => {
        it('returns default and updates', () => {
            const { result } = renderHook(() => useRiskProfile(), { wrapper });
            
            expect(result.current.currentRisk).toBe('Moderate');

            act(() => {
                result.current.setRiskLevel('Aggressive');
            });

            expect(result.current.currentRisk).toBe('Aggressive');
            expect(store.getCell('appSettings', 'main', 'riskLevel')).toBe('Aggressive');
        });
    });

    describe('useTraderLevel', () => {
        it('returns default and updates', () => {
            const { result } = renderHook(() => useTraderLevel(), { wrapper });
            expect(result.current.currentTraderLevel).toBe('Intermediate');

            act(() => {
                result.current.setTraderLevel('Expert');
            });

            expect(result.current.currentTraderLevel).toBe('Expert');
        });
    });

    describe('useDteWindow', () => {
        it('returns default and updates', () => {
            const { result } = renderHook(() => useDteWindow(), { wrapper });
            
            const validOption = 'five_weeks'; 

            act(() => {
                result.current.setDteWindow(validOption);
            });

            expect(result.current.currentDteWindow).toBe(validOption);
        });
    });

    describe('useAnalysisStaleness', () => {
        it('detects fresh data', () => {
            store.setRow('appSettings', 'main', {
                analysisUpdatedAt: new Date().toISOString(),
                analysisRiskLevel: 'Moderate',
                analysisTraderLevel: 'Intermediate',
                analysisDteWindow: 'three_weeks', 
                riskLevel: 'Moderate',
                traderLevel: 'Intermediate',
                dteWindow: 'three_weeks'
            });

            const { result } = renderHook(() => useAnalysisStaleness(), { wrapper });
            expect(result.current.isStale).toBe(false);
        });

        it('detects stale data due to settings mismatch', () => {
            // Setup a scenario where the settings DO NOT match
            // To be stale, we need a snapshot timestamp AND settings difference
            
            store.setRow('appSettings', 'main', {
                // Snapshot exists
                analysisUpdatedAt: new Date().toISOString(),
                // Snapshot parameters
                analysisRiskLevel: 'Conservative',
                // Current parameters (defaults)
                riskLevel: 'Moderate'
            });
            
            const { result } = renderHook(() => useAnalysisStaleness(), { wrapper });
            expect(result.current.isStale).toBe(true);
        });
    });
});
