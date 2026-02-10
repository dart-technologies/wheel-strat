import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../useAuth';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { AllTheProviders } from '@/__tests__/__helpers__/wrappers';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { store } from '@/data/store';
import Constants from 'expo-constants';

jest.mock('@react-native-firebase/auth', () => ({
    getAuth: jest.fn(),
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn(),
}));

jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            launchArgs: {}
        }
    }
}));

describe('useAuth', () => {
    let authCallback: any;

    beforeEach(() => {
        clearTestStore();
        jest.clearAllMocks();
        (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
            authCallback = callback;
            return jest.fn(); // unsubscribe
        });
    });

    it('should initialize with loading state and null user', () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AllTheProviders });
        expect(result.current.initializing).toBe(true);
        expect(result.current.user).toBeNull();
    });

    it('should update user when auth state changes', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AllTheProviders });
        
        const mockUser = { uid: '123', email: 'test@example.com' };
        act(() => {
            authCallback(mockUser);
        });

        expect(result.current.initializing).toBe(false);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('should update user when auth state changes', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AllTheProviders });
        
        const mockUser = { uid: '123', email: 'test@example.com' };
        act(() => {
            authCallback(mockUser);
        });

        expect(result.current.initializing).toBe(false);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('should respect Detox launch arguments for auth', () => {
        (Constants.expoConfig!.extra as any).launchArgs.detoxAuth = 'true';
        
        const { result } = renderHook(() => useAuth(), { wrapper: AllTheProviders });
        
        act(() => {
            authCallback(null); // Even if firebase says null
        });

        expect(result.current.user?.uid).toBe('detox-user-123');
    });

    it('should handle sign out', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AllTheProviders });
        
        await act(async () => {
            await result.current.signOut();
        });

        expect(firebaseSignOut).toHaveBeenCalled();
    });
});
