import React from 'react';
import { render } from '@testing-library/react-native';
import AnalystOutlook from '@/features/opportunities/components/opportunity/AnalystOutlook';

describe('AnalystOutlook', () => {
    it('renders scenarios correctly', () => {
        const scenarios = {
            bull: { probability: 60, description: 'Bullish' },
            bear: { probability: 20, description: 'Bearish' },
            sideways: { probability: 20, description: 'Sideways' }
        };

        const { getByText } = render(<AnalystOutlook scenarios={scenarios} />);
        
        expect(getByText('Bull')).toBeTruthy();
        expect(getByText('Bear')).toBeTruthy();
        expect(getByText('Sideways')).toBeTruthy();
        expect(getByText('60')).toBeTruthy();
    });

    it('handles missing scenarios', () => {
        const { getByText } = render(<AnalystOutlook scenarios={undefined} />);
        expect(getByText('Bull')).toBeTruthy();
    });
});
