import { fetchOptionQuote } from '@/lib/marketDataProvider';
import type { PublicOptionChain } from '@/lib/publicMarketData';
import * as publicMarketData from '@/lib/publicMarketData';

describe('fetchOptionQuote (public)', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = {
            ...ORIGINAL_ENV,
            MARKET_DATA_PROVIDER: 'public',
            PUBLIC_API_KEY: 'test-key',
            PUBLIC_ACCOUNT_ID: 'TEST',
            PUBLIC_API_GATEWAY: 'https://api.public.com/userapigateway'
        };
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        jest.restoreAllMocks();
    });

    it('merges public greeks into option quote', async () => {
        const chain: PublicOptionChain = {
            symbol: 'AAPL',
            expirations: ['20260206'],
            strikes: [110],
            options: [
                {
                    symbol: 'AAPL',
                    expiration: '20260206',
                    strike: 110,
                    right: 'C',
                    osiSymbol: 'AAPL260206C00110000',
                    quote: {
                        bid: 1.0,
                        ask: 1.2,
                        last: 1.1
                    }
                }
            ]
        };

        jest.spyOn(publicMarketData, 'fetchPublicOptionChain').mockResolvedValue(chain);
        jest.spyOn(publicMarketData, 'fetchPublicOptionGreeks').mockResolvedValue(
            new Map([
                ['AAPL260206C00110000', { delta: 0.3, gamma: 0.02, theta: -0.01, vega: 0.05 }]
            ])
        );

        const result = await fetchOptionQuote('http://bridge', 'AAPL', 110, '2026-02-06', 'C');
        expect(result.delta).toBeCloseTo(0.3);
        expect(result.gamma).toBeCloseTo(0.02);
        expect(result.theta).toBeCloseTo(-0.01);
        expect(result.vega).toBeCloseTo(0.05);
        expect(result.premiumSource).toBe('mid');
        expect(result.premium).toBeCloseTo(1.1);
    });
});
