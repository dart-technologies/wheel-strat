import * as fs from 'fs';
import * as path from 'path';
import { HistoricalBar, HistoricalContext } from './historicalRepositoryTypes';
import { calculateRSI, calculateSMA } from './historicalRepositoryMetrics';

const FALLBACK_FILENAME = 'mag7_historical_1y.json';
let cachedFallbackPath: string | null | undefined;
let cachedFallbackData: Record<string, any> | null | undefined;

export function resolveFallbackPath(): string | null {
    if (cachedFallbackPath !== undefined) {
        return cachedFallbackPath;
    }

    const candidates: string[] = [];
    if (process.env.HISTORICAL_FALLBACK_PATH) {
        candidates.push(process.env.HISTORICAL_FALLBACK_PATH);
    }
    // Build output paths (functions/lib) - prefer assets copied during build
    candidates.push(path.resolve(__dirname, `../../../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(__dirname, `../../../../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(__dirname, `../../assets/data/${FALLBACK_FILENAME}`));
    // Repo-root and functions-runtime candidates (supports running from repo root or /functions)
    candidates.push(path.resolve(process.cwd(), `assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `../../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `functions/assets/data/${FALLBACK_FILENAME}`));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            cachedFallbackPath = candidate;
            console.log(`[HistoricalRepository] Using fallback data file: ${candidate}`);
            return candidate;
        }
    }

    console.error(`Historical fallback file missing: ${FALLBACK_FILENAME}. Checked: ${candidates.join(', ')}`);
    cachedFallbackPath = null;
    return null;
}

function loadFallbackData(): Record<string, any> | null {
    if (cachedFallbackData !== undefined) {
        return cachedFallbackData;
    }
    const jsonPath = resolveFallbackPath();
    if (!jsonPath) {
        cachedFallbackData = null;
        return null;
    }

    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        cachedFallbackData = JSON.parse(rawData);
        return cachedFallbackData ?? null;
    } catch (error) {
        console.warn(`[HistoricalRepository] Failed to read fallback data: ${jsonPath}`, error);
        cachedFallbackData = null;
        return null;
    }
}

export function fetchFallbackContext(symbol: string): HistoricalContext | null {
    const data = loadFallbackData();
    if (!data) return null;

    const normalized = symbol.toUpperCase();
    const stockData = data[normalized];
    if (!stockData || !stockData.bars) return null;

    const bars = stockData.bars
        .slice()
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const closes = bars.map((b: any) => b.close);
    if (closes.length === 0) return null;

    const rsi = calculateRSI(closes.slice(0, 30).reverse());
    const volumeSlice = bars.slice(0, 20);

    return {
        symbol: normalized,
        rsi_14: rsi,
        sma_20: calculateSMA(closes, 20),
        sma_50: calculateSMA(closes, 50),
        sma_200: calculateSMA(closes, 200),
        priceHistory: closes.slice(0, 30).reverse(),
        yearHigh: Math.max(...closes),
        yearLow: Math.min(...closes),
        avgVolume: volumeSlice.length > 0
            ? volumeSlice.reduce((sum: number, b: any) => sum + b.volume, 0) / volumeSlice.length
            : null,
        source: 'fallback'
    };
}

export function fetchFallbackBars(
    symbol: string,
    options: { limit?: number; startDate?: string; endDate?: string }
): HistoricalBar[] | null {
    const data = loadFallbackData();
    if (!data) return null;

    const stockData = data[symbol];
    if (!stockData || !stockData.bars) return null;

    let bars = stockData.bars.map((b: any) => ({
        date: String(b.date),
        open: Number(b.open ?? b.close),
        high: Number(b.high ?? b.close),
        low: Number(b.low ?? b.close),
        close: Number(b.close),
        volume: Number(b.volume ?? 0),
        average: b.average !== undefined ? Number(b.average) : undefined
    }));

    if (options.startDate) {
        bars = bars.filter((b: HistoricalBar) => b.date >= options.startDate!);
    }
    if (options.endDate) {
        bars = bars.filter((b: HistoricalBar) => b.date <= options.endDate!);
    }

    bars.sort((a: HistoricalBar, b: HistoricalBar) => a.date.localeCompare(b.date));
    if (options.limit) {
        bars = bars.slice(-options.limit);
    }

    return bars;
}
