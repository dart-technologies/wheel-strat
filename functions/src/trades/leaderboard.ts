import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import type { LeaderboardEntry } from "./leaderboardUtils";
import {
    clampYield,
    computeClosedOptionYields,
    formatDisplayName,
    loadTtodBotEntry,
    resolveOptionTrade
} from "./leaderboardUtils";

type ResolvedOptionTrade = NonNullable<ReturnType<typeof resolveOptionTrade>>;

export const getLeaderboard = onCall({ timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
    try {
        const db = admin.firestore();
        const force = request.data?.force === true;
        const targetUserId = request.data?.userId;

        // If targetUserId is provided, we just want the cycles for that user
        if (targetUserId) {
            const snapshot = await db.collection('user_trades').where('userId', '==', targetUserId).get();
            const trades: any[] = [];
            snapshot.forEach(doc => trades.push({ ...doc.data(), id: doc.id }));
            
            logger.info(`[Leaderboard] User ${targetUserId} has ${trades.length} trades`);
            
            const tradesByKey = new Map<string, ResolvedOptionTrade[]>();
            let resolvedCount = 0;
            trades.forEach((trade) => {
                const optionTrade = resolveOptionTrade(trade);
                if (optionTrade) {
                    resolvedCount++;
                    const list = tradesByKey.get(optionTrade.key) || [];
                    list.push(optionTrade);
                    tradesByKey.set(optionTrade.key, list);
                } else {
                    logger.info(`[Leaderboard] Trade not resolved as option:`, {
                        symbol: trade.symbol,
                        type: trade.type,
                        secType: trade.secType,
                        right: trade.right,
                        strike: trade.strike,
                        expiration: trade.expiration
                    });
                }
            });
            
            logger.info(`[Leaderboard] Resolved ${resolvedCount} option trades into ${tradesByKey.size} unique contracts`);

            const cycles: any[] = [];
            const now = new Date();
            const dayMs = 24 * 60 * 60 * 1000;

            tradesByKey.forEach((list, key) => {
                if (list.length === 0) return;
                logger.info(`[Leaderboard] Processing contract ${key} with ${list.length} trades`);
                
                const ordered = [...list].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
                const first = ordered[0];
                if (!first) return;
                
                const { strike, multiplier, expiration } = first;
                let openQty = 0;
                let cycleQty = 0;
                let cycleCredit = 0;
                let cycleStart: Date | null = null;

                ordered.forEach((trade, idx) => {
                    logger.info(`[Leaderboard]   Trade ${idx + 1}: ${trade.side} ${trade.quantity} @ ${trade.price} on ${trade.tradeDate.toISOString()}`);
                    
                    if (trade.side === 'SELL') {
                        if (openQty === 0) {
                            cycleStart = trade.tradeDate;
                            cycleQty = 0;
                            cycleCredit = 0;
                            logger.info(`[Leaderboard]     Starting new cycle`);
                        }
                        openQty += trade.quantity;
                        cycleQty += trade.quantity;
                        cycleCredit += trade.price * trade.quantity * multiplier;
                        if (trade.commission) cycleCredit -= trade.commission;
                        logger.info(`[Leaderboard]     After SELL: openQty=${openQty}, cycleCredit=${cycleCredit}`);
                    } else if (openQty > 0) {
                        const offset = Math.min(openQty, trade.quantity);
                        cycleCredit -= trade.price * offset * multiplier;
                        if (trade.commission) cycleCredit -= trade.commission;
                        openQty -= offset;
                        logger.info(`[Leaderboard]     After BUY: openQty=${openQty}, cycleCredit=${cycleCredit}`);
                        
                        if (openQty === 0 && cycleStart) {
                            const daysHeld = Math.max(1, Math.ceil((trade.tradeDate.getTime() - cycleStart.getTime()) / dayMs));
                            const collateral = strike * multiplier * cycleQty;
                            const annualizedYield = (cycleCredit / collateral) * (365 / daysHeld) * 100;
                            logger.info(`[Leaderboard]     CYCLE CLOSED: yield=${annualizedYield.toFixed(2)}%`);
                            cycles.push({
                                symbol: first.key.split('|')[0],
                                type: 'CYCLE',
                                date: trade.tradeDate.toISOString().split('T')[0],
                                yield: clampYield(annualizedYield),
                                id: `cycle_${targetUserId}_${first.key}_${trade.tradeDate.getTime()}`
                            });
                            cycleStart = null;
                        }
                    } else {
                        logger.info(`[Leaderboard]     Skipping BUY (no open position)`);
                    }
                });

                if (openQty > 0 && expiration.getTime() <= now.getTime() && cycleStart) {
                    const daysHeld = Math.max(1, Math.ceil((expiration.getTime() - (cycleStart as Date).getTime()) / dayMs));
                    const collateral = strike * multiplier * cycleQty;
                    const annualizedYield = (cycleCredit / collateral) * (365 / daysHeld) * 100;
                    logger.info(`[Leaderboard]     CYCLE EXPIRED: yield=${annualizedYield.toFixed(2)}%`);
                    cycles.push({
                        symbol: first.key.split('|')[0],
                        type: 'CYCLE_EXP',
                        date: expiration.toISOString().split('T')[0],
                        yield: clampYield(annualizedYield),
                        id: `cycle_exp_${targetUserId}_${first.key}_${expiration.getTime()}`
                    });
                } else if (openQty > 0) {
                    logger.info(`[Leaderboard]     Position still OPEN: ${openQty} contracts, expires ${expiration.toISOString()}`);
                }
            });
            
            logger.info(`[Leaderboard] Found ${cycles.length} completed cycles for user ${targetUserId}`);

            return { cycles: cycles.sort((a, b) => b.date.localeCompare(a.date)) };
        }
        
        // 1. Check Cache (1 hour expiration) - Skip if force=true
        const cacheRef = db.collection('leaderboards').doc('global');
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (!force) {
            const cacheSnap = await cacheRef.get();
            if (cacheSnap.exists) {
                const cachedData = cacheSnap.data();
                const updatedAtMs = Number(cachedData?.updatedAt);
                
                if (updatedAtMs > oneHourAgo && Array.isArray(cachedData?.leaderboard)) {
                    return { 
                        updatedAt: updatedAtMs, 
                        leaderboard: cachedData.leaderboard as LeaderboardEntry[] 
                    };
                }
            }
        }

        // 2. Compute Fresh Leaderboard
        const snapshot = await db.collection('user_trades').get();
        const tradesByUser = new Map<string, Record<string, any>[]>();
        let missingUserId = 0;

        snapshot.forEach((doc: any) => {
            const trade = doc.data() as Record<string, any>;
            const userId = trade.userId;
            if (!userId) {
                missingUserId += 1;
                return;
            }
            const list = tradesByUser.get(userId) || [];
            list.push(trade);
            tradesByUser.set(userId, list);
        });
        if (missingUserId > 0) {
            logger.warn(`[Leaderboard] ${missingUserId} trades missing userId; skipping.`);
        }

        const stats = new Map<string, { tradeCount: number; yieldSum: number; yieldCount: number }>();
        const now = new Date();
        tradesByUser.forEach((trades, userId) => {
            const yields = computeClosedOptionYields(trades, now);
            if (yields.length === 0) {
                const resolvedTrades = trades
                    .map((trade) => resolveOptionTrade(trade))
                    .filter((trade): trade is ResolvedOptionTrade => Boolean(trade));
                if (resolvedTrades.length > 0) {
                    stats.set(userId, { tradeCount: resolvedTrades.length, yieldSum: 0, yieldCount: 0 });
                }
                return;
            }
            const sum = yields.reduce((acc, value) => acc + value, 0);
            stats.set(userId, { tradeCount: yields.length, yieldSum: sum, yieldCount: yields.length });
        });

        // Only include users with option trades; stock-only activity should not populate leaderboard rows.

        if (stats.size === 0) {
            const ttodEntry = await loadTtodBotEntry(db);
            const emptyLeaderboard = ttodEntry ? [ttodEntry] : [];
            const emptyResult = { updatedAt: Date.now(), leaderboard: emptyLeaderboard as LeaderboardEntry[] };
            await cacheRef.set(emptyResult);
            return emptyResult;
        }

        const entries = Array.from(stats.entries()).map(([userId, entry]) => ({
            userId,
            tradeCount: entry.tradeCount,
            yieldPct: entry.yieldCount > 0 ? entry.yieldSum / entry.yieldCount : 0
        }));

        entries.sort((a, b) => {
            if (b.yieldPct !== a.yieldPct) return b.yieldPct - a.yieldPct;
            return b.tradeCount - a.tradeCount;
        });

        const top = entries.slice(0, 10);
        const auth = admin.auth();
        const leaderboard = await Promise.all(top.map(async (entry) => {
            try {
                const userRecord = await auth.getUser(entry.userId);
                return {
                    ...entry,
                    displayName: formatDisplayName(userRecord.displayName || undefined, userRecord.email || undefined, entry.userId)
                };
            } catch (error) {
                logger.warn('Failed to resolve user name for leaderboard', { userId: entry.userId });
                return {
                    ...entry,
                    displayName: formatDisplayName(undefined, undefined, entry.userId)
                };
            }
        }));

        const updatedAtMs = Date.now();
        const ttodEntry = await loadTtodBotEntry(db);
        const finalLeaderboard = ttodEntry
            ? [ttodEntry, ...leaderboard.filter((entry) => entry.userId !== ttodEntry.userId)]
            : leaderboard;
        const result = { 
            updatedAt: updatedAtMs, 
            leaderboard: finalLeaderboard 
        };
        
        // 3. Update Cache
        await cacheRef.set(result);
        
        return result;
    } catch (error) {
        logger.error('Leaderboard fetch failed', error);
        throw new HttpsError('internal', 'Failed to build leaderboard');
    }
});
