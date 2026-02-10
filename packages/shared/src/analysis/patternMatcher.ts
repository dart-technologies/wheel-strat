export interface PriceBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type Regime = 'High Volatility' | 'Low Volatility' | 'Uptrend' | 'Downtrend' | 'Neutral';

/**
 * Calculates Euclidean distance between two normalized price arrays.
 * Lower distance = higher similarity.
 */
export function calculateEuclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Arrays must be of equal length');
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

/**
 * Normalizes a price array to percentage change from start.
 * [100, 105, 110] -> [0, 0.05, 0.10]
 */
export function normalizePrices(prices: number[]): number[] {
    if (prices.length === 0) return [];
    const start = prices[0];
    return prices.map(p => (p - start) / start);
}

/**
 * Finds historical periods similar to the current price action.
 */
export function findHistoricalDoppelgangers(
    currentPrices: number[],
    historicalData: PriceBar[],
    windowSize: number = 30,
    topN: number = 5
): { match: PriceBar[], distance: number, subsequentPerformance: number }[] {
    
    if (historicalData.length < windowSize * 2) return [];

    const normalizedCurrent = normalizePrices(currentPrices);
    const matches = [];

    // Sliding window search
    // We stop windowSize before end to allow for "subsequent performance" calculation
    for (let i = 0; i < historicalData.length - windowSize * 2; i++) {
        const window = historicalData.slice(i, i + windowSize);
        const prices = window.map(b => b.close);
        const normalizedWindow = normalizePrices(prices);
        
        const distance = calculateEuclideanDistance(normalizedCurrent, normalizedWindow);
        
        // Calculate subsequent 30-day performance
        const entryPrice = historicalData[i + windowSize - 1].close;
        const exitPrice = historicalData[i + windowSize * 2 - 1].close;
        const performance = (exitPrice - entryPrice) / entryPrice;

        matches.push({
            match: window,
            distance,
            subsequentPerformance: performance
        });
    }

    // Sort by distance (ascending) and return top N
    return matches.sort((a, b) => a.distance - b.distance).slice(0, topN);
}

/**
 * Determines the Theta/Vega Grade based on IV and Realized Volatility.
 */
export function calculateThetaGrade(
    impliedVol: number, // e.g., 0.45 for 45%
    realizedVol: number, // e.g., 0.30 for 30%
    ivRank: number // 0-100
): { grade: 'A' | 'B' | 'C' | 'D' | 'F', richness: 'Cheap' | 'Fair' | 'Expensive' } {
    
    const premiumRatio = impliedVol / Math.max(0.01, realizedVol); // Avoid divide by zero

    if (premiumRatio > 1.5 && ivRank > 70) return { grade: 'A', richness: 'Expensive' }; // Selling opportunity
    if (premiumRatio > 1.2 && ivRank > 50) return { grade: 'B', richness: 'Expensive' };
    if (premiumRatio >= 0.9 && premiumRatio <= 1.2) return { grade: 'C', richness: 'Fair' };
    if (premiumRatio < 0.9) return { grade: 'D', richness: 'Cheap' }; // Buying opportunity
    
    return { grade: 'F', richness: 'Cheap' }; // IV crushed or realized vol spiking (Trap)
}
