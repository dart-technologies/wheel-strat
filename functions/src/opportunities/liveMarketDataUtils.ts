import { getDteWindowRange, type DteWindow } from "@wheel-strat/shared";

export function formatExpiration(exp: string): string {
    if (exp.length === 8) {
        return `${exp.slice(0, 4)}-${exp.slice(4, 6)}-${exp.slice(6, 8)}`;
    }
    return exp;
}

export function daysToExpiration(exp: string): number {
    const expDate = new Date(exp.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    return Math.max(1, Math.ceil((expDate.getTime() - Date.now()) / 86400000));
}

export function resolveDteRange(window?: DteWindow | string) {
    return getDteWindowRange(window);
}

export function selectExpiration(expirations: string[], range: { minDays: number; maxDays: number }) {
    if (!Array.isArray(expirations) || expirations.length === 0) return undefined;
    const sorted = [...expirations].sort((a, b) => daysToExpiration(a) - daysToExpiration(b));
    const inRange = sorted.filter((exp) => {
        const days = daysToExpiration(exp);
        return days >= range.minDays && days <= range.maxDays;
    });

    // Debug logging for candidacy
    console.log('[liveMarketData] selectExpiration candidates:', inRange.map(e => ({
        date: e,
        dte: daysToExpiration(e),
        day: new Date(formatExpiration(e)).getDay()
    })));

    if (inRange.length === 0) {
        // Fallback: Find closest outside range
        const target = (range.minDays + range.maxDays) / 2;
        return sorted.reduce((best, exp) => {
            const bestDiff = Math.abs(daysToExpiration(best) - target);
            const currentDiff = Math.abs(daysToExpiration(exp) - target);
            return currentDiff < bestDiff ? exp : best;
        }, sorted[0]);
    }

    // Scoring Logic: Distance from target + Friday Bonus
    const targetDte = (range.minDays + range.maxDays) / 2;
    let bestExp = inRange[0];
    let bestScore = -Infinity;

    for (const exp of inRange) {
        const dte = daysToExpiration(exp);
        const dayOfWeek = new Date(formatExpiration(exp)).getDay(); // 5 = Friday

        // Lower distance is better, so initial score is negative distance
        let score = -Math.abs(dte - targetDte);

        // Friday Bonus: Equivalent to being "3 days closer" to target
        if (dayOfWeek === 5) { // Friday
            score += 3;
        }

        console.log(`[liveMarketData] Scoring ${exp}: DTE=${dte}, Dist=${Math.abs(dte - targetDte)}, FriBonus=${dayOfWeek === 5 ? '+3' : '0'}, Score=${score}`);

        if (score > bestScore) {
            bestScore = score;
            bestExp = exp;
        }
    }

    return bestExp;
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
