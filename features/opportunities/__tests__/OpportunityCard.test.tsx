import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import OpportunityCard from '@/features/opportunities/components/OpportunityCard';
import { placeOrder } from '@/services/trading';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/features/portfolio/hooks';
import { useDteWindow, useRiskProfile } from '@/features/settings/hooks';

// Mock haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error'
    },
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light'
    }
}));

// Mock Analytics
jest.mock('@/services/analytics', () => ({
    Analytics: {
        logStrategyExplanation: jest.fn(),
        logTradeExecution: jest.fn()
    }
}));

// Mock Trading Service
jest.mock('@/services/trading', () => ({
    placeOrder: jest.fn().mockResolvedValue({ orderId: 123, status: 'Submitted' }),
    triggerSync: jest.fn().mockResolvedValue({ data: { success: true, newFills: 1 }, error: null }),
    triggerCommunityPortfolioSync: jest.fn().mockResolvedValue({ data: { success: true, positions: 1, removed: 0, updatedAt: '2026-02-05' }, error: null })
}));

// Mock Auth
jest.mock('@/hooks/useAuth', () => ({
    useAuth: jest.fn()
}));

jest.mock('@/features/portfolio/hooks', () => ({
    usePortfolio: jest.fn()
}));

jest.mock('@/features/settings/hooks', () => ({
    useRiskProfile: jest.fn(),
    useDteWindow: jest.fn()
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('OpportunityCard', () => {
    const defaultProps = {
        symbol: 'AAPL',
        strategy: 'Covered Call',
        strike: 150,
        expiration: '2023-11-17',
        winProb: 75,
        annualizedYield: 12.5,
        explanation: 'Test explanation',
        priority: 1,
        premium: 2.50
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            isAuthenticated: true,
            user: { uid: 'user123' }
        });
        (usePortfolio as jest.Mock).mockReturnValue({
            portfolio: { cash: 1000000, buyingPower: 1000000, netLiq: 1000000 },
            positions: { AAPL: { symbol: 'AAPL', quantity: 100, averageCost: 150, currentPrice: 160 } }
        });
        (useRiskProfile as jest.Mock).mockReturnValue({
            currentRisk: 'Moderate',
            setRiskLevel: jest.fn()
        });
        (useDteWindow as jest.Mock).mockReturnValue({
            currentDteWindow: 'three_weeks',
            setDteWindow: jest.fn()
        });
    });

    it('renders correctly for Covered Call with priority', () => {
        const { getByText } = render(<OpportunityCard {...defaultProps} />);
        
        expect(getByText('AAPL')).toBeTruthy();
        expect(getByText('CC')).toBeTruthy();
        expect(getByText('🥇')).toBeTruthy();
    });

    it('shows sign-in prompt when not authenticated', () => {
        (useAuth as jest.Mock).mockReturnValue({
            isAuthenticated: false,
            user: null
        });

        const { getByText } = render(<OpportunityCard {...defaultProps} />);
        expect(getByText('Sign in to Execute')).toBeTruthy();
    });

    it('handles execute trade flow when authenticated', async () => {
        const { getByText } = render(<OpportunityCard {...defaultProps} />);
        
        const executeBtn = getByText('Execute Trade');
        fireEvent.press(executeBtn);

        expect(Alert.alert).toHaveBeenCalledWith(
            "Confirm Order",
            expect.stringContaining("Place Limit SELL for AAPL"),
            expect.any(Array)
        );

        // @ts-ignore
        const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
        const confirmButton = alertButtons.find((b: any) => b.text === "Submit Order");
        
        await act(async () => {
            await confirmButton.onPress();
        });

        expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining({
            symbol: 'AAPL'
        }), 'user123', 1);
    });
});
