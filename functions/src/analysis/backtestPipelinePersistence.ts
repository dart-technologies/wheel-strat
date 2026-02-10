import * as admin from "firebase-admin";
import { getDB } from "@/lib/cloudsql";
import type { summarizeTailEvents } from "@wheel-strat/shared";
import type { VolBucket } from "./backtestPipelineTypes";
import type { validateStrategy } from "@wheel-strat/shared";

export async function upsertPatternStats(
    symbol: string,
    patternId: string,
    barSize: string,
    summary: ReturnType<typeof summarizeTailEvents>,
    meta: {
        dropPct: number;
        maxDurationMinutes: number;
        reboundWindowMinutes?: number;
        sampleStart?: string;
        sampleEnd?: string;
        regularTradingHours: boolean;
        adjusted: boolean;
    }
) {
    const db = getDB();
    await db("pattern_stats")
        .insert({
            symbol,
            pattern_id: patternId,
            bar_size: barSize,
            drop_pct: meta.dropPct,
            max_duration_minutes: meta.maxDurationMinutes,
            rebound_window_minutes: meta.reboundWindowMinutes ?? null,
            occurrences: summary.occurrences,
            avg_drop_pct: summary.avgDropPct,
            median_drop_pct: summary.medianDropPct,
            worst_drop_pct: summary.worstDropPct,
            rebound_rate: summary.reboundRate,
            avg_rebound_pct: summary.avgReboundPct,
            sample_start: meta.sampleStart ?? null,
            sample_end: meta.sampleEnd ?? null,
            regular_trading_hours: meta.regularTradingHours,
            adjusted: meta.adjusted,
            source: "ibkr"
        })
        .onConflict(["symbol", "pattern_id", "bar_size", "regular_trading_hours", "adjusted", "source"])
        .merge();
}

export async function upsertPatternStatsVol(
    symbol: string,
    patternId: string,
    barSize: string,
    volBucket: VolBucket,
    summary: ReturnType<typeof summarizeTailEvents>,
    meta: {
        dropPct: number;
        maxDurationMinutes: number;
        reboundWindowMinutes?: number;
        sampleStart?: string;
        sampleEnd?: string;
        regularTradingHours: boolean;
        adjusted: boolean;
        volSource: string;
        volWindowDays: number;
    }
) {
    const db = getDB();
    await db("pattern_stats_vol")
        .insert({
            symbol,
            pattern_id: patternId,
            bar_size: barSize,
            vol_bucket: volBucket,
            vol_source: meta.volSource,
            vol_window_days: meta.volWindowDays,
            drop_pct: meta.dropPct,
            max_duration_minutes: meta.maxDurationMinutes,
            rebound_window_minutes: meta.reboundWindowMinutes ?? null,
            occurrences: summary.occurrences,
            avg_drop_pct: summary.avgDropPct,
            median_drop_pct: summary.medianDropPct,
            worst_drop_pct: summary.worstDropPct,
            rebound_rate: summary.reboundRate,
            avg_rebound_pct: summary.avgReboundPct,
            sample_start: meta.sampleStart ?? null,
            sample_end: meta.sampleEnd ?? null,
            regular_trading_hours: meta.regularTradingHours,
            adjusted: meta.adjusted,
            source: "ibkr"
        })
        .onConflict(["symbol", "pattern_id", "bar_size", "vol_bucket", "regular_trading_hours", "adjusted", "vol_source", "source"])
        .merge();
}

