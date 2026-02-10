/**
 * Centralized financial calculations for Wheel Strat
 */

/**
 * Calculates the annualized yield (Return on Capital) for an options trade.
 * 
 * @param premium The premium received (or expected) for the option.
 * @param collateral The collateral required (strike price for CSP, current price or cost basis for CC).
 * @param daysToExpiration Number of days until the option expires.
 * @returns The annualized yield as a percentage (0-100+).
 */
export function calculateAnnualizedYield(
    premium: number,
    collateral: number,
    daysToExpiration: number
): number {
    if (collateral <= 0 || daysToExpiration <= 0) return 0;

    // (Premium / Collateral) * (365 / Days) * 100
    const yield_raw = (premium / collateral) * (365 / daysToExpiration) * 100;

    // Return rounded to 1 decimal place
    return Math.round(yield_raw * 10) / 10;
}

/**
 * Calculates IV Rank based on current IV and 52-week high/low.
 * Note: High/Low data must be provided from an external source.
 */
export function calculateIvRank(
    currentIv: number,
    ivLow: number,
    ivHigh: number
): number {
    if (ivHigh === ivLow) return 0;
    const rank = ((currentIv - ivLow) / (ivHigh - ivLow)) * 100;
    return Math.max(0, Math.min(100, Math.round(rank)));
}

/**
 * Grades efficiency based on annualized ROC.
 */
export function gradeEfficiency(annualizedRoc: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (annualizedRoc >= 25) return 'A';
    if (annualizedRoc >= 15) return 'B';
    if (annualizedRoc >= 8) return 'C';
    if (annualizedRoc >= 0) return 'D';
    return 'F';
}

/**
 * Calculates annualized Return on Capital (ROC) as a percentage.
 */
export function calculateAnnualizedRoc(
    profit: number,
    margin: number,
    daysHeld: number
): number {
    if (margin === 0 || daysHeld === 0) return 0;
    const annualized = (profit / margin) / (daysHeld / 365);
    return annualized * 100;
}

/**
 * Calculates an efficiency grade for a trade using ROC.
 */
export function calculateEfficiencyGrade(
    profit: number,
    margin: number,
    daysHeld: number
): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (daysHeld <= 0) return 'C';
    const annualizedRoc = calculateAnnualizedRoc(profit, margin, daysHeld);
    return gradeEfficiency(annualizedRoc);
}

/**
 * Converts delta to a rough win probability (0-100).
 */
export function calculateWinProbFromDelta(delta: number): number {
    if (!Number.isFinite(delta)) return 0;
    const prob = (1 - Math.abs(delta)) * 100;
    return Math.round(Math.max(0, Math.min(100, prob)));
}
