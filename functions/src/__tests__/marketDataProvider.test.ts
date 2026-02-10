const mockGetHistoricalContext = jest.fn();

jest.mock('../lib/ibkrRuntime', () => ({
    getIbkrFunctionsConfig: jest.fn()
}));

jest.mock('../lib/historicalRepository', () => ({
    HistoricalRepository: jest.fn().mockImplementation(() => ({
        getHistoricalContext: mockGetHistoricalContext
    }))
}));

import { getMarketDataProvider } from '@/lib/marketDataProvider';
import { getIbkrFunctionsConfig } from '@/lib/ibkrRuntime';
import * as publicMarketData from '@/lib/publicMarketData';

const ORIGINAL_ENV = process.env;

describe('market data provider', () => {
    const mockIbkrConfig = getIbkrFunctionsConfig as jest.Mock;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV, MARATHON_SYMBOLS: 'NVDA,TSLA' };
        delete process.env.MARATHON_MARKET_MODE;
        delete process.env.MARKET_DATA_PROVIDER;
        delete process.env.PUBLIC_API_KEY;
        delete process.env.PUBLIC_API_SECRET;
        delete process.env.PUBLIC_ACCOUNT_ID;
        delete process.env.PUBLIC_API_GATEWAY;

        mockGetHistoricalContext.mockReset();
        mockIbkrConfig.mockReset();
        mockIbkrConfig.mockReturnValue({
            bridgeUrl: 'http://localhost:5050',
            bridgeApiKey: '',
            tradingMode: 'paper',
            bridgeUrlConfigured: false
        });
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('uses mock provider when override is mock', async () => {
        const provider = getMarketDataProvider('mock');
        const snapshots = await provider.getMarketSnapshot();

        const nvda = snapshots.find((item) => item.symbol === 'NVDA');
        expect(nvda?.price).toBe(186.51);
    });

    it('uses mock provider when env forces mock mode', async () => {
        process.env.MARATHON_MARKET_MODE = 'mock';

        const provider = getMarketDataProvider();
        const snapshots = await provider.getMarketSnapshot();

        const nvda = snapshots.find((item) => item.symbol === 'NVDA');
        expect(nvda?.price).toBe(186.51);
    });

    it('uses historical provider for last-known override', async () => {
        mockGetHistoricalContext.mockResolvedValue({
            NVDA: { priceHistory: [100, 101] },
            TSLA: { priceHistory: [200, 201] }
        });

        const provider = getMarketDataProvider('last-known');
        const snapshots = await provider.getMarketSnapshot();

        expect(snapshots).toEqual([
            { symbol: 'NVDA', price: 101 },
            { symbol: 'TSLA', price: 201 }
        ]);
    });

    it('returns empty snapshots when live mode has no bridge configured', async () => {
        const provider = getMarketDataProvider('live');
        const snapshots = await provider.getMarketSnapshot();

        expect(snapshots).toEqual([]);
    });

    it('defaults to public data when configured', async () => {
        Object.assign(process.env, {
            PUBLIC_API_KEY: 'test-key',
            PUBLIC_ACCOUNT_ID: 'TEST',
            NODE_ENV: 'production'
        });

        const fetchSpy = jest.spyOn(publicMarketData, 'fetchPublicEquityQuotes').mockResolvedValue(
            new Map([
                ['NVDA', { symbol: 'NVDA', last: 123 }],
                ['TSLA', { symbol: 'TSLA', last: 456 }]
            ])
        );

        const provider = getMarketDataProvider();
        const snapshots = await provider.getMarketSnapshot();

        expect(snapshots).toEqual([
            { symbol: 'NVDA', price: 123, source: 'public' },
            { symbol: 'TSLA', price: 456, source: 'public' }
        ]);

        fetchSpy.mockRestore();
    });

    it('public provider fetches expirations before option chain', async () => {
        process.env.PUBLIC_API_KEY = 'test-key';
        process.env.PUBLIC_ACCOUNT_ID = 'TEST';

        const expirationsSpy = jest.spyOn(publicMarketData, 'fetchPublicOptionExpirations')
            .mockResolvedValue(['20260206']);
        const chainSpy = jest.spyOn(publicMarketData, 'fetchPublicOptionChain')
            .mockResolvedValue({
                symbol: 'AAPL',
                expirations: ['20260206'],
                strikes: [110],
                options: []
            });

        const provider = getMarketDataProvider('public');
        const chain = await provider.getOptionChain('AAPL');

        expect(expirationsSpy).toHaveBeenCalledWith('AAPL', expect.anything());
        expect(chainSpy).toHaveBeenCalledWith('AAPL', expect.anything(), '20260206');
        expect(chain).toEqual({ expirations: ['20260206'], strikes: [110] });

        expirationsSpy.mockRestore();
        chainSpy.mockRestore();
    });
});
