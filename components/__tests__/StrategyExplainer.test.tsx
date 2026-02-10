import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import StrategyExplainer from '../StrategyExplainer';

// Mocks
const mockExplainTrade = jest.fn();
// We reuse the mock variable by assigning it in the mock factory
jest.mock('../../services/api', () => ({
    explainTrade: (...args: any[]) => mockExplainTrade(...args)
}));

// Aggressive mocking of firebase to prevent ESM issues
jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
}));
jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(),
    httpsCallable: jest.fn(),
}));
// End aggressive mocking
// but if the component imports it directly, we might need to mock it still.
// However, the error is likely from api.ts importing firebase.
// Let's verify imports in the component.

// Mock BlurView as it often causes issues in tests
jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: ({ name }: any) => `Icon-${name}`
}));

// Mock GlassCard to avoid expo-glass-effect issues
jest.mock('../GlassCard', () => {
    const { View } = jest.requireActual('react-native');
    const GlassCardMock = ({ children }: any) => <View>{children}</View>;
    GlassCardMock.displayName = 'GlassCardMock';
    return GlassCardMock;
});

// Mock HistoricalChart
jest.mock('../HistoricalChart', () => {
    const { View } = jest.requireActual('react-native');
    const HistoricalChartMock = () => <View testID="historical-chart" />;
    HistoricalChartMock.displayName = 'HistoricalChartMock';
    return HistoricalChartMock;
});

jest.mock('../PayoffChart', () => {
    const { View } = jest.requireActual('react-native');
    const PayoffChartMock = () => <View testID="payoff-chart" />;
    PayoffChartMock.displayName = 'PayoffChartMock';
    return PayoffChartMock;
});

jest.mock('../../features/settings/hooks', () => ({
    useTraderLevel: () => ({ currentTraderLevel: 'Intermediate', setTraderLevel: jest.fn() })
}));

describe('StrategyExplainer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const tradeContext = {
        symbol: 'AAPL',
        strategy: 'Covered Call',
        strike: 150,
        expiration: '2026-01-01',
        premium: 5.0
    };

    it('fetches explanation on mount', async () => {
        mockExplainTrade.mockResolvedValue({
            data: {
                explanation: 'AI Generated Explanation',
                generatedAt: new Date().toISOString(),
                cached: false,
                cacheAge: 0
            },
            error: null
        });

        const { getByText } = render(
            <StrategyExplainer
                isVisible={true}
                onClose={jest.fn()}
                tradeContext={tradeContext}
            />
        );

        expect(getByText('Strategy Breakdown')).toBeTruthy();
        expect(getByText('AAPL')).toBeTruthy();

        // Wait for data
        await waitFor(() => {
            expect(getByText('AI Generated Explanation')).toBeTruthy();
        });

        expect(mockExplainTrade).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                forceRefresh: false
            })
        );
    });

    it('displays error state', async () => {
        mockExplainTrade.mockResolvedValue({
            data: null,
            error: new Error('Network error')
        });

        const { getByText } = render(
            <StrategyExplainer
                isVisible={true}
                onClose={jest.fn()}
                tradeContext={tradeContext}
            />
        );

        await waitFor(() => {
            expect(getByText('Failed to generate explanation. Please try again.')).toBeTruthy();
        });
    });
});
