import { PriceBar } from "@wheel-strat/shared";
import type { VolBucket, VolThresholds } from "./backtestPipelineTypes";
import {
    VOL_BUCKET_HIGH_PCT,
    VOL_BUCKET_LOW_PCT,
    VOL_BUCKET_MIN_SAMPLES
} from "./backtestPipelineConfig";

export function buildPriceBars(rows: any[], dateKey: 'date' | 'timestamp'): PriceBar[] {
    return rows.map((row) => {
        const rawDate = row[dateKey];
        const dateValue = rawDate instanceof Date
            ? rawDate.toISOString()
            : String(rawDate);
        return {
            date: dateValue,
            open: Number(row.open ?? row.close ?? 0),
            high: Number(row.high ?? row.close ?? 0),
            low: Number(row.low ?? row.close ?? 0),
            close: Number(row.close ?? row.open ?? 0),
            volume: Number(row.volume ?? 0)
        };
    }).filter((bar) => Number.isFinite(bar.close) && bar.close > 0);
}

export function extractDateKey(dateValue: string) {
    if (!dateValue) return '';
    return dateValue.split('T')[0];
}

export function computeLogReturns(closes: number[]) {
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        const prev = closes[i - 1];
        const next = closes[i];
        if (!Number.isFinite(prev) || !Number.isFinite(next) || prev <= 0 || next <= 0) continue;
        returns.push(Math.log(next / prev));
    }
    return returns;
}

export function calculateRealizedVol(closes: number[], period: number = 20) {
    if (closes.length < period + 1) return null;
    const slice = closes.slice(-period - 1);
    const returns = computeLogReturns(slice);
    if (returns.length < period) return null;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252);
}

function percentile(sorted: number[], pct: number) {
    if (!sorted.length) return null;
    const clamped = Math.min(1, Math.max(0, pct));
    const index = Math.round((sorted.length - 1) * clamped);
    return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

export function buildRealizedVolSeries(bars: PriceBar[], windowDays: number) {
    const volByDate = new Map<string, number>();
    const values: number[] = [];
    const closes = bars.map((bar) => Number(bar.close));
    for (let i = windowDays; i < bars.length; i += 1) {
        const slice = closes.slice(i - windowDays, i + 1);
        const vol = calculateRealizedVol(slice, windowDays);
        if (vol === null) continue;
        const dateKey = extractDateKey(bars[i]?.date);
        if (!dateKey) continue;
        volByDate.set(dateKey, vol);
        values.push(vol);
    }
    return { volByDate, values };
}

export function buildVolThresholds(values: number[], windowDays: number): VolThresholds | null {
    if (values.length < Math.max(5, VOL_BUCKET_MIN_SAMPLES)) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const lowMax = percentile(sorted, VOL_BUCKET_LOW_PCT);
    const midMax = percentile(sorted, VOL_BUCKET_HIGH_PCT);
    if (lowMax === null || midMax === null) return null;
    return {
        lowMax,
        midMax,
        source: `realized_${windowDays}d`,
        windowDays
    };
}

export function resolveVolBucket(value: number | null | undefined, thresholds: VolThresholds): VolBucket | null {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    if (value <= thresholds.lowMax) return 'low';
    if (value <= thresholds.midMax) return 'mid';
    return 'high';
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
    if (size <= 0) return [rows];
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

export function computeMaxDrawdown(closes: number[]) {
    let peak = closes[0] || 0;
    let maxDrawdown = 0;
    for (const close of closes) {
        if (close > peak) peak = close;
        const drawdown = peak > 0 ? (close - peak) / peak : 0;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
    return maxDrawdown;
}
