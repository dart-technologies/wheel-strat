import { Opportunity } from '@wheel-strat/shared';

// Mock global fetch
global.fetch = jest.fn();

// Mock @react-native-firebase/functions
const mockFunctionsInstance = {};

jest.mock('@react-native-firebase/functions', () => ({
    getFunctions: jest.fn(() => mockFunctionsInstance),
    connectFunctionsEmulator: jest.fn(),
    httpsCallable: jest.fn(() => jest.fn(async () => ({
        data: { success: true, newFills: 5 }
    })))
}));

describe('trading service', () => {
    let placeOrder: typeof import('../trading').placeOrder;
    let fetchExecutions: typeof import('../trading').fetchExecutions;
    let triggerSync: typeof import('../trading').triggerSync;
    let checkBridgeHealth: typeof import('../trading').checkBridgeHealth;
    let calculateEfficiencyGrade: typeof import('../trading').calculateEfficiencyGrade;

    beforeAll(() => {
        Object.assign(process.env, {
            EXPO_PUBLIC_IBKR_BRIDGE_URL: 'http://localhost:5050',
            EXPO_PUBLIC_IBKR_BRIDGE_API_KEY: 'test-key'
        });
        jest.resetModules();
        const trading = require('../trading');
        placeOrder = trading.placeOrder;
        fetchExecutions = trading.fetchExecutions;
        triggerSync = trading.triggerSync;
        checkBridgeHealth = trading.checkBridgeHealth;
        calculateEfficiencyGrade = trading.calculateEfficiencyGrade;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('placeOrder', () => {
        const mockOpp: Opportunity = {
            symbol: 'AAPL',
            strategy: 'Covered Call',
            strike: 150,
            expiration: '2026-01-01',
            premium: 2.50,
            winProb: 80,
            ivRank: 50,
            reasoning: 'Test'
        };

        it('places order successfully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ orderId: 123, status: 'Submitted', message: 'OK' })
            });

            const result = await placeOrder(mockOpp, 'user123', 1);

            expect(global.fetch).toHaveBeenCalledWith('http://localhost:5050/order', expect.objectContaining({
                method: 'POST',
                body: expect.any(String)
            }));
            const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
            expect(body.symbol).toBe('AAPL');
            expect(body.uid).toBe('user123');
            expect(result).toEqual({ data: { orderId: 123, status: 'Submitted', message: 'OK' }, error: null });
        });

        it('handles options payload correctly', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            });

            await placeOrder(mockOpp, 'user123');

            const callArgs = (global.fetch as jest.Mock).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);

            expect(body.secType).toBe('OPT');
            expect(body.right).toBe('C'); // Covered Call -> Call
            expect(body.expiration).toBe('20260101'); // Dashes removed
            expect(body.action).toBe('SELL'); // Selling premium
        });

        it('returns failure on API error', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Insufficient funds' })
            });

            const result = await placeOrder(mockOpp, 'user123');
            expect(result.data).toBeNull();
            expect(result.error?.message).toBe('Insufficient funds');
        });
    });

    describe('fetchExecutions', () => {
        it('fetches and maps executions correctly', async () => {
            const mockExecutions = [
                {
                    execId: 'e1',
                    time: '20260121 15:30:00',
                    symbol: 'TSLA',
                    secType: 'STK',
                    side: 'BOT',
                    shares: 10,
                    avgPrice: 200.0,
                }
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ executions: mockExecutions })
            });

            const result = await fetchExecutions();

            expect(result.error).toBeNull();
            const trades = result.data!;
            expect(trades).toHaveLength(1);
            expect(trades[0].symbol).toBe('TSLA');
            expect(trades[0].type).toBe('BUY');
            expect(trades[0].quantity).toBe(10);
            expect(trades[0].total).toBe(2000);
        });

        it('handles errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
            const result = await fetchExecutions();
            expect(result.data).toBeNull();
            expect(result.error?.message).toBe('Network error');
        });
    });

    describe('triggerSync', () => {
        it('calls the manualSyncIBKR cloud function', async () => {
            const result = await triggerSync();
            expect(result).toEqual({ data: { success: true, newFills: 5 }, error: null });
        });
    });

    describe('checkBridgeHealth', () => {
        it('returns online when bridge is reachable and connected', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ connected: true, status: 'ok' })
            });

            const result = await checkBridgeHealth();

            expect(result.error).toBeNull();
            const health = result.data!;
            expect(health.online).toBe(true);
            expect(health.connected).toBe(true);
            expect(health.status).toBe('ok');
        });

        it('returns offline when HTTP error occurs', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 503
            });

            const result = await checkBridgeHealth();

            expect(result.data).toBeNull();
            expect(result.error?.message).toContain('HTTP 503');
        });

        it('returns offline when fetch throws', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));

            const result = await checkBridgeHealth();

            expect(result.data).toBeNull();
            expect(result.error?.message).toBe('Fetch failed');
        });
    });

    describe('calculateEfficiencyGrade', () => {
        it('returns A for high ROC', () => {
            // profit 100, margin 1000, 36.5 days => 10% in 10% of year => 100% Annualized
            expect(calculateEfficiencyGrade(100, 1000, 36.5)).toBe('A');
        });

        it('returns C for moderate ROC', () => {
            // profit 11, margin 1000, 36.5 days => 1.1% in 10% of year => 11% Annualized
            expect(calculateEfficiencyGrade(11, 1000, 36.5)).toBe('C');
        });

        it('returns F for negative profit', () => {
            expect(calculateEfficiencyGrade(-50, 1000, 30)).toBe('F');
        });

        it('returns C for invalid daysHeld', () => {
            expect(calculateEfficiencyGrade(100, 1000, 0)).toBe('C');
        });
    });
});
