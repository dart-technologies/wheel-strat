import React from 'react';
import { render } from '@testing-library/react-native';
import TradeCard from '@/features/trades/components/TradeCard';
import { Trade } from '@wheel-strat/shared';

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('TradeCard', () => {
    const mockTrade: Trade = {
        id: '1',
        symbol: 'AAPL',
        type: 'BUY',
        quantity: 10,
        price: 150.00,
        total: 1500.00,
        date: '2023-10-25',
        strategy: 'Buy',
        createdAt: new Date().toISOString()
    };

    it('renders correctly for BUY trade', () => {
        const { getByText } = render(<TradeCard trade={mockTrade} />);

        expect(getByText('AAPL')).toBeTruthy();
        expect(getByText('$1,500.00')).toBeTruthy();
        expect(getByText('10 @ $150.00 · 2023-10-25')).toBeTruthy();
        expect(getByText('Buy')).toBeTruthy();
    });

    it('renders correctly for SELL trade', () => {
        const sellTrade = { ...mockTrade, type: 'SELL' as const };
        const { getByText } = render(<TradeCard trade={sellTrade} />);

        expect(getByText('10 @ $150.00 · 2023-10-25')).toBeTruthy();
        expect(getByText('Sell')).toBeTruthy();
    });
});
