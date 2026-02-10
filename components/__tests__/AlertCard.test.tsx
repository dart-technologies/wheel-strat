import React from 'react';
import { render } from '@testing-library/react-native';
import AlertCard from '../AlertCard';

// Mock GlassCard
jest.mock('../GlassCard', () => {
    const { View } = jest.requireActual('react-native');
    const MockGlassCard = ({ children }: any) => <View>{children}</View>;
    return MockGlassCard;
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => 'Icon',
}));

describe('AlertCard', () => {
    const defaultProps = {
        symbol: 'TSLA',
        changePercent: -5.234,
        previousClose: 200.0,
        currentPrice: 189.532,
        suggestedStrategy: 'Sell CSP at $180'
    };

    it('renders with formatted values', () => {
        const { getByText } = render(<AlertCard {...defaultProps} />);
        
        expect(getByText('TSLA')).toBeTruthy();
        expect(getByText('-5.23%')).toBeTruthy();
        expect(getByText('$200.00')).toBeTruthy();
        expect(getByText('$189.53')).toBeTruthy();
        expect(getByText('Sell CSP at $180')).toBeTruthy();
    });

    it('handles undefined or null values gracefully', () => {
        // We cast to any to test the safety of the component when props might be missing at runtime
        const propsWithMissingValues: any = {
            symbol: 'TSLA',
            suggestedStrategy: 'Strategy'
        };

        const { getByText, getAllByText } = render(<AlertCard {...propsWithMissingValues} />);
        
        // Should use 0.00 as default for numerical values that are missing
        expect(getByText('0.00%')).toBeTruthy();
        expect(getAllByText('$0.00').length).toBe(2); // Previous and Current
    });
});
