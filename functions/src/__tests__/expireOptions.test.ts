import { buildExpiredOptionClosures } from '@/trades/expireOptionsUtils';

describe('buildExpiredOptionClosures', () => {
    const now = new Date('2026-02-01T12:00:00Z');

    it('creates a synthetic BUY to close expired short options', () => {
        const trades = [
            {
                userId: 'user_1',
                symbol: 'AAPL',
                type: 'SELL',
                quantity: 1,
                price: 1.2,
                right: 'C',
                strike: 150,
                expiration: '2026-01-17',
                multiplier: 100,
                secType: 'OPT'
            }
        ];

        const closures = buildExpiredOptionClosures(trades, now);
        expect(closures).toHaveLength(1);
        expect(closures[0]).toMatchObject({
            userId: 'user_1',
            symbol: 'AAPL',
            right: 'C',
            strike: 150,
            expiration: '2026-01-17',
            quantity: 1,
            type: 'BUY'
        });
    });

    it('skips contracts that are already closed', () => {
        const trades = [
            {
                userId: 'user_1',
                symbol: 'AAPL',
                type: 'SELL',
                quantity: 1,
                price: 1.2,
                right: 'C',
                strike: 150,
                expiration: '2026-01-17',
                multiplier: 100,
                secType: 'OPT'
            },
            {
                userId: 'user_1',
                symbol: 'AAPL',
                type: 'BUY',
                quantity: 1,
                price: 0.2,
                right: 'C',
                strike: 150,
                expiration: '2026-01-17',
                multiplier: 100,
                secType: 'OPT'
            }
        ];

        const closures = buildExpiredOptionClosures(trades, now);
        expect(closures).toHaveLength(0);
    });

    it('creates a synthetic SELL to close expired long options', () => {
        const trades = [
            {
                userId: 'user_2',
                symbol: 'MSFT',
                type: 'BUY',
                quantity: 2,
                price: 2.4,
                right: 'P',
                strike: 300,
                expiration: '2026-01-17',
                multiplier: 100,
                secType: 'OPT'
            }
        ];

        const closures = buildExpiredOptionClosures(trades, now);
        expect(closures).toHaveLength(1);
        expect(closures[0]).toMatchObject({
            userId: 'user_2',
            symbol: 'MSFT',
            right: 'P',
            strike: 300,
            expiration: '2026-01-17',
            quantity: 2,
            type: 'SELL'
        });
    });
});
