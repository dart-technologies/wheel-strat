import { getDteWindowRange, type DteWindow } from "@wheel-strat/shared";

/**
 * Format IBKR expiration date (YYYYMMDD) to display format
 */
export function formatExpiration(exp: string): string {
    if (exp.length === 8) {
        return `${exp.slice(0, 4)}-${exp.slice(4, 6)}-${exp.slice(6, 8)}`;
    }
    return exp;
}

/**
 * Calculate days to expiration
 */
export function daysToExpiration(exp: string): number {
    const expDate = new Date(exp.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
    return Math.max(1, Math.ceil((expDate.getTime() - Date.now()) / 86400000));
}

export function resolveDteRange(window?: DteWindow) {
    return getDteWindowRange(window);
}

export function selectExpiration(expirations: string[], range: { minDays: number; maxDays: number }) {
    if (!Array.isArray(expirations) || expirations.length === 0) return undefined;
    const sorted = [...expirations].sort((a, b) => daysToExpiration(a) - daysToExpiration(b));
    const inRange = sorted.filter((exp) => {
        const days = daysToExpiration(exp);
        return days >= range.minDays && days <= range.maxDays;
    });
    if (inRange.length > 0) return inRange[0];

    const target = (range.minDays + range.maxDays) / 2;
    return sorted.reduce((best, exp) => {
        const bestDiff = Math.abs(daysToExpiration(best) - target);
        const currentDiff = Math.abs(daysToExpiration(exp) - target);
        return currentDiff < bestDiff ? exp : best;
    }, sorted[0]);
}
