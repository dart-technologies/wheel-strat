import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLeaderboard } from '../hooks';
import { fetchLeaderboard } from '@/services/api';
import { store } from '@/data/store';

jest.mock('@/services/api', () => ({
    fetchLeaderboard: jest.fn()
}));

jest.mock('@/data/store', () => ({
    store: {
        getCell: jest.fn(),
        setCell: jest.fn(),
        setRow: jest.fn()
    }
}));

describe('useLeaderboard hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock to prevent "Cannot read property 'error' of undefined"
        (fetchLeaderboard as jest.Mock).mockResolvedValue({ data: { leaderboard: [] } });
    });

    it('skips fetch if data is fresh in TinyBase', async () => {
        const now = Date.now();
        const twoMinutesAgo = new Date(now - 120000).toISOString();
        
        // Mock persistent data as fresh (2 mins old)
        (store.getCell as jest.Mock).mockReturnValue(twoMinutesAgo);

        // We need entries.length > 0 for the skip logic to fire
        (fetchLeaderboard as jest.Mock).mockResolvedValueOnce({
            data: { leaderboard: [{ userId: 'cached' }] }
        });

        const { result, rerender } = renderHook(() => useLeaderboard());

        // Wait for initial mount fetch to complete if it happened
        await waitFor(() => expect(result.current.loading).toBe(false));
        
        // Now clear and try to refresh - it should skip because 2 mins < 5 mins
        (fetchLeaderboard as jest.Mock).mockClear();
        
        await act(async () => {
            await result.current.refresh();
        });

        expect(fetchLeaderboard).not.toHaveBeenCalled();
    });

    it('fetches if data is old in TinyBase', async () => {
        const now = Date.now();
        const tenMinutesAgo = new Date(now - 600000).toISOString();
        
        // Mock persistent data as old (10 mins old)
        (store.getCell as jest.Mock).mockReturnValue(tenMinutesAgo);
        (fetchLeaderboard as jest.Mock).mockResolvedValue({
            data: {
                updatedAt: now,
                leaderboard: [{ userId: 'user1', yieldPct: 10, tradeCount: 5 }]
            }
        });

        const { result } = renderHook(() => useLeaderboard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(fetchLeaderboard).toHaveBeenCalled();
        expect(store.setCell).toHaveBeenCalledWith('syncMetadata', 'main', 'lastLeaderboardUpdate', expect.any(String));
    });

    it('forces fetch if force parameter is passed', async () => {
        const now = Date.now();
        const twoMinutesAgo = new Date(now - 120000).toISOString();
        
        (store.getCell as jest.Mock).mockReturnValue(twoMinutesAgo);
        (fetchLeaderboard as jest.Mock).mockResolvedValue({
            data: { updatedAt: now, leaderboard: [] }
        });

        const { result } = renderHook(() => useLeaderboard());
        
        // Initial mount might trigger check, wait for it
        await waitFor(() => expect(result.current.loading).toBe(false));
        
        // Call manual refresh with force=true
        await act(async () => {
            await result.current.refresh(true);
        });

        expect(fetchLeaderboard).toHaveBeenCalledWith(true);
    });

    it('defaults to persistent state on mount', async () => {
        const storedTime = '2026-01-01T12:00:00.000Z';
        (store.getCell as jest.Mock).mockReturnValue(storedTime);

        const { result } = renderHook(() => useLeaderboard());

        // Wait for any mount-time loading states to stabilize
        // Check initial state immediately (before async fetch completes)
        expect(result.current.updatedAt?.toISOString()).toBe(storedTime);
        
        // Wait for any mount-time loading states to stabilize to avoid act warnings
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it('updates persistent store on successful fetch', async () => {
        const now = Date.now();
        const serverTime = new Date(now - 1000).toISOString();
        
        (store.getCell as jest.Mock).mockReturnValue(null); // No previous sync
        (fetchLeaderboard as jest.Mock).mockResolvedValue({
            data: { 
                updatedAt: serverTime, 
                leaderboard: [] 
            }
        });

        const { result } = renderHook(() => useLeaderboard());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(store.setCell).toHaveBeenCalledWith(
            'syncMetadata', 
            'main', 
            'lastLeaderboardUpdate', 
            serverTime
        );
    });
});
