import React from 'react';
import { render } from '@testing-library/react-native';
import OpportunityHeader from '@/features/opportunities/components/opportunity/Header';
import { Theme } from '@/constants/theme';

describe('OpportunityHeader', () => {
    it('renders correctly with priority badge', () => {
        const { getByText } = render(
            <OpportunityHeader
                symbol="AAPL"
                strategy="Covered Call"
                strike={150}
                priority={1}
                accentColor={Theme.colors.strategyCc}
            />
        );

        expect(getByText('AAPL')).toBeTruthy();
        expect(getByText('$150')).toBeTruthy();
        expect(getByText('🥇')).toBeTruthy();
        expect(getByText('CC')).toBeTruthy();
    });

    it('renders correctly without priority', () => {
        const { getByText, queryByText } = render(
            <OpportunityHeader
                symbol="TSLA"
                strategy="Cash-Secured Put"
                accentColor={Theme.colors.strategyCsp}
            />
        );

        expect(getByText('TSLA')).toBeTruthy();
        expect(queryByText('🥇')).toBeNull();
        expect(getByText('CSP')).toBeTruthy();
    });
});
