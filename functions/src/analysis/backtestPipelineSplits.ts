import { getDB } from "@/lib/cloudsql";
import { PriceBar } from "@wheel-strat/shared";
import type { SplitFactor } from "./backtestPipelineTypes";
import {
    SPLIT_CANONICAL_RATIOS,
    SPLIT_MAX_RATIO,
    SPLIT_MIN_RATIO,
    SPLIT_RATIO_TOLERANCE,
    splitFactorCache
} from "./backtestPipelineConfig";
import { extractDateKey } from "./backtestPipelineSeries";

function findNearestSplitRatio(ratio: number) {
    let nearest = SPLIT_CANONICAL_RATIOS[0];
    let bestDiff = Math.abs(ratio - nearest);
    for (const candidate of SPLIT_CANONICAL_RATIOS) {
        const diff = Math.abs(ratio - candidate);
        if (diff < bestDiff) {
            bestDiff = diff;
            nearest = candidate;
        }
    }
    return { nearest, diff: bestDiff };
}

export function detectSplitFactors(bars: PriceBar[]): SplitFactor[] {
    if (bars.length < 2) return [];
    const detected: SplitFactor[] = [];
    for (let i = 1; i < bars.length; i += 1) {
        const prev = bars[i - 1];
        const current = bars[i];
        if (!Number.isFinite(prev.close) || !Number.isFinite(current.close) || prev.close <= 0) continue;
        const ratio = current.close / prev.close;
        if (!Number.isFinite(ratio)) continue;
        if (ratio > SPLIT_MIN_RATIO && ratio < SPLIT_MAX_RATIO) continue;

        const { nearest, diff } = findNearestSplitRatio(ratio);
        const relDiff = nearest > 0 ? diff / nearest : 1;
        if (relDiff > SPLIT_RATIO_TOLERANCE) continue;

        const date = extractDateKey(current.date);
        if (!date) continue;
        detected.push({
            date,
            factor: nearest,
            detectedRatio: ratio,
            source: 'detected',
            confidence: Math.max(0, 1 - relDiff)
        });
    }
    return detected;
}

export async function loadSplitFactors(symbol: string): Promise<SplitFactor[]> {
    const cached = splitFactorCache.get(symbol);
    if (cached) return cached;

    const db = getDB();
    const rows = await db('split_factors')
        .where({ symbol })
        .orderBy('date', 'desc');
    const factors = rows
        .map((row) => ({
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
            factor: Number(row.factor),
            detectedRatio: row.detected_ratio !== undefined && row.detected_ratio !== null ? Number(row.detected_ratio) : undefined,
            source: row.source ? String(row.source) : undefined,
            confidence: row.confidence !== undefined && row.confidence !== null ? Number(row.confidence) : undefined
        }))
        .filter((row) => row.date && Number.isFinite(row.factor) && row.factor > 0);

    splitFactorCache.set(symbol, factors);
    return factors;
}

export function applySplitAdjustments(bars: PriceBar[], splitFactors: SplitFactor[]) {
    if (!splitFactors.length) {
        return { bars, adjusted: false };
    }
    const sortedSplits = [...splitFactors].sort((a, b) => b.date.localeCompare(a.date));
    let splitIndex = 0;
    let cumulativeFactor = 1;
    const adjustedBars = bars.map((bar) => ({ ...bar }));

    for (let i = adjustedBars.length - 1; i >= 0; i -= 1) {
        const bar = adjustedBars[i];
        const barDate = extractDateKey(bar.date);
        while (splitIndex < sortedSplits.length && sortedSplits[splitIndex].date > barDate) {
            cumulativeFactor *= sortedSplits[splitIndex].factor;
            splitIndex += 1;
        }
        if (cumulativeFactor !== 1) {
            bar.open *= cumulativeFactor;
            bar.high *= cumulativeFactor;
            bar.low *= cumulativeFactor;
            bar.close *= cumulativeFactor;
            if (Number.isFinite(bar.volume) && bar.volume > 0) {
                bar.volume = bar.volume / cumulativeFactor;
            }
        }
    }
    return { bars: adjustedBars, adjusted: true };
}
