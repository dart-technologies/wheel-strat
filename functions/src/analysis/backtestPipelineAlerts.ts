import * as admin from "firebase-admin";
import type { PriceBar, TailEvent, summarizeTailEvents } from "@wheel-strat/shared";
import { computeMaxDrawdown } from "./backtestPipelineSeries";
import { SCENARIO_ALERT_COOLDOWN_HOURS, STRATEGY_ALERT_COOLDOWN_HOURS } from "./backtestPipelineConfig";

export function buildPremiumHeadline(symbol: string, right: "C" | "P", ratio: number) {
    const side = right === "P" ? "Put" : "Call";
    const pct = Math.max(0, (ratio - 1) * 100);
    return `💰 ${symbol} ${side} Premium +${pct.toFixed(0)}%`;
}

export function buildPremiumBody(ratio: number, ivRank?: number | null) {
    const ratioLabel = ratio.toFixed(2);
    const ivLabel = ivRank !== null && ivRank !== undefined ? ` IV Rank ${Math.round(ivRank)}.` : "";
    return `Market premium ${ratioLabel}x model.${ivLabel}`;
}

export function buildPatternHeadline(symbol: string, event: TailEvent, reboundRate?: number) {
    const dropPct = Math.abs(event.dropPct) * 100;
    const hours = Math.max(1, Math.round(event.durationMinutes / 60));
    if (reboundRate && reboundRate >= 0.7) {
        return `⚡ ${symbol} Snapback Zone (${dropPct.toFixed(1)}% in ${hours}h)`;
    }
    return `⚡ ${symbol} Fast Flush (${dropPct.toFixed(1)}% in ${hours}h)`;
}

export function buildPatternBody(event: TailEvent, summary: ReturnType<typeof summarizeTailEvents>) {
    const reboundRatePct = Math.round(summary.reboundRate * 100);
    const avgReboundPct = Math.round(summary.avgReboundPct * 1000) / 10;
    const dropPct = Math.abs(event.dropPct) * 100;
    return `Drop ${dropPct.toFixed(1)}% → rebound rate ${reboundRatePct}% (avg +${avgReboundPct}%).`;
}

export async function shouldSendAlert(
    symbol: string,
    patternId: string,
    cooldownMinutes: number
) {
    const db = admin.firestore();
    const docId = `${symbol}_${patternId}`;
    const ref = db.collection("pattern_alerts").doc(docId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return true;
    const lastSent = snapshot.data()?.lastSent?.toDate?.();
    if (!lastSent) return true;
    const elapsedMinutes = (Date.now() - lastSent.getTime()) / (60 * 1000);
    return elapsedMinutes >= cooldownMinutes;
}

export function computeScenarioSignature(bars: PriceBar[]) {
    if (bars.length === 0) return null;
    const closes = bars.map((bar) => bar.close);
    const start = closes[0];
    const end = closes[closes.length - 1];
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null;
    const totalReturn = (end - start) / start;
    const maxDrawdown = computeMaxDrawdown(closes);
    return { totalReturn, maxDrawdown };
}

export async function shouldSendScenarioAlert(symbol: string, scenarioId: string) {
    const db = admin.firestore();
    const docId = `${symbol}_${scenarioId}`;
    const ref = db.collection("scenario_alerts").doc(docId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return true;
    const lastSent = snapshot.data()?.lastSent?.toDate?.();
    if (!lastSent) return true;
    const elapsedHours = (Date.now() - lastSent.getTime()) / (60 * 60 * 1000);
    return elapsedHours >= SCENARIO_ALERT_COOLDOWN_HOURS;
}

export async function shouldSendStrategyAlert(symbol: string, strategyName: string) {
    const db = admin.firestore();
    const docId = `${symbol}_${strategyName}`;
    const ref = db.collection("strategy_alerts").doc(docId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return true;
    const lastSent = snapshot.data()?.lastSent?.toDate?.();
    if (!lastSent) return true;
    const elapsedHours = (Date.now() - lastSent.getTime()) / (60 * 60 * 1000);
    return elapsedHours >= STRATEGY_ALERT_COOLDOWN_HOURS;
}

export async function sendPatternAlert(title: string, body: string, data?: Record<string, string>) {
    const { sendPushNotification } = await import("../notifications/notifications");
    await sendPushNotification({ title, body, data });
}
