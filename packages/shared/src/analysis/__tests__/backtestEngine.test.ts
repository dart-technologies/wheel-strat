import { validateStrategy } from '../backtestEngine';
import { StrategyRecipe } from '../strategyLibrary';
import { PriceBar } from '../patternMatcher';

describe('Backtest Engine', () => {
    const mockHistory: PriceBar[] = Array.from({ length: 300 }, (_, i) => ({
        date: `2023-01-${i}`,
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i, // Trending up
        volume: 1000
    }));

    const mockRecipe: StrategyRecipe = {
        name: 'Simple Buy',
        description: 'Buy every day',
        criteria: () => true,
        recommendedStrategy: 'Cash-Secured Put',
        targetDelta: 0.30
    };

    it('calculates 100% win rate for a clear uptrend', () => {
        const result = validateStrategy(mockRecipe, mockHistory, 10);
        
        expect(result.totalTrades).toBeGreaterThan(0);
        expect(result.winRate).toBe(1); // Trending up price means every exit is higher
        expect(result.avgReturn).toBeGreaterThan(0);
    });

    it('handles empty history gracefully', () => {
        const result = validateStrategy(mockRecipe, [], 10);
        expect(result.totalTrades).toBe(0);
        expect(result.winRate).toBe(0);
    });
});
