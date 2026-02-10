import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {
    MAG7_STRATEGIES,
    PriceBar,
    SCENARIO_LIBRARY,
    TailEvent,
    blackScholesPrice,
    calculateThetaGrade,
    findRapidDrops,
    getEasternDate,
    isMarketOpen,
    summarizeTailEvents,
    validateStrategy
} from "@wheel-strat/shared";
import { fetchOptionQuote, getMarketDataProvider } from "@/lib/marketDataProvider";
import { getDB, initSchema, isDbConfigured, resolveDbConnection } from "@/lib/cloudsql";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import {
    formatYmd,
    handleManualRequest,
    parseBooleanEnv,
    parseForceFlag,
    pickExpiration,
    pickStrike
} from "./backtestPipelineUtils";
import {
    ALERT_COOLDOWN_MINUTES,
    ALERT_MIN_IV_RANK,
    ALERT_MIN_PREMIUM_RATIO,
    ALERT_MIN_REBOUND_RATE,
    INTRADAY_BAR_SIZE,
    INTRADAY_USE_RTH,
    PATTERN_DAILY_DROP_PCT,
    PATTERN_DAILY_EXTREME_DROP_PCT,
    PATTERN_DAILY_MAX_MINUTES,
    PATTERN_DAILY_REBOUND_MINUTES,
    PATTERN_INTRADAY_DROP_PCT,
    PATTERN_INTRADAY_LOOKBACK_DAYS,
    PATTERN_INTRADAY_MAX_MINUTES,
    PATTERN_INTRADAY_REBOUND_MINUTES,
    PREMIUM_ANOMALY_COOLDOWN_MINUTES,
    PREMIUM_ANOMALY_MIN_IV_RANK,
    PREMIUM_ANOMALY_MIN_RATIO,
    PREMIUM_ANOMALY_RISK_FREE_RATE,
    SCENARIO_DRAWDOWN_TOLERANCE,
    SCENARIO_RETURN_TOLERANCE,
    splitFactorCache,
    STRATEGY_ALERT_MIN_WIN_RATE,
    VOL_BUCKET_WINDOW_DAYS,
    VOL_REGIME_BACKFILL_DAYS,
    VOL_REGIME_BATCH_SIZE,
    WATCHLIST
} from "./backtestPipelineConfig";
import type { SplitFactor, StrategyBucketAccumulator, VolBucket, VolThresholds } from "./backtestPipelineTypes";
import { computeImpliedVolFromPremium, timeToExpirationYears } from "./backtestPipelineOptions";
import { detectSplitFactors } from "./backtestPipelineSplits";
import {
    buildPriceBars,
    buildRealizedVolSeries,
    buildVolThresholds,
    calculateRealizedVol,
    chunkRows,
    extractDateKey,
    resolveVolBucket
} from "./backtestPipelineSeries";
import { fetchIbkrQuote, fetchScenarioBars, loadDailyBars, loadIntradayBars } from "./backtestPipelineData";
import {
    insertPremiumAnomaly,
    markAlertSent,
    markScenarioSent,
    markStrategySent,
    upsertPatternStats,
    upsertPatternStatsVol,
    upsertStrategyStats,
    upsertStrategyStatsVol
} from "./backtestPipelinePersistence";
import {
    buildPatternBody,
    buildPatternHeadline,
    buildPremiumBody,
    buildPremiumHeadline,
    computeScenarioSignature,
    sendPatternAlert,
    shouldSendAlert,
    shouldSendScenarioAlert,
    shouldSendStrategyAlert
} from "./backtestPipelineAlerts";


export async function ingestSplitFactorsInternal(symbols?: string[]) {
    if (!isDbConfigured()) {
        console.warn('Skipping split factor ingest; DB not configured.');
        return;
    }
    const polygonEnabled = Boolean(process.env.POLYGON_API_KEY);
    const allowDetectedWithPolygon = parseBooleanEnv(process.env.SPLIT_DETECT_ALLOW_WITH_POLYGON, false);
    if (polygonEnabled && !allowDetectedWithPolygon) {
        console.warn('Polygon API key detected; skipping detected split ingestion.');
        return;
    }
    await initSchema();
    const db = getDB();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;

    for (const symbol of targetSymbols) {
        try {
            const rows = await db('historical_prices')
                .where({ symbol, adjusted: false })
                .orderBy('date', 'asc');
            const bars = buildPriceBars(rows, 'date');
            const detected = detectSplitFactors(bars);
            if (!detected.length) continue;

            const unique = new Map<string, SplitFactor>();
            for (const factor of detected) {
                if (!factor.date) continue;
                if (!unique.has(factor.date)) {
                    unique.set(factor.date, factor);
                }
            }

            const authoritativeRows = await db('split_factors')
                .where({ symbol })
                .whereNot('source', 'detected')
                .select('date');
            const authoritativeDates = new Set(
                authoritativeRows.map((row) => row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date))
            );

            await db('split_factors')
                .where({ symbol, source: 'detected' })
                .del();

            const rowsToInsert = Array.from(unique.values())
                .filter((factor) => factor.date && !authoritativeDates.has(factor.date))
                .map((factor) => ({
                    symbol,
                    date: factor.date,
                    factor: factor.factor,
                    detected_ratio: factor.detectedRatio ?? null,
                    source: factor.source ?? 'detected',
                    confidence: factor.confidence ?? null
                }));

            if (rowsToInsert.length) {
                await db('split_factors')
                    .insert(rowsToInsert)
                    .onConflict(['symbol', 'date'])
                    .ignore();
                splitFactorCache.delete(symbol);
            }
        } catch (error) {
            console.warn(`Split factor ingest failed for ${symbol}:`, error);
        }
    }
}

