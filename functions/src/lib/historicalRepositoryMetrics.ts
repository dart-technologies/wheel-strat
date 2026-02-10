export function calculateSMA(data: number[], period: number): number | null {
    if (data.length < period) return null;
    return data.slice(0, period).reduce((a, b) => a + b, 0) / period;
}

export function calculateRSI(closes: number[], period = 14): number | null {
    if (closes.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
}
