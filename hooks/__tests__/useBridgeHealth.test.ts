import { renderHook, act } from '@testing-library/react-native';
import { useBridgeHealth, _resetInternalStateForTesting } from '../useBridgeHealth';
import { checkBridgeHealth } from '@/services/trading';

jest.mock('@/services/trading', () => ({
    checkBridgeHealth: jest.fn(),
}));

describe('useBridgeHealth', () => {
    beforeEach(() => {
        _resetInternalStateForTesting();
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        _resetInternalStateForTesting();
        jest.useRealTimers();
    });

    it('initializes with checking status', async () => {
        let resolvePromise: any;
        const promise = new Promise((resolve) => { resolvePromise = resolve; });
        (checkBridgeHealth as jest.Mock).mockReturnValue(promise);
        
        const { result } = renderHook(() => useBridgeHealth());
        
        expect(result.current.status).toBe('checking');
    });

    it('updates status to online when bridge is healthy', async () => {
        const mockHealth = { online: true, connected: true, latency: 50 };
        (checkBridgeHealth as jest.Mock).mockResolvedValue({ data: mockHealth, error: null });

        const { result } = renderHook(() => useBridgeHealth());

        // Wait for the promise to resolve and state to update
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve(); // Extra tick for safety
        });

        expect(result.current.status).toBe('online');
        expect(result.current.latency).toBe(50);
    });

    it('updates status to no-ib when bridge is online but IB is not connected', async () => {
        const mockHealth = { online: true, connected: false, latency: 100 };
        (checkBridgeHealth as jest.Mock).mockResolvedValue({ data: mockHealth, error: null });

        const { result } = renderHook(() => useBridgeHealth());

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.status).toBe('no-ib');
    });

    it('updates status to offline when bridge check fails', async () => {
        (checkBridgeHealth as jest.Mock).mockResolvedValue({ data: null, error: new Error('Network Error') });

        const { result } = renderHook(() => useBridgeHealth());

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.status).toBe('offline');
    });

    it('refreshes manually when requested', async () => {
        (checkBridgeHealth as jest.Mock).mockResolvedValue({ data: { online: true, connected: true }, error: null });

        const { result } = renderHook(() => useBridgeHealth());
        
        // Wait for initial check
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(checkBridgeHealth).toHaveBeenCalledTimes(2); // Initial + Refresh
    });

    it('polls at intervals', async () => {
        (checkBridgeHealth as jest.Mock).mockResolvedValue({ data: { online: true, connected: true }, error: null });

        renderHook(() => useBridgeHealth());

        // Wait for initial check
        await act(async () => {
            await Promise.resolve();
        });

        await act(async () => {
            jest.advanceTimersByTime(300000); // CHECK_INTERVAL_MS
        });

        // Wait for polling check
        await act(async () => {
            await Promise.resolve();
        });

        // Initial check + 1 interval check
        expect(checkBridgeHealth).toHaveBeenCalledTimes(2);
    });
});