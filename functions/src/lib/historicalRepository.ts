import { getDB, isDbConfigured } from './cloudsql';
import { fetchFallbackBars, fetchFallbackContext, resolveFallbackPath } from './historicalRepositoryFallback';
import { HistoricalBarsResult, HistoricalContext } from './historicalRepositoryTypes';

export class HistoricalRepository {
    private db: ReturnType<typeof getDB> | null = null;

    private getDb() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }

    private shouldUseDb(): boolean {
        return isDbConfigured();
    }

    /**
     * Get historical context for a list of symbols
     * Tries Database first, falls back to local JSON if empty/error
     */
    async getHistoricalContext(
        symbols: string[],
        priceMap: Record<string, number> = {}
    ): Promise<Record<string, HistoricalContext>> {
        const results: Record<string, HistoricalContext> = {};

        for (const symbol of symbols) {
            const normalized = symbol.toUpperCase();
            try {
                // Try fetching from DB
                const context = await this.fetchFromDB(normalized);
                if (context) {
                    results[normalized] = context;
                } else {
                    // Fallback to JSON
                    const fallback = await fetchFallbackContext(normalized);
                    if (fallback) {
                        results[normalized] = fallback;
                    } else if (Number.isFinite(priceMap[normalized])) {
                        results[normalized] = this.buildSyntheticContext(normalized, priceMap[normalized]);
                    }
                }
            } catch (error) {
                console.warn(`Error fetching history for ${normalized}, trying fallback...`, error);
                const fallback = await fetchFallbackContext(normalized);
                if (fallback) {
                    results[normalized] = fallback;
                } else if (Number.isFinite(priceMap[normalized])) {
                    results[normalized] = this.buildSyntheticContext(normalized, priceMap[normalized]);
                }
            }
        }

        const normalizedSymbols = symbols.map((symbol) => symbol.toUpperCase());
        const missingSymbols = normalizedSymbols.filter((symbol) => {
            const context = results[symbol];
            if (!context?.priceHistory?.length) return true;
            return context.source === 'synthetic';
        });

        if (missingSymbols.length === normalizedSymbols.length && normalizedSymbols.length > 0) {
            const fallbackPath = resolveFallbackPath();
            const dbStatus = this.shouldUseDb() ? 'enabled' : 'disabled';
            const fallbackStatus = fallbackPath ? `found at ${fallbackPath}` : 'missing';
            console.warn(
                `[HistoricalRepository] No historical data found for symbols: ${normalizedSymbols.join(', ')}. ` +
                `Sources tried - DB: ${dbStatus}, fallback: ${fallbackStatus}.`
            );
        }

        return results;
    }

    async getHistoricalBars(
        symbol: string,
        options: { limit?: number; startDate?: string; endDate?: string } = {}
    ): Promise<HistoricalBarsResult | null> {
        const normalized = symbol.toUpperCase();
        if (this.shouldUseDb()) {
            try {
                const db = this.getDb();
                let query = db('historical_prices').where({ symbol: normalized });
                if (options.startDate) {
                    query = query.andWhere('date', '>=', options.startDate);
                }
                if (options.endDate) {
                    query = query.andWhere('date', '<=', options.endDate);
                }
                query = query.orderBy('date', 'desc');
                if (options.limit) {
                    query = query.limit(options.limit);
                }
                const rows = await query;
                if (rows && rows.length > 0) {
                    const bars = rows.map((row) => ({
                        date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
                        open: Number(row.open ?? row.close),
                        high: Number(row.high ?? row.close),
                        low: Number(row.low ?? row.close),
                        close: Number(row.close),
                        volume: Number(row.volume ?? 0),
                    })).reverse();
                    return { symbol: normalized, bars, source: 'db' };
                }
            } catch (error) {
                console.warn(`Historical DB fetch failed for ${normalized}:`, error);
            }
        }

        const fallbackBars = await fetchFallbackBars(normalized, options);
        if (!fallbackBars || fallbackBars.length === 0) return null;
        return { symbol: normalized, bars: fallbackBars, source: 'fallback' };
    }

    private async fetchFromDB(symbol: string): Promise<HistoricalContext | null> {
        if (!this.shouldUseDb()) return null;
        const normalized = symbol.toUpperCase();

        try {
            const db = this.getDb();
            // 1. Get Technicals
            const tech = await db('technical_indicators')
                .where({ symbol: normalized })
                .orderBy('date', 'desc')
                .first();

            // 2. Get Price History (Last 30 days + 1 year range)
            const history = await db('historical_prices')
                .where({ symbol: normalized })
                .orderBy('date', 'desc')
                .limit(260); // ~1 year trading days

            if (!history || history.length === 0) return null;

            const closes = history.map(r => Number(r.close));
            const last30 = closes.slice(0, 30).reverse(); // Oldest to newest for sparkline
            const yearHigh = Math.max(...closes);
            const yearLow = Math.min(...closes);
            const volumeSlice = history.slice(0, 20);
            const avgVolume = volumeSlice.length > 0
                ? volumeSlice.reduce((sum, r) => sum + Number(r.volume), 0) / volumeSlice.length
                : null;

            return {
                symbol: normalized,
                rsi_14: tech?.rsi_14 ? Number(tech.rsi_14) : null,
                sma_20: tech?.sma_20 ? Number(tech.sma_20) : null,
                sma_50: tech?.sma_50 ? Number(tech.sma_50) : null,
                sma_200: tech?.sma_200 ? Number(tech.sma_200) : null,
                priceHistory: last30,
                yearHigh,
                yearLow,
                avgVolume,
                source: 'db'
            };
        } catch (error) {
            console.error(`DB fetch failed for ${symbol}:`, error);
            return null;
        }
    }

    private buildSyntheticContext(symbol: string, price: number): HistoricalContext {
        const normalizedPrice = Number(price);
        const priceHistory = Array.from({ length: 30 }, () => normalizedPrice);
        return {
            symbol,
            rsi_14: null,
            sma_20: normalizedPrice,
            sma_50: normalizedPrice,
            sma_200: normalizedPrice,
            priceHistory,
            yearHigh: normalizedPrice,
            yearLow: normalizedPrice,
            avgVolume: null,
            source: 'synthetic'
        };
    }

    /**
     * "Flash Backtest"
     * Checks how often a similar downside buffer would have held up over the last year.
     * @param symbol 
     * @param currentPrice 
     * @param strike 
     * @param daysToManurity 
     */
    async calculateFlashBacktest(symbol: string, currentPrice: number, strike: number, daysToManurity: number): Promise<{ winRate: number, maxLoss: number } | null> {
        // Simple "Strike Buffer" Logic:
        // If stock is $100 and strike is $90, buffer is 10%.
        // We look at all N-day periods in history. How many dropped > 10%?

        try {
            const normalized = symbol.toUpperCase();
            if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
            if (!Number.isFinite(strike) || strike <= 0) return null;
            if (!Number.isFinite(daysToManurity) || daysToManurity <= 1) return null;

            const context = await this.fetchFromDB(normalized) || await fetchFallbackContext(normalized);
            if (!context || !context.priceHistory || context.priceHistory.length < daysToManurity) return null;

            // We need the full history, not just the last 30 days used for sparklines
            // Re-fetch or rely on the fact that fetchFromDB limit was 260
            // NOTE: fetchFromDB limits priceHistory return to last 30, but we can access local processing
            // For now, let's just use the data we have. 
            // Better: update logic to return full history if needed, or re-query.
            // Let's re-query locally in this method for simplicity of the "Flash" concept,
            // or modify fetchFromDB to return more.
            // For efficiency, assume fetchFromDB returned enough raw rows but sliced them.
            // Let's fix fetchFromDB to return full raw history? No, that bloats the context for everyone.
            // Let's just create a private helper to get raw closes.

            const closes = await this.getRawCloses(normalized);
            if (closes.length < daysToManurity + 20) return null;

            const bufferPct = (strike - currentPrice) / currentPrice; // e.g. -0.10 for 10% drop

            let wins = 0;
            let total = 0;
            let maxLossPct = 0;

            // Simple rolling window backtest
            for (let i = 0; i < closes.length - daysToManurity; i++) {
                const startPrice = closes[i];
                // Look forward N days

                // Did it breach?
                // Actually for a Put sale, we care if the PRICE AT EXPIRATION is below strike?
                // Or if it EVER touched strike? 
                // "American style assignment risk" -> touched strike.
                // "European style / cash settlement" -> expiration.
                // Wheel strategy: usually care about assignment at expiration, 
                // BUT touching strike is scary. Let's be conservative: Ever touched.

                const periodPrices = closes.slice(i, i + daysToManurity);
                const minPrice = Math.min(...periodPrices);
                const dropPct = (minPrice - startPrice) / startPrice;

                if (dropPct > bufferPct) { // bufferPct is negative, e.g. -0.10. 
                    // If drop is -0.05, -0.05 > -0.10 (True, Safe).
                    // If drop is -0.15, -0.15 > -0.10 (False, Breached).
                    wins++;
                }

                if (dropPct < maxLossPct) maxLossPct = dropPct;
                total++;
            }

            if (total === 0) return null;

            return {
                winRate: Math.round((wins / total) * 100),
                maxLoss: Math.round(maxLossPct * 100)
            };

        } catch (error) {
            console.error("Backtest failed:", error);
            return null;
        }
    }

    private async getRawCloses(symbol: string): Promise<number[]> {
        // quick implementation reusing fallback/db logic for generic 'all data'
        // Ideally this leverages the existing connection
        try {
            const normalized = symbol.toUpperCase();
            if (this.shouldUseDb()) {
                const db = this.getDb();
                const history = await db('historical_prices')
                    .where({ symbol: normalized })
                    .orderBy('date', 'desc') // Newest first
                    .limit(260);

                if (history && history.length > 0) {
                    return history.map(r => Number(r.close)).reverse(); // Return oldest -> newest
                }
            }

            return await this.getRawClosesFromFallback(normalized, 260);
        } catch {
            return [];
        }
    }

    private async getRawClosesFromFallback(symbol: string, limit = 260): Promise<number[]> {
        const bars = await fetchFallbackBars(symbol, { limit });
        if (!bars || bars.length === 0) return [];
        return bars.map(bar => bar.close);
    }

    /**
     * Calculate Live RSI using historical closes + current real-time price
     */
    async calculateLiveRSI(symbol: string, currentPrice: number): Promise<number | null> {
        const closes = await this.getRawCloses(symbol);
        if (closes.length < 14) return null;

        // Append current price as the latest "close" for approximation
        // Or replace the last if it's the same day? 
        // For simplicity, treating current price as the "developing" candle of the day.
        const periods = 14;
        const data = [...closes, currentPrice];

        let gains = 0;
        let losses = 0;

        // Calculate initial Average Gain/Loss
        for (let i = 1; i <= periods; (i++)) {
            const diff = data[i] - data[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / periods;
        let avgLoss = losses / periods;

        // Smooth rest (Wilder's Smoothing)
        // We only have one new data point (currentPrice) beyond the 14 initial?
        // Actually, if we hauled 20 items, we iterate through them.
        for (let i = periods + 1; i < data.length; i++) {
            const diff = data[i] - data[i - 1];
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;

            avgGain = ((avgGain * 13) + gain) / 14;
            avgLoss = ((avgLoss * 13) + loss) / 14;
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
}