export async function refreshVolatilityRegimesInternal(symbols?: string[]) {
    const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured } = requireIbkrBridge();
    if (!bridgeUrlConfigured || !isDbConfigured()) {
        console.warn('Skipping volatility regime refresh (missing DB or bridge config).');
        return;
    }
    await initSchema();
    const db = getDB();
    const easternToday = formatYmd(getEasternDate(new Date()));
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    const marketProvider = getMarketDataProvider();

    for (const symbol of targetSymbols) {
        try {
            const quote = await fetchIbkrQuote(bridgeUrl, bridgeApiKey, symbol);
            let impliedVol = quote?.impliedVol ?? null;

            if (impliedVol === null) {
                const snapshots = await marketProvider.getMarketSnapshot([symbol]);
                const spot = snapshots[0]?.price;
                const chain = await marketProvider.getOptionChain(symbol);
                if (spot && chain?.expirations?.length && chain?.strikes?.length) {
                    const expiration = pickExpiration(chain.expirations);
                    const strike = pickStrike(chain.strikes, spot);
                    if (expiration && strike) {
                        const optQuote = await fetchOptionQuote(
                            bridgeUrl,
                            symbol,
                            strike,
                            expiration,
                            'C',
                            bridgeApiKey
                        );
                        const premium = optQuote.premium ?? optQuote.last ?? optQuote.close;
                        const timeToExp = timeToExpirationYears(expiration);
                        if (premium && timeToExp) {
                            impliedVol = computeImpliedVolFromPremium({
                                premium,
                                spot,
                                strike,
                                timeToExpYears: timeToExp,
                                rate: PREMIUM_ANOMALY_RISK_FREE_RATE,
                                right: 'C'
                            });
                        }
                    }
                }
            }

            const dailyBarsResult = await loadDailyBars(symbol, 3000);
            const closes = dailyBarsResult.bars.map((bar) => Number(bar.close)).filter((value) => Number.isFinite(value));
            const realizedVol = calculateRealizedVol(closes, 20);

            if (impliedVol === null && realizedVol === null) continue;

            let ivRank = null;
            let ivPercentile = null;
            if (impliedVol !== null) {
                const recentIv = await db('volatility_regimes')
                    .where({ symbol })
                    .whereNotNull('implied_vol')
                    .orderBy('date', 'desc')
                    .limit(252);
                const ivSeries = recentIv.map((row) => Number(row.implied_vol)).filter((value) => Number.isFinite(value));
                const ivMin = ivSeries.length ? Math.min(...ivSeries) : null;
                const ivMax = ivSeries.length ? Math.max(...ivSeries) : null;
                ivRank = (ivMin !== null && ivMax !== null && ivMax !== ivMin)
                    ? ((impliedVol - ivMin) / (ivMax - ivMin)) * 100
                    : null;
                const sorted = [...ivSeries].sort((a, b) => a - b);
                ivPercentile = sorted.length
                    ? (sorted.filter((value) => value <= impliedVol).length / sorted.length) * 100
                    : null;
            }

            await db('volatility_regimes')
                .insert({
                    symbol,
                    date: easternToday,
                    implied_vol: impliedVol,
                    realized_vol: realizedVol,
                    iv_rank: ivRank,
                    iv_percentile: ivPercentile,
                    source: 'ibkr'
                })
                .onConflict(['symbol', 'date', 'source'])
                .merge();
        } catch (error) {
            console.warn(`Failed to refresh volatility regime for ${symbol}:`, error);
        }
    }
}

export const refreshVolatilityRegimes = onSchedule({
    schedule: '5 17 * * 1-5',
    timeZone: 'America/New_York'
}, async () => {
    await refreshVolatilityRegimesInternal();
});

export const refreshVolatilityRegimesManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, refreshVolatilityRegimesInternal, WATCHLIST);
});

