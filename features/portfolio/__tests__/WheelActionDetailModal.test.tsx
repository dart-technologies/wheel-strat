import React from 'react';
import { renderWithProviders } from '@/__tests__/__helpers__/wrappers';
import WheelActionDetailModal from '../components/WheelActionDetailModal';

// Mock dependencies
jest.mock('@/hooks/useExecuteOpportunity', () => ({
    useExecuteOpportunity: () => ({
        executeOpportunity: jest.fn(),
        executing: false
    })
}));

jest.mock('@/features/settings/hooks', () => ({
    useRiskProfile: () => ({ currentRisk: 'Moderate' })
}));

describe('WheelActionDetailModal', () => {
    const defaultProps = {
        isVisible: true,
        onClose: jest.fn(),
        symbol: 'NVDA',
        strategy: 'Cash-Secured Put',
        strike: 100,
        expiration: '2026-03-20',
        premium: 5.50,
        yield: '45.2%',
        winProb: '72%',
        greeks: {
            delta: -0.25,
            theta: 0.15
        }
    };

    it('should render basic opportunity details', () => {
        const { getByText } = renderWithProviders(<WheelActionDetailModal {...defaultProps} />);
        
        expect(getByText('Cash-Secured Put')).toBeTruthy();
        expect(getByText('NVDA • 2026-03-20 • $100 Strike')).toBeTruthy();
        expect(getByText('$550')).toBeTruthy(); // 5.50 * 100
    });

    it('should handle missing premium gracefully', () => {
        const propsWithMissingPremium = {
            ...defaultProps,
            premium: undefined as any
        };

        const { getByText } = renderWithProviders(<WheelActionDetailModal {...propsWithMissingPremium} />);
        
        expect(getByText('$0')).toBeTruthy(); // Default to 0 * 100
    });
});