export async function upsertStrategyStats(
    symbol: string,
    strategyName: string,
    result: ReturnType<typeof validateStrategy>,
    meta: {
        recommendedStrategy?: string;
        targetDelta?: number;
        horizonDays: number;
        sampleStart?: string;
        sampleEnd?: string;
    }
) {
    const db = getDB();
    await db("strategy_stats")
        .insert({
            symbol,
            strategy_name: strategyName,
            recommended_strategy: meta.recommendedStrategy ?? null,
            target_delta: meta.targetDelta ?? null,
            win_rate: result.winRate,
            total_trades: result.totalTrades,
            avg_return: result.avgReturn,
            max_drawdown: result.maxDrawdown,
            efficiency_score: result.efficiencyScore,
            horizon_days: meta.horizonDays,
            sample_start: meta.sampleStart ?? null,
            sample_end: meta.sampleEnd ?? null,
            source: "ibkr"
        })
        .onConflict(["symbol", "strategy_name", "horizon_days", "source"])
        .merge();
}

export async function upsertStrategyStatsVol(
    symbol: string,
    strategyName: string,
    volBucket: VolBucket,
    result: ReturnType<typeof validateStrategy>,
    meta: {
        recommendedStrategy?: string;
        targetDelta?: number;
        horizonDays: number;
        sampleStart?: string;
        sampleEnd?: string;
        volSource: string;
        volWindowDays: number;
    }
) {
    const db = getDB();
    await db("strategy_stats_vol")
        .insert({
            symbol,
            strategy_name: strategyName,
            vol_bucket: volBucket,
            vol_source: meta.volSource,
            vol_window_days: meta.volWindowDays,
            recommended_strategy: meta.recommendedStrategy ?? null,
            target_delta: meta.targetDelta ?? null,
            win_rate: result.winRate,
            total_trades: result.totalTrades,
            avg_return: result.avgReturn,
            max_drawdown: result.maxDrawdown,
            efficiency_score: result.efficiencyScore,
            horizon_days: meta.horizonDays,
            sample_start: meta.sampleStart ?? null,
            sample_end: meta.sampleEnd ?? null,
            source: "ibkr"
        })
        .onConflict(["symbol", "strategy_name", "horizon_days", "vol_bucket", "vol_source", "source"])
        .merge();
}

export async function insertPremiumAnomaly(row: {
    symbol: string;
    expiration: string;
    strike: number;
    right: "C" | "P";
    premium?: number | null;
    premiumSource?: string | null;
    modelPrice?: number | null;
    theoreticalPrice?: number | null;
    premiumRatio?: number | null;
    impliedVol?: number | null;
    realizedVol?: number | null;
    ivRank?: number | null;
    observedAt: Date;
    regularTradingHours: boolean;
    adjusted: boolean;
}) {
    const db = getDB();
    await db("premium_anomalies")
        .insert({
            symbol: row.symbol,
            expiration: row.expiration,
            strike: row.strike,
            right: row.right,
            premium: row.premium ?? null,
            premium_source: row.premiumSource ?? null,
            model_price: row.modelPrice ?? null,
            theoretical_price: row.theoreticalPrice ?? null,
            premium_ratio: row.premiumRatio ?? null,
            implied_vol: row.impliedVol ?? null,
            realized_vol: row.realizedVol ?? null,
            iv_rank: row.ivRank ?? null,
            observed_at: row.observedAt,
            regular_trading_hours: row.regularTradingHours,
            adjusted: row.adjusted,
            source: "ibkr"
        })
        .onConflict(["symbol", "expiration", "strike", "right", "observed_at", "source"])
        .ignore();
}

export async function markAlertSent(symbol: string, patternId: string) {
    const db = admin.firestore();
    const docId = `${symbol}_${patternId}`;
    await db.collection("pattern_alerts").doc(docId).set({
        symbol,
        patternId,
        lastSent: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

export async function markScenarioSent(symbol: string, scenarioId: string) {
    const db = admin.firestore();
    const docId = `${symbol}_${scenarioId}`;
    await db.collection("scenario_alerts").doc(docId).set({
        symbol,
        scenarioId,
        lastSent: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

export async function markStrategySent(symbol: string, strategyName: string) {
    const db = admin.firestore();
    const docId = `${symbol}_${strategyName}`;
    await db.collection("strategy_alerts").doc(docId).set({
        symbol,
        strategyName,
        lastSent: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}
