import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { HistoricalRepository } from "@/lib/historicalRepository";
import { isMarketOpen } from "@/lib/time";
import { fetchWithTimeout } from "@/lib/fetch";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { getMarketDataProvider, MarketSnapshot } from "@/lib/marketDataProvider";
import { PUBLIC_API_SECRET } from "@/lib/publicMarketData";
import { ibkrHealthSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import type { PositionSnapshot } from "./positionAlertsTypes";
import { triggerAlert } from "./positionAlertsService";

/**
 * Monitor portfolio positions for significant price movements
 * Scheduled every 5 minutes during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
 */
export const monitorPositionPrices = onSchedule({
    schedule: '*/5 9-16 * * 1-5', // Every 5 mins, 9 AM - 4 PM ET, Mon-Fri (isMarketOpen handles 9:30 start & holidays)
    timeZone: 'America/New_York',
    secrets: [PUBLIC_API_SECRET]
}, async (event) => {
    const { bridgeUrl, bridgeApiKey, tradingMode, bridgeUrlConfigured, isEmulator } = requireIbkrBridge();
    const db = admin.firestore();
    const resolvedBridgeUrl = bridgeUrl;
    const ALERT_THRESHOLD = 1.5; // +/- 1.5%

    console.log('📊 Position Monitor: Checking for price alerts...');
    console.log(`Trading mode: ${tradingMode}`);

    if (!isEmulator && !bridgeUrlConfigured) {
        console.warn('IBKR_BRIDGE_URL not configured; skipping position alerts.');
        return;
    }

    // Skip if outside market hours or on holiday
    if (!isMarketOpen(new Date())) {
        console.log('Market is closed (weekend, holiday, or outside hours), skipping');
        return;
    }

    // Get tracked positions from Firestore
    const positionsSnapshot = await db.collection('positionSnapshots').get();
    if (positionsSnapshot.empty) {
        console.log('No position snapshots to monitor');
        return;
    }

    // Health check the bridge
    try {
        const healthRes = await fetchWithTimeout(`${resolvedBridgeUrl}/health`, {}, 15000, bridgeApiKey);
        const rawHealth = await healthRes.json();
        const health = parseIbkrResponse(ibkrHealthSchema, rawHealth, 'health');
        if (!health?.connected) {
            console.log('IBKR Bridge not connected, skipping');
            return;
        }
    } catch {
        console.log('Cannot reach IBKR Bridge, skipping');
        return;
    }

    // Check each position
    const historicalRepo = new HistoricalRepository(); // Instantiate once
    const marketProvider = getMarketDataProvider();
    const symbols = positionsSnapshot.docs.map(doc => (doc.data() as PositionSnapshot).symbol);

    // Fetch all market snapshots in parallel (this uses the optimized provider)
    const snapshots = await marketProvider.getMarketSnapshot(symbols);
    const snapshotMap = new Map<string, MarketSnapshot>(snapshots.map(s => [s.symbol, s]));

    // Process each position in parallel
    await Promise.all(positionsSnapshot.docs.map(async (doc) => {
        const snapshot = doc.data() as PositionSnapshot;
        const { symbol, previousClose } = snapshot;

        try {
            const marketData = snapshotMap.get(symbol);
            const currentPrice = marketData?.price;
            if (!currentPrice || !previousClose) return;

            // Calculate change % from previous close
            const changePercent = ((currentPrice - previousClose) / previousClose) * 100;

            // 2. Fetch Live RSI
            const rsi = await historicalRepo.calculateLiveRSI(symbol, currentPrice);

            // --- CHECK ALERTS ---

            // Condition A: Price Movement > 1.5%
            if (Math.abs(changePercent) >= ALERT_THRESHOLD) {
                await triggerAlert(db, symbol, changePercent, 'price', `Price moved ${changePercent.toFixed(1)}%`, currentPrice, rsi ?? 50, marketData.ivRank ?? 0);
            }

            // Condition B: RSI Surge (> 70 or < 30) - "Overbought/Oversold"
            if (rsi) {
                if (rsi > 70) await triggerAlert(db, symbol, rsi, 'rsi', `RSI Surge (${rsi.toFixed(0)}) - Overbought`, currentPrice, rsi, marketData.ivRank ?? 0);
                if (rsi < 30) await triggerAlert(db, symbol, rsi, 'rsi', `RSI Dip (${rsi.toFixed(0)}) - Oversold`, currentPrice, rsi, marketData.ivRank ?? 0);
            }

            // Condition C: IV Rank (Already fetched in snapshot)
            if (marketData.ivRank !== undefined && marketData.ivRank > 70) {
                await triggerAlert(db, symbol, marketData.ivRank, 'iv', `High IV Rank (${marketData.ivRank})`, currentPrice, rsi ?? 50, marketData.ivRank);
            }

        } catch (error) {
            console.error(`Error checking ${symbol}:`, error);
        }
    }));

    console.log('📊 Position Monitor: Check complete');
});

/**
 * Update position snapshots (call this when market closes or positions change)
 * Can be called manually or via a scheduled function at market close
 */
export const updatePositionSnapshots = onCall(async (request) => {
    const data = request.data;
    const db = admin.firestore();
    const { positions } = data as {
        positions: Array<{ symbol: string; currentPrice: number }>;
    };

    const batch = db.batch();
    for (const pos of positions) {
        const ref = db.collection('positionSnapshots').doc(pos.symbol);
        batch.set(ref, {
            symbol: pos.symbol,
            previousClose: pos.currentPrice,
            lastChecked: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    console.log(`Updated ${positions.length} position snapshots`);

    return { updated: positions.length };
});
