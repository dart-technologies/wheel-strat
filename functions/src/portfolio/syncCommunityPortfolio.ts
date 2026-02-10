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

async function syncCommunityPortfolioInternal(): Promise<PortfolioSyncResult> {
    const { bridgeUrl, bridgeApiKey, isEmulator } = requireIbkrBridge({ requireConfigured: true });

    logger.info('Community portfolio sync starting', {
        bridgeUrl,
        isEmulator
    });
    const { positionsPayload, summaryPayload } = await fetchBridgePortfolioPayload({
        bridgeUrl,
        bridgeApiKey,
        context: "Community portfolio sync"
    });
    const summary = normalizeAccountSummary(summaryPayload ?? {});

    const normalizedPositions = ((positionsPayload?.positions) || [])
        .map((entry) => normalizePosition(entry as BridgePosition))
        .filter((pos): pos is NonNullable<typeof pos> => pos !== null);
    const { removed } = await persistPortfolioSnapshot({
        positions: normalizedPositions,
        summary: stripUndefined(summary),
        positionsCollection: "community_positions",
        portfolioDocPath: "community_portfolio/main",
        buildDocId: buildPositionId
    });

    return {
        success: true,
        positions: normalizedPositions.length,
        removed,
        updatedAt: new Date().toISOString()
    };
}

export const syncCommunityPortfolio = onCall({
    timeoutSeconds: 120,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    logger.info('Community portfolio auth check', {
        hasAuth: Boolean(request.auth),
        hasAuthHeader: Boolean(request.rawRequest.headers['authorization']),
        uid: request.auth?.uid ?? null,
        signInProvider: request.auth?.token?.firebase?.sign_in_provider
            ?? request.auth?.token?.sign_in_provider
            ?? null
    });

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in to sync portfolio.');
    }

    try {
        const result = await syncCommunityPortfolioInternal();
        logger.info('Community portfolio sync complete', result);
        return result;
    } catch (error) {
        logger.error('Community portfolio sync failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Community portfolio sync failed');
    }
});