export async function backfillVolatilityRegimesInternal(symbols?: string[]) {
    if (!isDbConfigured()) {
        console.warn('Skipping volatility regime backfill; DB not configured.');
        return;
    }
    await initSchema();
    const db = getDB();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    const cutoffDate = VOL_REGIME_BACKFILL_DAYS > 0
        ? (() => {
            const now = getEasternDate(new Date());
            now.setDate(now.getDate() - VOL_REGIME_BACKFILL_DAYS);
            return formatYmd(now);
        })()
        : null;

    for (const symbol of targetSymbols) {
        try {
            const dailyResult = await loadDailyBars(symbol);
            const volSeries = buildRealizedVolSeries(dailyResult.bars, VOL_BUCKET_WINDOW_DAYS);
            const entries = Array.from(volSeries.volByDate.entries())
                .filter(([date]) => !cutoffDate || date >= cutoffDate);
            if (!entries.length) continue;

            const rows = entries.map(([date, realizedVol]) => ({
                symbol,
                date,
                realized_vol: realizedVol,
                source: 'ibkr'
            }));

            for (const chunk of chunkRows(rows, VOL_REGIME_BATCH_SIZE)) {
                if (!chunk.length) continue;
                await db('volatility_regimes')
                    .insert(chunk)
                    .onConflict(['symbol', 'date', 'source'])
                    .merge({
                        realized_vol: db.raw('excluded.realized_vol'),
                        updated_at: db.fn.now()
                    });
            }
        } catch (error) {
            console.warn(`Volatility regime backfill failed for ${symbol}:`, error);
        }
    }
}

export const backfillVolatilityRegimes = onSchedule({
    schedule: '30 17 * * 0',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 540
}, async () => {
    await backfillVolatilityRegimesInternal();
});

export const backfillVolatilityRegimesManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, backfillVolatilityRegimesInternal, WATCHLIST);
});

export const ingestSplitFactors = onSchedule({
    schedule: '10 17 * * 1-5',
    timeZone: 'America/New_York'
}, async () => {
    await ingestSplitFactorsInternal();
});

export const ingestSplitFactorsManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, ingestSplitFactorsInternal, WATCHLIST);
});

