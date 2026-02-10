import React from 'react';
import { render } from '@testing-library/react-native';
import TechnicalLevels from '@/features/opportunities/components/opportunity/TechnicalLevels';

describe('TechnicalLevels', () => {
    it('renders key levels and pattern', () => {
        const technicals = {
            support: { level: 100 },
            resistance: { level: 110 },
            pattern: 'Double Bottom'
        };

        const { getByText } = render(
            <TechnicalLevels 
                symbol="AAPL" 
                currentPrice={105} 
                technicals={technicals} 
            />
        );

        expect(getByText('S: 100')).toBeTruthy();
        expect(getByText('R: 110')).toBeTruthy();
        expect(getByText('Double Bottom')).toBeTruthy();
    });

    it('renders range visualization', () => {
        const metrics = {
            yearLow: 80,
            yearHigh: 120
        };

        const { getByText } = render(
            <TechnicalLevels 
                symbol="TSLA" 
                currentPrice={100} 
                metrics={metrics} 
            />
        );

        expect(getByText('52W Low: $80')).toBeTruthy();
        expect(getByText('High: $120')).toBeTruthy();
    });
});
