import React from 'react';
import { render } from '@testing-library/react-native';
import PositionCard from '@/features/portfolio/components/PositionCard';

describe('PositionCard', () => {
    const defaultProps = {
        symbol: 'AAPL',
        quantity: 100,
        averageCost: 150.00,
        currentPrice: 155.00,
        closePrice: 152.00,
    };

    it('renders basic position details correctly', () => {
        const { getByText } = render(<PositionCard {...defaultProps} />);
        
        expect(getByText('AAPL')).toBeTruthy();
        expect(getByText('100 shares • Avg $150.00')).toBeTruthy();
        expect(getByText('Cost Basis $15,000.00')).toBeTruthy();
        expect(getByText('$155.00')).toBeTruthy();
        // 3.3% gain
        expect(getByText('3.3%')).toBeTruthy();
        expect(getByText('Day')).toBeTruthy();
        expect(getByText('+$300.00')).toBeTruthy();
    });

    it('renders yield sections when data provided', () => {
        const { getByText } = render(
            <PositionCard 
                {...defaultProps}
                cspYield={12.5}
                cspStrike={140}
                ccYield={8.2}
                ccStrike={160}
            />
        );

        expect(getByText('CSP Yield')).toBeTruthy();
        expect(getByText('12.5%')).toBeTruthy();
        expect(getByText('Strike $140.00')).toBeTruthy();

        expect(getByText('CC Yield')).toBeTruthy();
        expect(getByText('8.2%')).toBeTruthy();
        expect(getByText('Strike $160.00')).toBeTruthy();
    });
});
