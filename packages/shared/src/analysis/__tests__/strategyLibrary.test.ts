import { MAG7_STRATEGIES } from '../strategyLibrary';
import { PriceBar } from '../patternMatcher';

describe('Strategy Library', () => {
    const createMockHistory = (count: number, basePrice: number, trend = 0): PriceBar[] => {
        return Array.from({ length: count }, (_, i) => ({
            date: `2023-01-${i}`,
            open: basePrice + (i * trend),
            high: basePrice + (i * trend) + 5,
            low: basePrice + (i * trend) - 5,
            close: basePrice + (i * trend),
            volume: 1000000
        }));
    };

    describe('AAPL Strategies', () => {
        it('200-Day SMA Magnet criteria', () => {
            const strategy = MAG7_STRATEGIES['AAPL'].find(s => s.name === '200-Day SMA Magnet')!;
            const history = createMockHistory(200, 150);
            // SMA should be 150
            expect(strategy.criteria(history, 150)).toBe(true);
            expect(strategy.criteria(history, 160)).toBe(false);
        });
    });

    describe('AMZN Strategies', () => {
        it('100-Day SMA Pivot criteria', () => {
            const strategy = MAG7_STRATEGIES['AMZN'].find(s => s.name === '100-Day SMA Pivot')!;
            const history = createMockHistory(100, 100);
            expect(strategy.criteria(history, 100)).toBe(true);
            expect(strategy.criteria(history, 105)).toBe(false);
        });

        it('Bollinger Mean Reversion criteria', () => {
            const strategy = MAG7_STRATEGIES['AMZN'].find(s => s.name === 'Bollinger Mean Reversion')!;
            // Create history with low volatility
            const history = createMockHistory(20, 100);
            // StdDev will be 0
            // lowerBand = 100
            expect(strategy.criteria(history, 95)).toBe(true);
            expect(strategy.criteria(history, 105)).toBe(false);
        });
    });

    describe('TSLA Strategies', () => {
        it('Oversold Mean Reversion criteria', () => {
            const strategy = MAG7_STRATEGIES['TSLA'].find(s => s.name === 'Oversold Mean Reversion')!;
            // Create a history that is strictly down
            const history = createMockHistory(20, 200, -2);
            // RSI should be low
            expect(strategy.criteria(history, 150)).toBe(true);
        });
    });

    describe('NVDA Strategies', () => {
        it('Momentum Pullback Play criteria', () => {
            const strategy = MAG7_STRATEGIES['NVDA'].find(s => s.name === 'Momentum Pullback Play')!;
            const history = createMockHistory(252, 100, 1); // Upward trend
            // Last close is 100 + 251 = 351
            // 52 week high is 351 + 5 = 356
            // Criteria: price <= 356 * 0.93 (~331) AND price > SMA50
            // SMA50 of [301...351] is ~326
            expect(strategy.criteria(history, 330)).toBe(true);
            expect(strategy.criteria(history, 350)).toBe(false);
        });
    });
});
