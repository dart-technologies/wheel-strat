import { PriceBar } from './patternMatcher';

export interface StrategyRecipe {
    name: string;
    description: string;
    criteria: (history: PriceBar[], currentPrice: number) => boolean;
    recommendedStrategy: 'Cash-Secured Put' | 'Covered Call';
    targetDelta: number;
}

export const MAG7_STRATEGIES: Record<string, StrategyRecipe[]> = {
    'AAPL': [
        {
            name: '200-Day SMA Magnet',
            description: 'AAPL historically bounces aggressively off the 200-day SMA.',
            criteria: (history, price) => {
                const sma200 = history.slice(-200).reduce((a, b) => a + b.close, 0) / 200;
                return price <= sma200 * 1.02 && price >= sma200 * 0.98;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.35
        },
        {
            name: 'Post-Dividend Drift',
            description: 'AAPL often sees steady accumulation after dividend distributions.',
            criteria: (history, price) => {
                const recent = history.slice(-10);
                return recent[recent.length-1].close > recent[0].close && price < Math.max(...history.slice(-60).map(b => b.high)) * 0.97;
            },
            recommendedStrategy: 'Covered Call',
            targetDelta: 0.20
        }
    ],
    'TSLA': [
        {
            name: 'Oversold Mean Reversion',
            description: 'TSLA high-volatility bounces after RSI falls below 35.',
            criteria: (history, price) => {
                const changes = history.slice(-14).map((b, i, arr) => i > 0 ? b.close - arr[i-1].close : 0);
                const gains = changes.map(c => Math.max(0, c)).reduce((a,b)=>a+b,0)/14;
                const losses = changes.map(c => Math.max(0, -c)).reduce((a,b)=>a+b,0)/14;
                const rsi = 100 - (100 / (1 + (gains/(losses||1))));
                return rsi < 35;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.25
        },
        {
            name: 'Gamma Squeeze Exhaustion',
            description: 'Identifies parabolic moves (Price > 12% above 20-day SMA) likely to mean revert.',
            criteria: (history, price) => {
                const sma20 = history.slice(-20).reduce((a, b) => a + b.close, 0) / 20;
                return price > sma20 * 1.12;
            },
            recommendedStrategy: 'Covered Call',
            targetDelta: 0.15
        }
    ],
    'NVDA': [
        {
            name: 'Momentum Pullback Play',
            description: 'Selling premium after a 7% pullback from 52-week highs during an uptrend.',
            criteria: (history, price) => {
                const high52 = Math.max(...history.slice(-252).map(b => b.high));
                const sma50 = history.slice(-50).reduce((a, b) => a + b.close, 0) / 50;
                return price <= high52 * 0.93 && price > sma50;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.30
        },
        {
            name: 'Vol Spike Flush',
            description: 'Selling premium when price drops 5% in 2 days while in long-term uptrend.',
            criteria: (history, price) => {
                const prev2 = history[history.length - 2].close;
                const sma200 = history.slice(-200).reduce((a, b) => a + b.close, 0) / 200;
                return (price / prev2) < 0.95 && price > sma200;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.40
        }
    ],
    'AMZN': [
        {
            name: '100-Day SMA Pivot',
            description: 'AMZN uses the 100-day SMA as a primary accumulation floor.',
            criteria: (history, price) => {
                const sma100 = history.slice(-100).reduce((a, b) => a + b.close, 0) / 100;
                return price <= sma100 * 1.015 && price >= sma100 * 0.985;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.35
        },
        {
            name: 'Bollinger Mean Reversion',
            description: 'Identify extreme oversold conditions when AMZN pierces the lower 2SD band.',
            criteria: (history, price) => {
                const slice = history.slice(-20);
                const avg = slice.reduce((a, b) => a + b.close, 0) / 20;
                const stdDev = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b.close - avg, 2), 0) / 20);
                const lowerBand = avg - (2 * stdDev);
                return price <= lowerBand;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.20
        },
        {
            name: 'Institutional Value Gap',
            description: 'Identify price levels with high historical volume support.',
            criteria: (history, price) => {
                const yearHistory = history.slice(-252);
                const maxVolDay = yearHistory.sort((a, b) => b.volume - a.volume)[0];
                return price <= maxVolDay.close * 1.03 && price >= maxVolDay.close * 0.97;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.40
        }
    ],
    'MSFT': [
        {
            name: 'Steady Eddie Channel',
            description: 'MSFT historically trends in a 5% band around its 50-day SMA.',
            criteria: (history, price) => {
                const sma50 = history.slice(-50).reduce((a, b) => a + b.close, 0) / 50;
                return price <= sma50 * 0.98;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.30
        },
        {
            name: 'Earnings IV Crush',
            description: 'Selling calls 2 days after earnings when IV rank is still elevated.',
            criteria: (history, price) => {
                // Simplified: detect a volatility expansion (larger range) in recent 3 days
                const recent = history.slice(-3);
                const volatility = Math.max(...recent.map(b => b.high - b.low));
                const avgVol = history.slice(-30).reduce((a, b) => a + (b.high-b.low), 0) / 30;
                return volatility > avgVol * 1.5 && price > history[history.length-1].close;
            },
            recommendedStrategy: 'Covered Call',
            targetDelta: 0.25
        }
    ],
    'GOOGL': [
        {
            name: 'Relative Strength Lag',
            description: 'GOOGL catch-up play when it underperforms its 50-day average by 4%.',
            criteria: (history, price) => {
                const sma50 = history.slice(-50).reduce((a, b) => a + b.close, 0) / 50;
                return (price / sma50) < 0.96;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.30
        }
    ],
    'META': [
        {
            name: 'V-Recovery Bounce',
            description: 'META sharp recoveries after a 3-day drop of >5%.',
            criteria: (history, price) => {
                const threeDayRet = (price - history[history.length-3].close) / history[history.length-3].close;
                return threeDayRet < -0.05;
            },
            recommendedStrategy: 'Cash-Secured Put',
            targetDelta: 0.20
        }
    ]
};
