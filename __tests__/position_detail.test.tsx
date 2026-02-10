import React from 'react';
import { renderWithProviders } from '@/__tests__/__helpers__/wrappers';
import PositionDetail from '../app/position/[symbol]';

// Mock expo-router
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ symbol: 'NVDA' }),
    useRouter: () => ({ back: jest.fn() }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 0 },
}));

// Mock other dependencies
jest.mock('@/components/AnimatedLayout', () => ({ children }: any) => children);
jest.mock('@/components/HistoricalChart', () => () => null);
jest.mock('@/components/RiskSpeedometer', () => () => null);
jest.mock('@/features/portfolio/components/WheelActionDetailModal', () => () => null);
jest.mock('@/components/PayoffGlyph', () => () => null);
jest.mock('@/features/portfolio/components/YieldMeta', () => () => null);
jest.mock('@/components/SegmentedControl', () => () => null);
jest.mock('@/components/DataTierBadge', () => () => null);

const mockUsePosition = jest.fn().mockReturnValue({
    symbol: 'NVDA',
    quantity: 100,
    averageCost: 100.0,
    currentPrice: 110.0,
    ccYield: 15.5,
    cspYield: 22.1
});

jest.mock('@/features/portfolio/hooks', () => ({
    usePosition: (symbol: string) => mockUsePosition(symbol),
    useOptionPositionsForSymbol: () => []
}));

jest.mock('@/features/settings/hooks', () => ({
    useRiskProfile: () => ({ currentRisk: 'Moderate' }),
    useDteWindow: () => ({ currentDteWindow: '30-45 Days' })
}));

jest.mock('@/hooks/useMarketStatus', () => ({
    useMarketStatus: () => ({ isOpen: true })
}));

jest.mock('@/hooks/useDataFreshness', () => ({
    useDataFreshness: () => ({ isStale: false, ageLabel: 'Live', needsHardRefresh: false })
}));

jest.mock('@/hooks/useMarketCalendar', () => ({
    useMarketCalendar: () => ({ events: [] })
}));

describe('PositionDetail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUsePosition.mockReturnValue({
            symbol: 'NVDA',
            quantity: 100,
            averageCost: 100.0,
            currentPrice: 110.0,
            ccYield: 15.5,
            cspYield: 22.1
        });
    });

    it('renders position details correctly', () => {
        const { getByText, getAllByText } = renderWithProviders(<PositionDetail />);
        
        expect(getByText('NVDA Position')).toBeTruthy();
        expect(getAllByText('$11,000').length).toBeGreaterThan(0); // 100 * 110
        expect(getByText('+10.0%')).toBeTruthy(); // (110-100)/100
        expect(getByText(/Avg \$100\.00.*\$110\.00/)).toBeTruthy(); // avg + current
    });

    it('handles missing position data gracefully', () => {
        mockUsePosition.mockReturnValue(undefined);

        const { getByText } = renderWithProviders(<PositionDetail />);
        expect(getByText('Position not found')).toBeTruthy();
    });
});
