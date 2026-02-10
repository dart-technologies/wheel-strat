import { PriceBar } from './patternMatcher';
import { StrategyRecipe } from './strategyLibrary';

export interface BacktestResult {
    winRate: number;
    totalTrades: number;
    avgReturn: number;
    maxDrawdown: number;
    efficiencyScore: number; // 0-100
}

/**
 * Validates a strategy recipe against 5 years of historical data.
 */
export function validateStrategy(
    recipe: StrategyRecipe,
    history: PriceBar[],
    horizonDays: number = 30
): BacktestResult {
    let wins = 0;
    let total = 0;
    let totalReturn = 0;
    let maxDD = 0;

    // Start from the point where we have enough data for the recipe (e.g., 200 days for AAPL)
    for (let i = 200; i < history.length - horizonDays; i++) {
        const subHistory = history.slice(0, i);
        const currentPrice = history[i].close;

        if (recipe.criteria(subHistory, currentPrice)) {
            total++;
            const exitPrice = history[i + horizonDays].close;
            const tradeReturn = (exitPrice - currentPrice) / currentPrice;
            
            // For CSP, a win is price staying above strike (approx currentPrice - buffer)
            // For backtest simplicity, we check if price is higher or flat after horizon
            if (tradeReturn >= -0.02) { 
                wins++;
            }
            
            totalReturn += tradeReturn;
            maxDD = Math.min(maxDD, tradeReturn);
        }
    }

    return {
        winRate: total > 0 ? wins / total : 0,
        totalTrades: total,
        avgReturn: total > 0 ? totalReturn / total : 0,
        maxDrawdown: maxDD,
        efficiencyScore: total > 0 ? (wins / total) * 100 : 0
    };
}
