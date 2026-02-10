import {
    buildPublicOptionOsiMap,
    buildPublicOptionQuoteMap,
    fetchPublicOptionChain,
    fetchPublicOptionGreeks
} from '@/lib/publicMarketData';

import { fetchWithTimeout } from '@/lib/fetch';
import { __resetPublicTokenCache } from '@/lib/publicMarketDataClient';

jest.mock('../lib/fetch', () => ({
    fetchWithTimeout: jest.fn()
}));

const mockFetch = fetchWithTimeout as jest.Mock;

const config = {
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    gateway: 'https://api.public.com/userapigateway',
    accountId: 'TEST',
    configured: true
};

const mockTokenExchange = () => {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
        text: async () => ''
    });
};

describe('public market data', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        __resetPublicTokenCache();
    });

    it('parses option chain calls/puts into expirations and strikes', async () => {
        const payload = {
            baseSymbol: 'AAPL',
            calls: [
                {
                    instrument: { symbol: 'AAPL260206C00110000', type: 'OPTION' },
                    bid: '1.00',
                    ask: '1.10',
                    last: '1.05'
                }
            ],
            puts: [
                {
                    instrument: { symbol: 'AAPL260206P00110000', type: 'OPTION' },
                    bid: '1.20',
                    ask: '1.30',
                    last: '1.25'
                }
            ]
        };

        mockTokenExchange();
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => payload,
            text: async () => ''
        });

        const chain = await fetchPublicOptionChain('AAPL', config, '2026-02-06');
        expect(chain).not.toBeNull();
        expect(chain?.expirations).toEqual(['20260206']);
        expect(chain?.strikes).toEqual([110]);
        expect(chain?.options.length).toBe(2);

        const quoteMap = buildPublicOptionQuoteMap(chain!);
        expect(quoteMap.size).toBe(2);

        const osiMap = buildPublicOptionOsiMap(chain!);
        expect(osiMap.get('AAPL|20260206|C|110')).toBe('AAPL260206C00110000');
        expect(osiMap.get('AAPL|20260206|P|110')).toBe('AAPL260206P00110000');
    });

    it('maps greeks response by osi symbol', async () => {
        const payload = {
            greeks: [
                {
                    symbol: 'AAPL260206C00110000',
                    greeks: {
                        delta: '0.3',
                        gamma: '0.02',
                        theta: '-0.01',
                        vega: '0.05'
                    }
                }
            ]
        };

        mockTokenExchange();
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => payload,
            text: async () => ''
        });

        const greeks = await fetchPublicOptionGreeks(['AAPL260206C00110000'], config);
        expect(greeks?.get('AAPL260206C00110000')).toEqual({
            delta: 0.3,
            gamma: 0.02,
            theta: -0.01,
            vega: 0.05
        });
    });

    it('fetches expirations when option chain expiration is missing', async () => {
        const expirationsPayload = {
            expirationDates: ['2026-02-06']
        };
        const chainPayload = {
            baseSymbol: 'AAPL',
            calls: [
                {
                    instrument: { symbol: 'AAPL260206C00110000', type: 'OPTION' },
                    bid: '1.00',
                    ask: '1.10',
                    last: '1.05'
                }
            ]
        };

        mockTokenExchange();
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => expirationsPayload,
                text: async () => ''
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => chainPayload,
                text: async () => ''
            });

        const chain = await fetchPublicOptionChain('AAPL', config);
        expect(chain).not.toBeNull();
        expect(chain?.expirations).toEqual(['20260206']);

        const chainCall = mockFetch.mock.calls.find((call) => {
            const body = call?.[1]?.body ? JSON.parse(call[1].body) : null;
            return body?.expirationDate;
        });
        const requestBody = chainCall?.[1]?.body ? JSON.parse(chainCall[1].body) : null;
        expect(requestBody?.expirationDate).toBe('2026-02-06');
    });

    it('returns null when no expirations are available', async () => {
        mockTokenExchange();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ expirationDates: [] }),
            text: async () => ''
        });

        const chain = await fetchPublicOptionChain('AAPL', config);
        expect(chain).toBeNull();
    });
});
