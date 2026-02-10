import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import Strategies from '../strategies';

// Mocks
jest.mock('../../../services/firebase', () => ({
    db: {},
    functions: {}
}));

jest.mock('firebase/functions', () => ({
    httpsCallable: jest.fn()
}));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getDocs: (q: any) => mockGetDocs(q),
    onSnapshot: jest.fn((q, onNext) => {
        const promise = mockGetDocs(q);
        if (promise && typeof promise.then === 'function') {
            promise.then((snapshot: any) => {
                if (onNext) onNext(snapshot);
            }).catch(() => { });
        }
        return jest.fn(); // Unsubscribe
    }),
    doc: jest.fn()
}));

// Mocks for hooks
const mockUseOpportunities = jest.fn();
const mockUseOpportunitySynopsis = jest.fn();
const mockUseScanPortfolio = jest.fn();
const mockUsePortfolio = jest.fn();
const mockUseReport = jest.fn();
const mockUseLatestReport = jest.fn();

jest.mock('../../../features/portfolio/hooks', () => ({
    __esModule: true,
    usePortfolio: () => mockUsePortfolio(),
    useSortedPositions: jest.fn().mockReturnValue([]),
    usePortfolioPerformance: jest.fn().mockReturnValue({ totalNetLiq: 0, totalReturn: 0, totalReturnPct: 0 })
}));

jest.mock('../../../features/opportunities/hooks', () => ({
    __esModule: true,
    useScanPortfolio: () => mockUseScanPortfolio(),
    useOpportunities: () => mockUseOpportunities(),
    useOpportunitySynopsis: () => mockUseOpportunitySynopsis()
}));

jest.mock('../../../features/reports/hooks', () => ({
    __esModule: true,
    useReport: (id?: string) => mockUseReport(id),
    useLatestReport: (enabled?: boolean) => mockUseLatestReport(enabled)
}));

jest.mock('@/data/store', () => ({
    store: {
        getRow: jest.fn().mockReturnValue({ cash: 10000 }),
        getTable: jest.fn().mockReturnValue({})
    }
}));

// Mock components
jest.mock('../../../components/StrategyExplainer', () => 'StrategyExplainer');
jest.mock('../../../components/PageHeader', () => {
    const { View, Text } = jest.requireActual('react-native');
    const PageHeaderMock = (props: any) => (
        <View>
            <Text>{props.title}</Text>
        </View>
    );
    PageHeaderMock.displayName = 'PageHeaderMock';
    return PageHeaderMock;
});

jest.mock('../../../components/AnimatedLayout', () => ({ children }: any) => children);
jest.mock('../../../components/Skeleton', () => ({
    SkeletonCard: () => 'SkeletonCard'
}));
jest.mock('../../../components/SegmentedControl', () => {
    const { View, Pressable, Text } = jest.requireActual('react-native');
    const SegmentedControlMock = (props: any) => (
        <View testID="segmented-control">
            {props.options.map((option: string, index: number) => (
                <Pressable key={option} onPress={() => props.onChange(index)}>
                    <Text>{option}</Text>
                </Pressable>
            ))}
        </View>
    );
    SegmentedControlMock.displayName = 'SegmentedControlMock';
    return SegmentedControlMock;
});
jest.mock('../../../components/GlassCard', () => {
    const { View } = jest.requireActual('react-native');
    const GlassCardMock = ({ children }: any) => <View>{children}</View>;
    GlassCardMock.displayName = 'GlassCardMock';
    return GlassCardMock;
});

// Mock Icon
jest.mock('@expo/vector-icons', () => ({
    Ionicons: ({ name }: any) => `Icon-${name}`
}));

describe('Strategies Screen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
        mockUseOpportunities.mockReturnValue({ opportunities: [], loading: false });
        mockUseOpportunitySynopsis.mockReturnValue({ synopsis: null, loading: false });
        mockUseScanPortfolio.mockReturnValue({ scanning: false, runScan: jest.fn() });
        mockUsePortfolio.mockReturnValue({ positions: {}, portfolio: { cash: 10000 } });
        mockUseReport.mockReturnValue({ report: null, loading: false });
        mockUseLatestReport.mockReturnValue({ report: null, loading: false });
    });

    it('renders and fetches opportunities', async () => {
        mockUseOpportunities.mockReturnValue({
            opportunities: [{
                symbol: 'NVDA',
                strategy: 'Covered Call',
                strike: 500,
                expiration: '2026-01-01',
                premium: 10,
                winProb: 0.7,
                annualizedYield: 0.2,
                reasoning: 'Good setup',
                priority: 1,
                analysis: 'Analysis text'
            }],
            loading: false
        });
        mockUseOpportunitySynopsis.mockReturnValue({ synopsis: 'Institutional Thesis text', loading: false });

        const { getByText } = render(<Strategies />);

        expect(getByText('Strategies')).toBeTruthy();

        // Check synopsis on analysis tab (default)
        await waitFor(() => {
            expect(getByText('Institutional Thesis text')).toBeTruthy();
        });

        // Switch to Top 1 tab
        fireEvent.press(getByText('🥇'));

        await waitFor(() => {
            expect(getByText('NVDA')).toBeTruthy();
            expect(getByText(/Covered Call/)).toBeTruthy();
        });
    });

    it('shows empty state info card', async () => {
        mockUseOpportunitySynopsis.mockReturnValue({ synopsis: null, loading: false });

        const { getByText } = render(<Strategies />);

        await waitFor(() => {
            expect(getByText(/No analysis available/i)).toBeTruthy();
        });
    });
});
