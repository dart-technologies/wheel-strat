import React from 'react';
import { render } from '@testing-library/react-native';
import YieldMeta from '@/features/portfolio/components/YieldMeta';

describe('YieldMeta', () => {
    it('renders correctly with all props', () => {
        const { getByText } = render(
            <YieldMeta
                label="CSP Yield"
                yieldValue={15.5}
                premium={250}
                strike={100}
                medal="🥇"
            />
        );

        expect(getByText('CSP Yield')).toBeTruthy();
        expect(getByText('🥇 15.5%')).toBeTruthy();
        expect(getByText('$250.00 @ $100.00')).toBeTruthy();
    });

    it('renders correctly with minimal props', () => {
        const { getByText } = render(
            <YieldMeta
                yieldValue={10}
            />
        );

        expect(getByText('10.0%')).toBeTruthy();
    });
});
