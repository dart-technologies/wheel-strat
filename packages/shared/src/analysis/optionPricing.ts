export type OptionRight = 'C' | 'P';

type BlackScholesInput = {
    spot: number;
    strike: number;
    timeToExpYears: number;
    rate: number;
    volatility: number;
    right: OptionRight;
};

function normalCdf(x: number) {
    const abs = Math.abs(x);
    const t = 1 / (1 + 0.2316419 * abs);
    const a1 = 0.319381530;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
    const pdf = Math.exp(-0.5 * abs * abs) / Math.sqrt(2 * Math.PI);
    const cdf = 1 - pdf * poly;
    return x >= 0 ? cdf : 1 - cdf;
}

export function blackScholesPrice(input: BlackScholesInput) {
    const { spot, strike, timeToExpYears, rate, volatility, right } = input;
    if (!Number.isFinite(spot) || !Number.isFinite(strike)) return null;
    if (spot <= 0 || strike <= 0) return null;
    if (!Number.isFinite(timeToExpYears) || timeToExpYears <= 0) {
        const intrinsic = right === 'C' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
        return intrinsic;
    }
    if (!Number.isFinite(volatility) || volatility <= 0) {
        const intrinsic = right === 'C' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
        return intrinsic;
    }

    const sigma = volatility;
    const sqrtT = Math.sqrt(timeToExpYears);
    const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * timeToExpYears) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const discount = Math.exp(-rate * timeToExpYears);

    if (right === 'C') {
        return spot * normalCdf(d1) - strike * discount * normalCdf(d2);
    }
    return strike * discount * normalCdf(-d2) - spot * normalCdf(-d1);
}
