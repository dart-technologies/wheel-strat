import { renderHook, act } from '@testing-library/react-native';
import { useExecuteOpportunity } from '../useExecuteOpportunity';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/features/portfolio/hooks';
import { getOrderGuard } from '@/utils/orderGuards';

// Mock native modules and dependencies
jest.mock('expo-sqlite', () => ({
    openDatabaseSync: jest.fn(() => ({
        execSync: jest.fn(),
        runSync: jest.fn(),
        getFirstSync: jest.fn(),
        getAllSync: jest.fn(),
    })),
}));

jest.mock('tinybase/persisters/persister-expo-sqlite', () => ({
    createExpoSqlitePersister: jest.fn(() => ({
        startAutoLoad: jest.fn(),
        startAutoSave: jest.fn(),
        stopAutoLoad: jest.fn(),
        stopAutoSave: jest.fn(),
    })),
}));

jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            firebase: {}
        }
    }
}));

jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(),
    impactAsync: jest.fn(),
    NotificationFeedbackType: { Warning: 0, Error: 1 },
    ImpactFeedbackStyle: { Light: 0 }
}));

jest.mock('react-native', () => ({
    Alert: {
        alert: jest.fn()
    },
    Platform: {
        OS: 'ios',
        select: jest.fn((obj) => obj.ios || obj.native || obj.default),
    },
}));

jest.mock('@/hooks/useAuth');
jest.mock('@/features/portfolio/hooks');
jest.mock('@/utils/orderGuards');
jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(),
    impactAsync: jest.fn(),
    NotificationFeedbackType: { Warning: 0, Error: 1 },
    ImpactFeedbackStyle: { Light: 0 }
}));

describe('useExecuteOpportunity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            isAuthenticated: true,
            user: { uid: 'user_123' }
        });
        (usePortfolio as jest.Mock).mockReturnValue({
            portfolio: { buyingPower: 10000, cash: 5000 },
            positions: {}
        });
        (getOrderGuard as jest.Mock).mockReturnValue({ allowed: true });
    });

    it('should block execution if not authenticated', () => {
        (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
        const { result } = renderHook(() => useExecuteOpportunity());
        
        act(() => {
            result.current.executeOpportunity({ symbol: 'AAPL', strategy: 'CSP', strike: 150, expiration: '2026-03-20' });
        });

        expect(Alert.alert).toHaveBeenCalledWith("Authentication Required", expect.any(String));
    });

    it('should block execution if strike or expiration is missing', () => {
        const { result } = renderHook(() => useExecuteOpportunity());
        
        act(() => {
            result.current.executeOpportunity({ symbol: 'AAPL', strategy: 'CSP' } as any);
        });

        expect(Alert.alert).toHaveBeenCalledWith("Missing Contract", expect.any(String));
    });

    it('should block execution if order guard fails', () => {
        (getOrderGuard as jest.Mock).mockReturnValue({ allowed: false, message: 'Insufficient Buying Power' });
        const { result } = renderHook(() => useExecuteOpportunity());
        
        act(() => {
            result.current.executeOpportunity({ symbol: 'AAPL', strategy: 'CSP', strike: 150, expiration: '2026-03-20' });
        });

        expect(Alert.alert).toHaveBeenCalledWith("Order Blocked", 'Insufficient Buying Power');
    });

    it('should show confirmation alert if all checks pass', () => {
        const { result } = renderHook(() => useExecuteOpportunity());
        
        act(() => {
            result.current.executeOpportunity({ symbol: 'AAPL', strategy: 'CSP', strike: 150, expiration: '2026-03-20', premium: 2.5 });
        });

        expect(Alert.alert).toHaveBeenCalledWith(
            "Confirm Order",
            expect.stringContaining('AAPL'),
            expect.any(Array)
        );
    });
});