export async function precomputePatternStatsInternal(symbols?: string[]) {
    if (!isDbConfigured()) {
        console.warn('Skipping pattern stats; DB not configured.');
        return;
    }
    const connection = resolveDbConnection();
    console.log(`📡 Pattern stats DB connection: ${JSON.stringify(connection)}`);
    await initSchema();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;

    for (const symbol of targetSymbols) {
        try {
            const dailyResult = await loadDailyBars(symbol);
            const dailyBars = dailyResult.bars;
            const volSeries = dailyBars.length
                ? buildRealizedVolSeries(dailyBars, VOL_BUCKET_WINDOW_DAYS)
                : { volByDate: new Map<string, number>(), values: [] };
            const volThresholds = buildVolThresholds(volSeries.values, VOL_BUCKET_WINDOW_DAYS);
            if (dailyBars.length) {
                const dailyPatterns = [
                    {
                        id: 'tail_drop_10pct_3d',
                        dropPct: PATTERN_DAILY_DROP_PCT,
                        maxDurationMinutes: PATTERN_DAILY_MAX_MINUTES
                    },
                    {
                        id: 'tail_drop_30pct_3d',
                        dropPct: PATTERN_DAILY_EXTREME_DROP_PCT,
                        maxDurationMinutes: PATTERN_DAILY_MAX_MINUTES
                    }
                ];

                for (const pattern of dailyPatterns) {
                    const events = findRapidDrops(dailyBars, {
                        dropPct: pattern.dropPct,
                        maxDurationMinutes: pattern.maxDurationMinutes,
                        reboundWindowMinutes: PATTERN_DAILY_REBOUND_MINUTES,
                        barIntervalMinutes: 1440
                    });
                    const summary = summarizeTailEvents(events);
                    await upsertPatternStats(symbol, pattern.id, '1 day', summary, {
                        dropPct: pattern.dropPct,
                        maxDurationMinutes: pattern.maxDurationMinutes,
                        reboundWindowMinutes: PATTERN_DAILY_REBOUND_MINUTES,
                        sampleStart: dailyBars[0]?.date,
                        sampleEnd: dailyBars[dailyBars.length - 1]?.date,
                        regularTradingHours: true,
                        adjusted: dailyResult.adjusted
                    });

                    if (volThresholds) {
                        const bucketed = new Map<VolBucket, TailEvent[]>();
                        for (const event of events) {
                            const dateKey = extractDateKey(event.endDate);
                            const bucket = resolveVolBucket(volSeries.volByDate.get(dateKey), volThresholds);
                            if (!bucket) continue;
                            if (!bucketed.has(bucket)) bucketed.set(bucket, []);
                            bucketed.get(bucket)?.push(event);
                        }
                        for (const [bucket, bucketEvents] of bucketed.entries()) {
                            if (!bucketEvents.length) continue;
                            const bucketSummary = summarizeTailEvents(bucketEvents);
                            await upsertPatternStatsVol(symbol, pattern.id, '1 day', bucket, bucketSummary, {
                                dropPct: pattern.dropPct,
                                maxDurationMinutes: pattern.maxDurationMinutes,
                                reboundWindowMinutes: PATTERN_DAILY_REBOUND_MINUTES,
                                sampleStart: dailyBars[0]?.date,
                                sampleEnd: dailyBars[dailyBars.length - 1]?.date,
                                regularTradingHours: true,
                                adjusted: dailyResult.adjusted,
                                volSource: volThresholds.source,
                                volWindowDays: volThresholds.windowDays
                            });
                        }
                    }
                }
            }

            const intradayResult = await loadIntradayBars(symbol, PATTERN_INTRADAY_LOOKBACK_DAYS);
            const intradayBars = intradayResult.bars;
            if (intradayBars.length) {
                const events = findRapidDrops(intradayBars, {
                    dropPct: PATTERN_INTRADAY_DROP_PCT,
                    maxDurationMinutes: PATTERN_INTRADAY_MAX_MINUTES,
                    reboundWindowMinutes: PATTERN_INTRADAY_REBOUND_MINUTES
                });
                const summary = summarizeTailEvents(events);
                await upsertPatternStats(symbol, 'tail_drop_intraday', INTRADAY_BAR_SIZE, summary, {
                    dropPct: PATTERN_INTRADAY_DROP_PCT,
                    maxDurationMinutes: PATTERN_INTRADAY_MAX_MINUTES,
                    reboundWindowMinutes: PATTERN_INTRADAY_REBOUND_MINUTES,
                    sampleStart: intradayBars[0]?.date,
                    sampleEnd: intradayBars[intradayBars.length - 1]?.date,
                    regularTradingHours: INTRADAY_USE_RTH,
                    adjusted: intradayResult.adjusted
                });

                if (volThresholds) {
                    const bucketed = new Map<VolBucket, TailEvent[]>();
                    for (const event of events) {
                        const dateKey = extractDateKey(event.endDate);
                        const bucket = resolveVolBucket(volSeries.volByDate.get(dateKey), volThresholds);
                        if (!bucket) continue;
                        if (!bucketed.has(bucket)) bucketed.set(bucket, []);
                        bucketed.get(bucket)?.push(event);
                    }
                    for (const [bucket, bucketEvents] of bucketed.entries()) {
                        if (!bucketEvents.length) continue;
                        const bucketSummary = summarizeTailEvents(bucketEvents);
                        await upsertPatternStatsVol(symbol, 'tail_drop_intraday', INTRADAY_BAR_SIZE, bucket, bucketSummary, {
                            dropPct: PATTERN_INTRADAY_DROP_PCT,
                            maxDurationMinutes: PATTERN_INTRADAY_MAX_MINUTES,
                            reboundWindowMinutes: PATTERN_INTRADAY_REBOUND_MINUTES,
                            sampleStart: intradayBars[0]?.date,
                            sampleEnd: intradayBars[intradayBars.length - 1]?.date,
                            regularTradingHours: INTRADAY_USE_RTH,
                            adjusted: intradayResult.adjusted,
                            volSource: volThresholds.source,
                            volWindowDays: volThresholds.windowDays
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`Pattern stats failed for ${symbol}:`, error);
        }
    }
}

export const precomputePatternStats = onSchedule({
    schedule: '15 17 * * 1-5',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 540
}, async () => {
    await precomputePatternStatsInternal();
});

export const precomputePatternStatsManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, precomputePatternStatsInternal, WATCHLIST);
});


function initStrategyBucketStats(): Record<VolBucket, StrategyBucketAccumulator> {
    return {
        low: { wins: 0, total: 0, totalReturn: 0, maxDrawdown: 0 },
        mid: { wins: 0, total: 0, totalReturn: 0, maxDrawdown: 0 },
        high: { wins: 0, total: 0, totalReturn: 0, maxDrawdown: 0 }
    };
}

function finalizeStrategyBucketStats(stats: StrategyBucketAccumulator): ReturnType<typeof validateStrategy> {
    return {
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        totalTrades: stats.total,
        avgReturn: stats.total > 0 ? stats.totalReturn / stats.total : 0,
        maxDrawdown: stats.maxDrawdown,
        efficiencyScore: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
    };
}

function validateStrategyByVolBucket(
    recipe: any,
    history: PriceBar[],
    horizonDays: number,
    volByDate: Map<string, number>,
    thresholds: VolThresholds
) {
    const buckets = initStrategyBucketStats();

    for (let i = 200; i < history.length - horizonDays; i += 1) {
        const subHistory = history.slice(0, i);
        const currentPrice = history[i].close;
        if (!recipe.criteria(subHistory, currentPrice)) continue;

        const dateKey = extractDateKey(history[i]?.date);
        const bucket = resolveVolBucket(volByDate.get(dateKey), thresholds);
        if (!bucket) continue;

        const exitPrice = history[i + horizonDays].close;
        const tradeReturn = (exitPrice - currentPrice) / currentPrice;

        const stats = buckets[bucket];
        stats.total += 1;
        if (tradeReturn >= -0.02) {
            stats.wins += 1;
        }
        stats.totalReturn += tradeReturn;
        stats.maxDrawdown = Math.min(stats.maxDrawdown, tradeReturn);
    }

    return {
        low: finalizeStrategyBucketStats(buckets.low),
        mid: finalizeStrategyBucketStats(buckets.mid),
        high: finalizeStrategyBucketStats(buckets.high)
    };
}

export async function precomputeStrategyStatsInternal(symbols?: string[]) {
    if (!isDbConfigured()) {
        console.warn('Skipping strategy stats; DB not configured.');
        return;
    }
    await initSchema();
    const targetSymbols = symbols?.length ? symbols : Object.keys(MAG7_STRATEGIES);

    for (const symbol of targetSymbols) {
        const recipes = MAG7_STRATEGIES[symbol];
        if (!recipes?.length) continue;
        const barsResult = await loadDailyBars(symbol);
        const bars = barsResult.bars;
        if (bars.length < 260) continue;
        const sampleStart = bars[0]?.date?.split('T')[0];
        const sampleEnd = bars[bars.length - 1]?.date?.split('T')[0];
        const volSeries = buildRealizedVolSeries(bars, VOL_BUCKET_WINDOW_DAYS);
        const volThresholds = buildVolThresholds(volSeries.values, VOL_BUCKET_WINDOW_DAYS);

        for (const recipe of recipes) {
            const result = validateStrategy(recipe, bars, 30);
            await upsertStrategyStats(symbol, recipe.name, result, {
                recommendedStrategy: recipe.recommendedStrategy,
                targetDelta: recipe.targetDelta,
                horizonDays: 30,
                sampleStart,
                sampleEnd
            });

            if (volThresholds) {
                const bucketResults = validateStrategyByVolBucket(recipe, bars, 30, volSeries.volByDate, volThresholds);
                for (const [bucket, bucketResult] of Object.entries(bucketResults) as [VolBucket, ReturnType<typeof validateStrategy>][]) {
                    if (!bucketResult.totalTrades) continue;
                    await upsertStrategyStatsVol(symbol, recipe.name, bucket, bucketResult, {
                        recommendedStrategy: recipe.recommendedStrategy,
                        targetDelta: recipe.targetDelta,
                        horizonDays: 30,
                        sampleStart,
                        sampleEnd,
                        volSource: volThresholds.source,
                        volWindowDays: volThresholds.windowDays
                    });
                }
            }
        }
    }
}

export const precomputeStrategyStats = onSchedule({
    schedule: '0 18 * * 0',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 540
}, async () => {
    await precomputeStrategyStatsInternal();
});

export const precomputeStrategyStatsManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, precomputeStrategyStatsInternal, WATCHLIST);
});

