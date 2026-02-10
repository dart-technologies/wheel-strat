import React from 'react';
import { render } from '@testing-library/react-native';
import HistoricalChart from '../HistoricalChart';

// Mock Skia and Victory Native
jest.mock('@shopify/react-native-skia', () => ({
    vec: (x: number, y: number) => ({ x, y }),
    LinearGradient: () => 'LinearGradient',
    Rect: () => 'Rect',
    Line: () => 'Line',
    Circle: () => 'Circle',
}));

jest.mock('victory-native', () => ({
    CartesianChart: ({ children, points }: any) => {
        // Mock the render function of CartesianChart
        const chartBounds = { top: 0, bottom: 200, left: 0, right: 300 };
        const yScale = (v: number) => v;
        const xValue = (v: number) => v;
        return children({ points: { close: [] }, chartBounds, yScale, xValue });
    },
    Area: () => 'Area',
    Line: () => 'Line',
    useChartPressState: () => ({
        state: {
            isActive: { value: false },
            x: { position: { value: 0 }, value: { value: 0 } },
            y: { close: { position: { value: 0 }, value: { value: 0 } } },
        }
    }),
}));

// Mock GlassCard
jest.mock('../GlassCard', () => {
    const { View } = jest.requireActual('react-native');
    const MockGlassCard = ({ children }: any) => <View>{children}</View>;
    return MockGlassCard;
});

// Mock DataTierBadge
jest.mock('../DataTierBadge', () => {
    const { Text } = jest.requireActual('react-native');
    const MockDataTierBadge = ({ label }: any) => <Text>{label}</Text>;
    return MockDataTierBadge;
});

describe('HistoricalChart', () => {
    const mockData = [
        { date: '2026-02-01', close: 100 },
        { date: '2026-02-02', close: 105 },
    ];

    it('renders without crashing with basic data', () => {
        const { getByText } = render(
            <HistoricalChart data={mockData} symbol="AAPL" />
        );
        expect(getByText('AAPL 1Y Performance')).toBeTruthy();
    });

    it('handles undefined displayClose gracefully', () => {
        // By default displayClose will be the last item's close (105)
        const { getByText } = render(
            <HistoricalChart data={mockData} symbol="AAPL" />
        );
        expect(getByText('$105.00')).toBeTruthy();
    });

    it('handles empty data gracefully', () => {
        const { getByText } = render(
            <HistoricalChart data={[]} symbol="AAPL" />
        );
        expect(getByText('No historical data available')).toBeTruthy();
    });

    it('renders event markers with unique keys (internal check)', () => {
        const events = [
            { date: '2026-02-01', label: 'Event 1' },
            { date: '2026-02-01', label: 'Event 2' },
        ];
        
        // This test mostly ensures the component renders with multiple events on same day
        // If there were duplicate keys, it might warn or error in some environments,
        // but here we just verify it doesn't crash.
        const { getByText } = render(
            <HistoricalChart data={mockData} symbol="AAPL" events={events} />
        );
        expect(getByText('AAPL 1Y Performance')).toBeTruthy();
    });
});
