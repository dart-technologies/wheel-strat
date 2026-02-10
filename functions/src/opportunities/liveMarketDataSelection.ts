import { calculateAnnualizedYield, calculateWinProbFromDelta } from "@wheel-strat/shared";
import { fetchWithTimeout } from "@/lib/fetch";
import { ibkrHistoricalSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import type { PublicMarketConfig, PublicOptionQuote } from "@/lib/publicMarketData";
import { fetchPublicOptionGreeks } from "@/lib/publicMarketData";
import {
    chunkArray,
    daysToExpiration,
    formatExpiration,
    selectExpiration
} from "./liveMarketDataUtils";

export interface OptionLeg {
    strike: number;
    expiration: string;
    premium: number;
    annualizedYield: number;
    premiumSource?: 'mid' | 'bid' | 'ask' | 'last' | 'model' | 'close';
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    winProb?: number;
}

export type QuoteResult = {
    bid?: number;
    ask?: number;
    last?: number;
    close?: number;
    premium?: number;
    premiumSource?: OptionLeg['premiumSource'];
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    modelOptPrice?: number;
    reason?: string;
    meta?: {
        bid?: number;
        ask?: number;
        last?: number;
        close?: number;
        modelOptPrice?: number;
    };
};

const HIST_OPTION_CACHE_TTL_MS = 5 * 60 * 1000;
const historicalOptionCache = new Map<string, { timestamp: number; quote: QuoteResult | null }>();
const disableHistoricalOptionFallback = () => {
    const flag = (process.env.IBKR_DISABLE_OPTION_HISTORICAL || '').trim().toLowerCase();
    return flag === 'true' || flag === '1';
};

export async function primePublicGreeksCache(
    osiSymbols: string[],
    publicConfig: PublicMarketConfig,
    cache: Map<string, PublicOptionQuote>
) {
    const missing = osiSymbols.filter((osi) => !cache.has(osi));
    if (!missing.length) return;
    const chunks = chunkArray(missing, 50);
    for (const chunk of chunks) {
        const greekMap = await fetchPublicOptionGreeks(chunk, publicConfig);
        if (!greekMap) continue;
        greekMap.forEach((greeks, osi) => {
            cache.set(osi, greeks);
        });
    }
}

export type DeltaCandidateResult = {
    strikes: number[];
    bestDiff?: number;
    bestDelta?: number;
    otmOnly: boolean;
};

export async function selectDeltaCandidates(
    symbol: string,
    targetExp: string,
    right: 'C' | 'P',
    targetDelta: number,
    currentPrice: number,
    publicOsiMap: Map<string, string>,
    publicConfig: PublicMarketConfig,
    cache: Map<string, PublicOptionQuote>,
    maxCandidates = 12,
    otmOnly = true
): Promise<DeltaCandidateResult> {
    const prefix = `${symbol}|${targetExp}|${right}|`;
    const candidates: Array<{ strike: number; delta: number; diff: number }> = [];

    for (const [key, osi] of publicOsiMap.entries()) {
        if (!key.startsWith(prefix)) continue;
        const strike = Number(key.split('|')[3]);
        if (!Number.isFinite(strike)) continue;
        if (otmOnly) {
            if (right === 'C' && strike < currentPrice) continue;
            if (right === 'P' && strike > currentPrice) continue;
        }
        let greeks = cache.get(osi);
        if (!greeks) {
            const greekMap = await fetchPublicOptionGreeks([osi], publicConfig);
            greeks = greekMap?.get(osi);
            if (greeks) cache.set(osi, greeks);
        }
        if (!greeks || typeof greeks.delta !== 'number') continue;
        const diff = Math.abs(greeks.delta - targetDelta);
        candidates.push({ strike, delta: greeks.delta, diff });
    }

    candidates.sort((a, b) => a.diff - b.diff);
    const selected = candidates.slice(0, maxCandidates);
    return {
        strikes: selected.map((item) => item.strike),
        bestDiff: selected[0]?.diff,
        bestDelta: selected[0]?.delta,
        otmOnly
    };
}

export function mapWinProbToOtmPct(targetWinProb: number) {
    const baseline = Math.max(60, Math.min(85, targetWinProb));
    const scaled = (baseline - 50) / 100;
    return Math.max(0.02, Math.min(0.12, scaled));
}

export function pickExpiration(expirations: string[], range: { minDays: number; maxDays: number }) {
    const selected = selectExpiration(expirations, range);
    return selected || expirations[0];
}

export function pickStrike(
    strikes: number[],
    currentPrice: number,
    right: 'C' | 'P',
    targetWinProb: number
) {
    const otmPct = mapWinProbToOtmPct(targetWinProb);
    const otmTarget = right === 'C'
        ? currentPrice * (1 + otmPct)
        : currentPrice * (1 - otmPct);
    const sorted = [...strikes].sort((a, b) => a - b);
    let closest = sorted[0];
    let minDiff = Math.abs(sorted[0] - otmTarget);
    for (const strike of sorted) {
        const diff = Math.abs(strike - otmTarget);
        if (diff < minDiff) {
            minDiff = diff;
            closest = strike;
        }
    }
    return closest;
}

export function buildStrikeCandidates(
    strikes: number[],
    currentPrice: number,
    right: 'C' | 'P',
    targetWinProb: number,
    maxCandidates = 10
) {
    const sorted = [...strikes].sort((a, b) => a - b);
    const target = pickStrike(sorted, currentPrice, right, targetWinProb);
    const idx = sorted.indexOf(target);
    if (idx === -1) return sorted.slice(0, maxCandidates);

    const radius = Math.max(2, Math.floor(maxCandidates / 2));
    const start = Math.max(0, idx - radius);
    const end = Math.min(sorted.length, idx + radius + 1);
    return sorted.slice(start, end);
}

export function normalizeQuote(raw: QuoteResult | undefined): QuoteResult {
    if (!raw) return {};
    const bid = raw.bid ?? raw.meta?.bid;
    const ask = raw.ask ?? raw.meta?.ask;
    const last = raw.last ?? raw.meta?.last;
    const close = (raw as { close?: number; meta?: { close?: number } }).close
        ?? (raw as { close?: number; meta?: { close?: number } }).meta?.close;
    const modelOptPrice = raw.modelOptPrice ?? raw.meta?.modelOptPrice;

    let premium: number | undefined;
    let premiumSource: OptionLeg['premiumSource'] | undefined;

    if (typeof bid === 'number' && typeof ask === 'number' && bid > 0 && ask > 0) {
        premium = (bid + ask) / 2;
        premiumSource = 'mid';
    } else if (typeof bid === 'number' && bid > 0) {
        premium = bid;
        premiumSource = 'bid';
    } else if (typeof ask === 'number' && ask > 0) {
        premium = ask;
        premiumSource = 'ask';
    } else if (typeof last === 'number' && last > 0) {
        premium = last;
        premiumSource = 'last';
    } else if (typeof close === 'number' && close > 0) {
        premium = close;
        premiumSource = 'close';
    } else if (typeof modelOptPrice === 'number' && modelOptPrice > 0) {
        premium = modelOptPrice;
        premiumSource = 'model';
    }

    return {
        ...raw,
        bid,
        ask,
        last,
        close,
        modelOptPrice,
        premium,
        premiumSource
    };
}

export function hasQuotePrice(quote?: QuoteResult | null) {
    if (!quote) return false;
    return [quote.bid, quote.ask, quote.last, quote.modelOptPrice]
        .some((value) => typeof value === 'number' && value > 0);
}

export async function fetchIbkrHistoricalOptionQuote(
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    contract: {
        symbol: string;
        expiration: string;
        strike: number;
        right: 'C' | 'P';
    }
): Promise<QuoteResult | null> {
    if (disableHistoricalOptionFallback()) return null;
    const cacheKey = `${contract.symbol}|${contract.expiration}|${contract.right}|${contract.strike}`;
    const cached = historicalOptionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < HIST_OPTION_CACHE_TTL_MS) {
        return cached.quote;
    }
    try {
        const response = await fetchWithTimeout(`${bridgeUrl}/historical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secType: 'OPT',
                symbol: contract.symbol,
                expiration: contract.expiration,
                strike: contract.strike,
                right: contract.right,
                barSize: process.env.IB_OPTION_HIST_BAR_SIZE || '15 mins',
                duration: process.env.IB_OPTION_HIST_DURATION || '1 D'
            })
        }, 60000, bridgeApiKey);
        if (!response.ok) return null;
        const rawPayload = await response.json();
        const payload = parseIbkrResponse(
            ibkrHistoricalSchema,
            rawPayload,
            `historical/${contract.symbol}`
        );
        const bars = payload && Array.isArray(payload.bars) ? payload.bars : [];
        if (!bars.length) {
            historicalOptionCache.set(cacheKey, { timestamp: Date.now(), quote: null });
            return null;
        }
        const lastBar = bars[bars.length - 1];
        const price = lastBar.close ?? lastBar.average;
        if (price === undefined || price <= 0) {
            historicalOptionCache.set(cacheKey, { timestamp: Date.now(), quote: null });
            return null;
        }
        const quote = { last: price, close: price, reason: 'historical' };
        historicalOptionCache.set(cacheKey, { timestamp: Date.now(), quote });
        return quote;
    } catch (error) {
        console.warn(`[liveMarketData] historical option fallback failed for ${contract.symbol} ${contract.expiration} ${contract.right} ${contract.strike}:`, error);
        historicalOptionCache.set(cacheKey, { timestamp: Date.now(), quote: null });
        return null;
    }
}

export function selectOptionLegFromQuotes(
    symbol: string,
    currentPrice: number,
    targetWinProb: number,
    right: 'C' | 'P',
    targetExp: string,
    candidates: number[],
    quoteMap: Map<number, QuoteResult>
): { leg: OptionLeg | null; reason?: string } {
    const formattedExp = formatExpiration(targetExp);
    const targetDeltaAbs = 1 - (targetWinProb / 100);
    const targetDelta = right === 'C' ? targetDeltaAbs : -targetDeltaAbs;

    const quotes = candidates.map((strike) => ({
        strike,
        res: normalizeQuote(quoteMap.get(strike))
    }));

    let bestMatch: { strike: number; res: QuoteResult; score: number } | null = null;
    const validQuotes = [];

    for (const item of quotes) {
        const { strike, res } = item;
        const premium = res.premium || 0;
        if (premium <= 0) continue;

        const delta = res.delta;
        if (typeof delta !== 'number' || delta === 0) {
            continue;
        }

        const deltaDiff = Math.abs(delta - targetDelta);
        const score = -deltaDiff;
        validQuotes.push({ strike, delta, premium, score });

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { strike, res, score };
        }
    }

    console.log('[liveMarketData] Candidate Scoring:', JSON.stringify(validQuotes.map(q => ({
        k: q.strike,
        d: q.delta?.toFixed(3),
        err: Math.abs((q.delta || 0) - targetDelta).toFixed(3)
    }))));

    if (!bestMatch) {
        const targetStrike = candidates.length > 0
            ? pickStrike(candidates, currentPrice, right, targetWinProb)
            : currentPrice;
        const premiumFallback = quotes
            .map(({ strike, res }) => ({
                strike,
                res,
                premium: res.premium ?? 0
            }))
            .filter((item) => item.premium > 0)
            .sort((a, b) => {
                const diffA = Math.abs(a.strike - targetStrike);
                const diffB = Math.abs(b.strike - targetStrike);
                if (diffA !== diffB) return diffA - diffB;
                return b.premium - a.premium;
            })[0];

        if (premiumFallback) {
            console.log(`[liveMarketData] fallback-premium for ${symbol} @ strike ${premiumFallback.strike}`);
            bestMatch = {
                strike: premiumFallback.strike,
                res: premiumFallback.res,
                score: -998
            };
        } else {
            const modelFallback = quotes.find(q => q.res.modelOptPrice && q.res.modelOptPrice > 0);
            if (modelFallback) {
                console.log(`[liveMarketData] fallback-model for ${symbol} @ strike ${modelFallback.strike}`);
                bestMatch = {
                    strike: modelFallback.strike,
                    res: {
                        premium: modelFallback.res.modelOptPrice,
                        premiumSource: 'model',
                        delta: modelFallback.res.delta,
                        meta: modelFallback.res.meta
                    },
                    score: -999
                };
            } else {
                console.log(`[liveMarketData] No suitable match (live or model) for ${symbol} ${formattedExp} ${right}. Candidates checked: ${quotes.length}`);
                return { leg: null, reason: 'no-match' };
            }
        }
    }

    const { strike: selectedStrike, res: quoteResult } = bestMatch;
    const daysOut = daysToExpiration(targetExp);
    const premium = quoteResult.premium!;
    const collateral = right === 'C' ? currentPrice : selectedStrike;
    const annualizedYield = calculateAnnualizedYield(premium, collateral, daysOut);
    const winProb = typeof quoteResult.delta === 'number'
        ? calculateWinProbFromDelta(quoteResult.delta)
        : undefined;

    const winProbDiff = winProb !== undefined ? winProb - targetWinProb : undefined;
    console.log(`[liveMarketData] SELECTED: ${symbol} $${selectedStrike} ${right} | Prm=$${premium.toFixed(2)} | Delta=${quoteResult.delta?.toFixed(3)} | Win=${winProb}% (Target=${targetWinProb}%, Diff=${winProbDiff ?? 'n/a'})`);

    return {
        leg: {
            strike: selectedStrike,
            expiration: formattedExp,
            premium: Math.round(premium * 100) / 100,
            annualizedYield: Math.round(annualizedYield * 10) / 10,
            premiumSource: quoteResult.premiumSource,
            delta: quoteResult.delta,
            gamma: quoteResult.gamma,
            theta: quoteResult.theta,
            vega: quoteResult.vega,
            winProb
        }
    };
}