async function scanAsymmetricPatternsInternal(symbols?: string[], force = false) {
    if (!isDbConfigured()) {
        console.warn('Skipping pattern scan; DB not configured.');
        return;
    }
    if (!force && !isMarketOpen(new Date())) {
        return;
    }
    await initSchema();

    const db = getDB();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    for (const symbol of targetSymbols) {
        try {
            const intradayResult = await loadIntradayBars(symbol, Math.max(2, Math.ceil(PATTERN_INTRADAY_MAX_MINUTES / 390) + 1));
            const intradayBars = intradayResult.bars;
            if (intradayBars.length < 20) continue;

            const events = findRapidDrops(intradayBars, {
                dropPct: PATTERN_INTRADAY_DROP_PCT,
                maxDurationMinutes: PATTERN_INTRADAY_MAX_MINUTES,
                reboundWindowMinutes: PATTERN_INTRADAY_REBOUND_MINUTES
            });
            if (!events.length) continue;
            const latestEvent = events[events.length - 1];
            const eventIsRecent = (intradayBars.length - 1 - latestEvent.endIndex) <= 2;
            if (!eventIsRecent) continue;

            const summaryRow = await db('pattern_stats')
                .where({
                    symbol,
                    pattern_id: 'tail_drop_intraday',
                    bar_size: INTRADAY_BAR_SIZE,
                    regular_trading_hours: INTRADAY_USE_RTH,
                    adjusted: intradayResult.adjusted,
                    source: 'ibkr'
                })
                .first();
            const summary = summarizeTailEvents(events);
            const reboundRate = summaryRow?.rebound_rate !== undefined && summaryRow?.rebound_rate !== null
                ? Number(summaryRow.rebound_rate)
                : summary.reboundRate;

            if (reboundRate < ALERT_MIN_REBOUND_RATE) continue;

            const volRow = await db('volatility_regimes')
                .where({ symbol })
                .orderBy('date', 'desc')
                .first();
            const ivRank = volRow?.iv_rank ? Number(volRow.iv_rank) : null;
            const impliedVol = volRow?.implied_vol ? Number(volRow.implied_vol) : null;
            const realizedVol = volRow?.realized_vol ? Number(volRow.realized_vol) : null;
            const premiumRatio = (impliedVol && realizedVol && realizedVol > 0) ? impliedVol / realizedVol : null;
            const thetaGrade = (impliedVol && realizedVol && ivRank !== null)
                ? calculateThetaGrade(impliedVol, realizedVol, ivRank)
                : null;

            if (ivRank !== null && ivRank < ALERT_MIN_IV_RANK) continue;
            if (premiumRatio !== null && premiumRatio < ALERT_MIN_PREMIUM_RATIO) continue;

            const canSend = await shouldSendAlert(symbol, 'tail_drop_intraday', ALERT_COOLDOWN_MINUTES);
            if (!canSend) continue;

            const headline = buildPatternHeadline(symbol, latestEvent, reboundRate);
            const body = buildPatternBody(latestEvent, summary);
            const extra = thetaGrade
                ? ` Premium: ${thetaGrade.richness} (Grade ${thetaGrade.grade}).`
                : '';

            await admin.firestore().collection('asymmetric_alerts').add({
                symbol,
                patternId: 'tail_drop_intraday',
                headline,
                body: `${body}${extra}`,
                dropPct: latestEvent.dropPct,
                durationMinutes: latestEvent.durationMinutes,
                reboundRate,
                ivRank,
                premiumRatio,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await sendPatternAlert(headline, `${body}${extra}`, {
                type: 'pattern_alert',
                symbol,
                patternId: 'tail_drop_intraday'
            });

            await markAlertSent(symbol, 'tail_drop_intraday');
        } catch (error) {
            console.warn(`Pattern scan failed for ${symbol}:`, error);
        }

        try {
            const dailyResult = await loadDailyBars(symbol);
            const dailyBars = dailyResult.bars;
            if (dailyBars.length < 10) continue;
            const dailyEvents = findRapidDrops(dailyBars, {
                dropPct: PATTERN_DAILY_DROP_PCT,
                maxDurationMinutes: PATTERN_DAILY_MAX_MINUTES,
                reboundWindowMinutes: PATTERN_DAILY_REBOUND_MINUTES,
                barIntervalMinutes: 1440
            });
            if (!dailyEvents.length) continue;
            const latestDaily = dailyEvents[dailyEvents.length - 1];
            const dailyIsRecent = (dailyBars.length - 1 - latestDaily.endIndex) <= 0;
            if (!dailyIsRecent) continue;

            const summary = summarizeTailEvents(dailyEvents);
            if (summary.reboundRate < ALERT_MIN_REBOUND_RATE) continue;

            const canSend = await shouldSendAlert(symbol, 'tail_drop_10pct_3d', ALERT_COOLDOWN_MINUTES);
            if (!canSend) continue;

            const headline = `📉 ${symbol} 3-Day Flush`;
            const body = buildPatternBody(latestDaily, summary);
            await sendPatternAlert(headline, body, {
                type: 'pattern_alert',
                symbol,
                patternId: 'tail_drop_10pct_3d'
            });
            await markAlertSent(symbol, 'tail_drop_10pct_3d');
        } catch (error) {
            console.warn(`Daily pattern scan failed for ${symbol}:`, error);
        }
    }
}

export const scanAsymmetricPatterns = onSchedule({
    schedule: '*/30 9-16 * * 1-5',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 300
}, async () => {
    await scanAsymmetricPatternsInternal();
});

export const scanAsymmetricPatternsManual = onRequest(async (req, res) => {
    const force = parseForceFlag(req);
    await handleManualRequest(req, res, async (symbols) => {
        await scanAsymmetricPatternsInternal(symbols, force);
    }, WATCHLIST);
});

async function scanPremiumAnomaliesInternal(symbols?: string[], force = false) {
    if (!isDbConfigured()) {
        console.warn('Skipping premium anomalies; DB not configured.');
        return;
    }
    const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured } = requireIbkrBridge();
    if (!bridgeUrlConfigured) {
        console.warn('Skipping premium anomalies; bridge not configured.');
        return;
    }
    if (!force && !isMarketOpen(new Date())) {
        return;
    }
    await initSchema();

    const db = getDB();
    const marketProvider = getMarketDataProvider();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    const snapshots = await marketProvider.getMarketSnapshot(targetSymbols);

    for (const snapshot of snapshots) {
        const symbol = snapshot.symbol;
        const price = snapshot.price;
        if (!Number.isFinite(price)) continue;

        try {
            const chain = await marketProvider.getOptionChain(symbol);
            if (!chain?.expirations?.length || !chain?.strikes?.length) continue;
            const expiration = pickExpiration(chain.expirations);
            const strike = pickStrike(chain.strikes, price);
            if (!expiration || !strike) continue;

            const volRow = await db('volatility_regimes')
                .where({ symbol })
                .orderBy('date', 'desc')
                .first();
            let realizedVol = volRow?.realized_vol ? Number(volRow.realized_vol) : null;
            const ivRank = volRow?.iv_rank ? Number(volRow.iv_rank) : null;

            if (realizedVol === null) {
                const dailyResult = await loadDailyBars(symbol, 90);
                const closes = dailyResult.bars.map((bar) => Number(bar.close)).filter((value) => Number.isFinite(value));
                realizedVol = calculateRealizedVol(closes, 20);
            }

            for (const right of ['P', 'C'] as const) {
                const quote = await fetchOptionQuote(bridgeUrl, symbol, strike, expiration, right, bridgeApiKey);
                const premium = quote.premium ?? null;
                if (premium === null || !Number.isFinite(premium) || premium <= 0) continue;
                const modelPrice = Number.isFinite(quote.modelOptPrice) ? Number(quote.modelOptPrice) : null;
                let impliedVol = Number.isFinite(quote.impliedVol) ? Number(quote.impliedVol) : null;
                const timeToExp = timeToExpirationYears(expiration);
                if (impliedVol === null && timeToExp) {
                    impliedVol = computeImpliedVolFromPremium({
                        premium,
                        spot: price,
                        strike,
                        timeToExpYears: timeToExp,
                        rate: PREMIUM_ANOMALY_RISK_FREE_RATE,
                        right
                    });
                }
                const sigma = realizedVol ?? impliedVol;
                const theoreticalPrice = modelPrice ?? (sigma && timeToExp
                    ? blackScholesPrice({
                        spot: price,
                        strike,
                        timeToExpYears: timeToExp,
                        rate: PREMIUM_ANOMALY_RISK_FREE_RATE,
                        volatility: sigma,
                        right
                    })
                    : null);
                const ratio = theoreticalPrice && theoreticalPrice > 0 ? premium / theoreticalPrice : null;

                await insertPremiumAnomaly({
                    symbol,
                    expiration,
                    strike,
                    right,
                    premium,
                    premiumSource: quote.premiumSource ?? null,
                    modelPrice,
                    theoreticalPrice,
                    premiumRatio: ratio,
                    impliedVol,
                    realizedVol,
                    ivRank,
                    observedAt: new Date(),
                    regularTradingHours: INTRADAY_USE_RTH,
                    adjusted: false
                });

                if (!ratio || ratio < PREMIUM_ANOMALY_MIN_RATIO) continue;
                if (ivRank !== null && ivRank < PREMIUM_ANOMALY_MIN_IV_RANK) continue;

                const canSend = await shouldSendAlert(symbol, `premium_${right}`, PREMIUM_ANOMALY_COOLDOWN_MINUTES);
                if (!canSend) continue;

                const headline = buildPremiumHeadline(symbol, right, ratio);
                const body = buildPremiumBody(ratio, ivRank);

                await sendPatternAlert(headline, body, {
                    type: 'premium_anomaly',
                    symbol,
                    expiration,
                    strike: strike.toString(),
                    right
                });

                await markAlertSent(symbol, `premium_${right}`);
            }
        } catch (error) {
            console.warn(`Premium anomaly scan failed for ${symbol}:`, error);
        }
    }
}

export const scanPremiumAnomalies = onSchedule({
    schedule: '15 10-16 * * 1-5',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 300
}, async () => {
    await scanPremiumAnomaliesInternal();
});

export const scanPremiumAnomaliesManual = onRequest(async (req, res) => {
    const force = parseForceFlag(req);
    await handleManualRequest(req, res, async (symbols) => {
        await scanPremiumAnomaliesInternal(symbols, force);
    }, WATCHLIST);
});

async function scanScenarioAlertsInternal(symbols?: string[]) {
    if (!isDbConfigured()) {
        console.warn('Skipping scenario alerts; DB not configured.');
        return;
    }
    await initSchema();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;

    for (const symbol of targetSymbols) {
        try {
            const dailyResult = await loadDailyBars(symbol);
            const dailyBars = dailyResult.bars;
            if (dailyBars.length < 60) continue;

            for (const scenario of SCENARIO_LIBRARY) {
                const scenarioBars = await fetchScenarioBars(symbol, scenario.startDate, scenario.endDate);
                if (scenarioBars.length < 10) continue;

                const scenarioSignature = computeScenarioSignature(scenarioBars);
                if (!scenarioSignature) continue;

                const windowLength = scenarioBars.length;
                const recentWindow = dailyBars.slice(-windowLength);
                if (recentWindow.length < windowLength) continue;
                const recentSignature = computeScenarioSignature(recentWindow);
                if (!recentSignature) continue;

                const returnDelta = Math.abs(recentSignature.totalReturn - scenarioSignature.totalReturn);
                const drawdownDelta = Math.abs(recentSignature.maxDrawdown - scenarioSignature.maxDrawdown);

                if (returnDelta <= SCENARIO_RETURN_TOLERANCE && drawdownDelta <= SCENARIO_DRAWDOWN_TOLERANCE) {
                    const canSend = await shouldSendScenarioAlert(symbol, scenario.id);
                    if (!canSend) continue;

                    const headline = `🚨 ${symbol} Echoing ${scenario.name}`;
                    const body = `Current move matches ${scenario.name} (${scenario.startDate} → ${scenario.endDate}).`;

                    await sendPatternAlert(headline, body, {
                        type: 'scenario_alert',
                        symbol,
                        scenarioId: scenario.id
                    });
                    await markScenarioSent(symbol, scenario.id);
                }
            }
        } catch (error) {
            console.warn(`Scenario scan failed for ${symbol}:`, error);
        }
    }
}

export const scanScenarioAlerts = onSchedule({
    schedule: '30 15 * * 1-5',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 300
}, async () => {
    await scanScenarioAlertsInternal();
});

export const scanScenarioAlertsManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, scanScenarioAlertsInternal, WATCHLIST);
});

