import React from 'react';
import { render } from '@testing-library/react-native';
import FreshnessIndicator from '../FreshnessIndicator';


// Mock Ionicons and Reanimated
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons'
}));

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('FreshnessIndicator', () => {
    it('renders "--" when lastUpdated is null', () => {
        const { getByText } = render(<FreshnessIndicator lastUpdated={null} />);
        expect(getByText('--')).toBeTruthy();
    });

    it('renders "--" when lastUpdated is undefined', () => {
        const { getByText } = render(<FreshnessIndicator lastUpdated={undefined} />);
        expect(getByText('--')).toBeTruthy();
    });

    it('renders formatted time correctly', () => {
        const now = new Date();
        const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const { getByText } = render(<FreshnessIndicator lastUpdated={tenMinsAgo} />);
        
        // Should show "10m" (lowercase, compact)
        expect(getByText('10m')).toBeTruthy();
    });

    it('renders "now" for very recent updates', () => {
        const now = new Date();
        const { getByText } = render(<FreshnessIndicator lastUpdated={now} />);
        expect(getByText('now')).toBeTruthy();
    });
});
