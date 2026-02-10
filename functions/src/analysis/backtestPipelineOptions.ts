import { blackScholesPrice } from "@wheel-strat/shared";
import { parseExpirationDate } from "./backtestPipelineUtils";

export function timeToExpirationYears(expiration: string) {
    const expDate = parseExpirationDate(expiration);
    if (!expDate) return null;
    const diffMs = expDate.getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
    return diffMs / (365 * 24 * 60 * 60 * 1000);
}

export function computeImpliedVolFromPremium(input: {
    premium: number;
    spot: number;
    strike: number;
    timeToExpYears: number;
    rate: number;
    right: 'C' | 'P';
}) {
    const { premium, spot, strike, timeToExpYears, rate, right } = input;
    if (!Number.isFinite(premium) || premium <= 0) return null;
    if (!Number.isFinite(spot) || spot <= 0) return null;
    if (!Number.isFinite(strike) || strike <= 0) return null;
    if (!Number.isFinite(timeToExpYears) || timeToExpYears <= 0) return null;

    const intrinsic = right === 'C'
        ? Math.max(0, spot - strike)
        : Math.max(0, strike - spot);
    if (premium < intrinsic) return null;

    const minVol = 0.0001;
    const maxVol = 5;
    const priceAtMax = blackScholesPrice({
        spot,
        strike,
        timeToExpYears,
        rate,
        volatility: maxVol,
        right
    });
    if (priceAtMax === null || !Number.isFinite(priceAtMax) || premium > priceAtMax) {
        return null;
    }

    let low = minVol;
    let high = maxVol;
    let mid = (low + high) / 2;
    for (let i = 0; i < 60; i += 1) {
        mid = (low + high) / 2;
        const priceValue = blackScholesPrice({
            spot,
            strike,
            timeToExpYears,
            rate,
            volatility: mid,
            right
        });
        if (priceValue === null || !Number.isFinite(priceValue)) return null;
        const diff = priceValue - premium;
        if (Math.abs(diff) < 1e-4) return mid;
        if (diff > 0) {
            high = mid;
        } else {
            low = mid;
        }
    }
    return mid;
}