async function scanStrategySignalsInternal(symbols?: string[], force = false) {
    if (!isDbConfigured()) {
        console.warn('Skipping strategy signals; DB not configured.');
        return;
    }
    if (!force && !isMarketOpen(new Date())) {
        return;
    }
    await initSchema();

    const db = getDB();
    const marketProvider = getMarketDataProvider();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    const snapshots = await marketProvider.getMarketSnapshot(targetSymbols);

    for (const snapshot of snapshots) {
        const symbol = snapshot.symbol;
        const price = snapshot.price;
        if (!Number.isFinite(price)) continue;

        const recipes = MAG7_STRATEGIES[symbol];
        if (!recipes?.length) continue;

        try {
            const barsResult = await loadDailyBars(symbol);
            const bars = barsResult.bars;
            if (bars.length < 200) continue;
            const history = bars.slice(0, -1);

            for (const recipe of recipes) {
                if (!recipe.criteria(history, price)) continue;

                const statsRow = await db('strategy_stats')
                    .where({
                        symbol,
                        strategy_name: recipe.name,
                        horizon_days: 30,
                        source: 'ibkr'
                    })
                    .first();
                const winRate = statsRow?.win_rate ? Number(statsRow.win_rate) : null;
                if (winRate !== null && winRate < STRATEGY_ALERT_MIN_WIN_RATE) continue;

                const canSend = await shouldSendStrategyAlert(symbol, recipe.name);
                if (!canSend) continue;

                const winRatePct = winRate !== null ? Math.round(winRate * 100) : null;
                const headline = `📌 ${symbol} Signal: ${recipe.name}`;
                const body = winRatePct !== null
                    ? `Historical win rate ${winRatePct}% (30d). Strategy: ${recipe.recommendedStrategy}.`
                    : `Strategy: ${recipe.recommendedStrategy}.`;

                await sendPatternAlert(headline, body, {
                    type: 'strategy_signal',
                    symbol,
                    strategy: recipe.name
                });
                await markStrategySent(symbol, recipe.name);
            }
        } catch (error) {
            console.warn(`Strategy scan failed for ${symbol}:`, error);
        }
    }
}

export const scanStrategySignals = onSchedule({
    schedule: '45 10-16 * * 1-5',
    timeZone: 'America/New_York',
    memory: "1GiB",
    timeoutSeconds: 300
}, async () => {
    await scanStrategySignalsInternal();
});

export const scanStrategySignalsManual = onRequest(async (req, res) => {
    const force = parseForceFlag(req);
    await handleManualRequest(req, res, async (symbols) => {
        await scanStrategySignalsInternal(symbols, force);
    }, WATCHLIST);
});
