import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import {
    BridgePosition,
    buildPositionId,
    normalizeAccountSummary,
    normalizePosition,
    stripUndefined
} from "./communityPortfolioUtils";
import { fetchBridgePortfolioPayload } from "./portfolioSyncBridge";
import { persistPortfolioSnapshot } from "./portfolioSyncStore";

type PortfolioSyncResult = {
    success: boolean;
    positions: number;
    removed: number;
    updatedAt: string;
};

// Re-use internal fetch logic to avoid duplication, but keep it self-contained here for safety
// or extract if needed. For now, duplication of the fetch retry logic is acceptable to decouple.

async function syncUserPortfolioInternal(userId: string): Promise<PortfolioSyncResult> {
    const { bridgeUrl, bridgeApiKey, isEmulator } = requireIbkrBridge({ requireConfigured: true });

    logger.info('User portfolio sync starting', {
        userId,
        bridgeUrl,
        isEmulator
    });

    const { positionsPayload, summaryPayload } = await fetchBridgePortfolioPayload({
        bridgeUrl,
        bridgeApiKey,
        context: "User portfolio sync"
    });
    
    // Customize normalization to include P&L fields
    const rawSum = summaryPayload ?? {};
    const toNumber = (v: any) => {
         const parsed = typeof v === 'number' ? v : Number(v);
         return Number.isFinite(parsed) ? parsed : undefined;
    };
    
    const totalCashBalance = toNumber(rawSum.TotalCashBalance)
        ?? toNumber(rawSum.TotalCashValue);
    const summary = stripUndefined({
        ...normalizeAccountSummary(rawSum),
        availableFunds: totalCashBalance ?? toNumber(rawSum.AvailableFunds) ?? 0,
        buyingPower: toNumber(rawSum.BuyingPower) ?? 0,
        excessLiquidity: toNumber(rawSum.ExcessLiquidity) ?? 0,
        dailyPnL: toNumber(rawSum.DailyPnL) ?? 0,
        realizedPnL: toNumber(rawSum.RealizedPnL) ?? 0,
        unrealizedPnL: toNumber(rawSum.UnrealizedPnL) ?? 0,
        userId
    });

    const normalizedPositions = ((positionsPayload?.positions) || [])
        .map((entry) => normalizePosition(entry as BridgePosition))
        .filter((pos): pos is NonNullable<typeof pos> => pos !== null);
    const { removed } = await persistPortfolioSnapshot({
        positions: normalizedPositions,
        summary,
        positionsCollection: "user_positions",
        portfolioDocPath: `user_portfolio/${userId}`,
        buildDocId: buildPositionId,
        userId,
        docIdPrefix: userId,
        includeUserIdField: true,
        filterUserId: userId
    });

    return {
        success: true,
        positions: normalizedPositions.length,
        removed,
        updatedAt: new Date().toISOString()
    };
}

export const syncUserPortfolio = onCall({
    timeoutSeconds: 120,
    memory: '256MiB',
    invoker: 'public' // or strictly authenticated
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in to sync portfolio.');
    }

    const userId = request.auth.uid;

    try {
        const result = await syncUserPortfolioInternal(userId);
        logger.info('User portfolio sync complete', { userId, ...result });
        return result;
    } catch (error) {
        logger.error('User portfolio sync failed', { userId, error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `User portfolio sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});
