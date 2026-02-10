import { Opportunity, Trade } from '@wheel-strat/shared';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getApp } from '@react-native-firebase/app';
import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { buildBridgeUrl, fetchBridgeWithTimeout, getIbkrConfig, calculateEfficiencyGrade as calculateEfficiencyGradeShared } from '@wheel-strat/shared';
import { Result, success, failure } from '@wheel-strat/shared';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { Config } from '@/config';

// Configuration
const { bridgeUrl, bridgeApiKey } = getIbkrConfig();
let emulatorConfigured = false;
const FUNCTIONS_REGION = 'us-central1';
const createMissingBridgeApiKeyError = () => (
    new Error('Missing IBKR bridge API key. Set EXPO_PUBLIC_IBKR_BRIDGE_API_KEY for this client build.')
);

function getCallableFunctions() {
    const functionsInstance = getFunctions(getApp(), FUNCTIONS_REGION);
    // Emulator connection is centrally handled in services/firebase.ts
    // We just ensure we return the instance.
    return functionsInstance;
}

export interface OrderResponse {
    orderId: number;
    status: string;
    message: string;
    uid?: string;
}

export type OptionOrderInput = {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    limitPrice: number;
    right: 'C' | 'P';
    strike: number;
    expiration: string;
    uid: string;
};

export interface Execution {
    execId: string;
    time: string;
    symbol: string;
    secType: string;
    side: 'BOT' | 'SLD';
    shares: number;
    price: number;
    avgPrice: number;
    orderRef: string; // Used for UID
    cumQty: number;
    strike?: number;
    right?: string;
    expiration?: string;
}

export interface CancelOrderResponse {
    orderId?: number;
    permId?: number;
    status: string;
    message?: string;
}

/**
 * Places an order via the IBKR Bridge.
 */
export async function placeOrder(opportunity: Opportunity, uid: string, quantity: number = 1): Promise<Result<OrderResponse>> {
    if (!bridgeApiKey) {
        return failure(createMissingBridgeApiKeyError());
    }
    const isOption = opportunity.strategy === 'Covered Call' || opportunity.strategy === 'Cash-Secured Put';
    const action = opportunity.strategy === 'Covered Call' || opportunity.strategy === 'Cash-Secured Put' ? 'SELL' : 'BUY';

    const payload: any = {
        symbol: opportunity.symbol,
        action: action,
        quantity: quantity,
        orderType: 'LMT',
        limitPrice: opportunity.premium || 0.01,
        secType: isOption ? 'OPT' : 'STK',
        uid: uid, // Pass Firebase UID for tracking
    };

    if (isOption) {
        payload.strike = opportunity.strike;
        payload.right = opportunity.strategy === 'Covered Call' ? 'C' : 'P';
        payload.expiration = opportunity.expiration.replace(/-/g, '');
    }

    try {
        const response = await fetchBridgeWithTimeout(buildBridgeUrl(bridgeUrl, '/order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 15000, bridgeApiKey);

        if (!response.ok) {
            const err = await response.json();
            return failure(new Error(err.error || 'Failed to place order'));
        }

        const data = await response.json();
        return success(data);
    } catch (error) {
        console.error('Order placement failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Places an option order via the IBKR Bridge with explicit action/right.
 */
export async function placeOptionOrder(input: OptionOrderInput): Promise<Result<OrderResponse>> {
    if (!bridgeApiKey) {
        return failure(createMissingBridgeApiKeyError());
    }

    const payload: any = {
        symbol: input.symbol,
        action: input.action,
        quantity: input.quantity,
        orderType: 'LMT',
        limitPrice: input.limitPrice || 0.01,
        secType: 'OPT',
        uid: input.uid,
        strike: input.strike,
        right: input.right,
        expiration: input.expiration.replace(/-/g, '')
    };

    try {
        const response = await fetchBridgeWithTimeout(buildBridgeUrl(bridgeUrl, '/order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 15000, bridgeApiKey);

        if (!response.ok) {
            const err = await response.json();
            return failure(new Error(err.error || 'Failed to place order'));
        }

        const data = await response.json();
        return success(data);
    } catch (error) {
        console.error('Option order placement failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Cancels an open order via the IBKR Bridge (if supported by the bridge).
 */
export async function cancelOrder(order: Trade): Promise<Result<CancelOrderResponse>> {
    if (!bridgeApiKey) {
        return failure(createMissingBridgeApiKeyError());
    }
    const raw = order.raw as Record<string, unknown> | undefined;
    const orderId = (order as Record<string, unknown>).orderId ?? raw?.orderId;
    const permId = (order as Record<string, unknown>).permId ?? raw?.permId;
    if (!orderId && !permId) {
        return failure(new Error('Missing order identifiers to cancel.'));
    }

    try {
        const response = await fetchBridgeWithTimeout(buildBridgeUrl(bridgeUrl, '/order/cancel'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, permId })
        }, 15000, bridgeApiKey);

        if (!response.ok) {
            const err = await response.json();
            return failure(new Error(err.error || 'Failed to cancel order'));
        }

        const data = await response.json();
        return success(data);
    } catch (error) {
        console.error('Cancel order failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Fetches recent executions from IBKR Bridge and filters/maps them.
 */
export async function fetchExecutions(uid?: string): Promise<Result<Trade[]>> {
    try {
        if (!bridgeApiKey) {
            return failure(createMissingBridgeApiKeyError());
        }
        const response = await fetchBridgeWithTimeout(
            buildBridgeUrl(bridgeUrl, '/executions'),
            {},
            15000,
            bridgeApiKey
        );

        if (!response.ok) {
            return failure(new Error('Failed to fetch executions'));
        }

        const data = await response.json();
        const executions: Execution[] = data.executions || [];

        // Map to Trade schema and filter by UID if provided
        const trades: Trade[] = executions
            .filter(exec => !uid || exec.orderRef === uid)
            .map(exec => {
                const dateObj = new Date(exec.time);
                const dateStr = !isNaN(dateObj.getTime())
                    ? dateObj.toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];

                let type: Trade['type'] = 'BUY';
                if (exec.side === 'SLD') {
                    type = 'SELL';
                }

                return {
                    id: exec.execId,
                    symbol: exec.symbol,
                    type: type,
                    quantity: exec.shares,
                    price: exec.avgPrice,
                    date: dateStr,
                    total: exec.shares * exec.avgPrice,
                    userId: exec.orderRef,
                    status: 'Filled' as const
                };
            });
        return success(trades);
    } catch (error) {
        console.error('Fetch executions failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Calculates a Capital Efficiency Grade for a completed trade.
 * Based on ROI relative to days held and entry quality.
 */
export function calculateEfficiencyGrade(
    profit: number,
    margin: number,
    daysHeld: number
): 'A' | 'B' | 'C' | 'D' | 'F' {
    return calculateEfficiencyGradeShared(profit, margin, daysHeld);
}

/**
 * Manually triggers a sync from the IBKR bridge to Firestore.
 */
export type ManualSyncOptions = {
    lookbackDays?: number;
    since?: string;
};

export async function triggerSync(options?: ManualSyncOptions): Promise<Result<{ success: boolean; newFills: number }>> {
    try {
        const manualSync = httpsCallable<ManualSyncOptions | undefined, { success: boolean; newFills: number }>(
            getCallableFunctions(),
            'manualSyncIBKR',
            { timeout: 300000 }
        );
        const result = await manualSync(options);
        return success(result.data);
    } catch (error) {
        console.error('Manual sync trigger failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Syncs the current user's portfolio from IBKR Bridge via Cloud Function.
 */
export async function syncUserPortfolio(): Promise<Result<{ success: boolean; positions: number; removed: number; updatedAt: string }>> {
    try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
            return failure(new Error('Must be signed in to sync portfolio.'));
        }
        
        await ensureFirestoreAuthReady();
        const syncPortfolio = httpsCallable<undefined, { success: boolean; positions: number; removed: number; updatedAt: string }>(
            getCallableFunctions(),
            'syncUserPortfolio',
            { timeout: 120000 }
        );
        
        const result = await syncPortfolio();
        return success(result.data);
    } catch (error) {
        console.error('User portfolio sync failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

export async function triggerCommunityPortfolioSync(): Promise<Result<{ success: boolean; positions: number; removed: number; updatedAt: string }>> {
    try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
            return failure(new Error('Must be signed in to sync community portfolio.'));
        }
        const token = await getIdToken(currentUser, true);
        await ensureFirestoreAuthReady();
        const syncPortfolio = httpsCallable<undefined, { success: boolean; positions: number; removed: number; updatedAt: string }>(
            getCallableFunctions(),
            'syncCommunityPortfolio',
            { timeout: 300000 }
        );
        try {
            const result = await syncPortfolio();
            return success(result.data);
        } catch (error) {
            const message = String(error || '').toLowerCase();
            const code = typeof error === 'object' && error && 'code' in error
                ? String((error as { code?: string }).code || '').toLowerCase()
                : '';
            const isUnauthenticated = message.includes('unauthenticated') || code.includes('unauthenticated');
            if (!isUnauthenticated) {
                throw error;
            }

            const projectId = getApp().options?.projectId || Config.firebase.projectId;
            if (!projectId) {
                return failure(new Error('Missing Firebase project ID for community sync.'));
            }

            const url = `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/syncCommunityPortfolio`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ data: {} })
            });

            let payload: any = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok) {
                const errorMessage = payload?.error?.message || `HTTP ${response.status}`;
                return failure(new Error(errorMessage));
            }

            const data = payload?.data ?? payload?.result ?? payload;
            return success(data as { success: boolean; positions: number; removed: number; updatedAt: string });
        }
    } catch (error) {
        console.error('Community portfolio sync failed:', error);
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}

export interface BridgeHealth {
    online: boolean;
    latency?: number;
    connected?: boolean;
    status?: string;
    clientId?: number;
    host?: string;
    port?: number;
    tradingMode?: string;
    error?: string;
}

/**
 * Checks the health of the IBKR bridge.
 */
export async function checkBridgeHealth(): Promise<Result<BridgeHealth>> {
    const start = Date.now();
    try {
        const healthUrl = `${buildBridgeUrl(bridgeUrl, '/health')}?connect=false`;
        const timeoutMs = 8000;
        const response = await fetchBridgeWithTimeout(
            healthUrl,
            { method: 'GET', headers: { 'Accept': 'application/json' } },
            timeoutMs,
            bridgeApiKey
        );
        const latency = Date.now() - start;
        if (!response.ok) {
            return failure(new Error(`HTTP ${response.status}`));
        }
        const data = await response.json();
        const payload = data && typeof data === 'object' ? (data as Record<string, any>) : {};
        return success({
            online: true,
            latency,
            connected: payload.connected,
            status: payload.status,
            clientId: payload.clientId,
            host: payload.host,
            port: payload.port,
            tradingMode: payload.tradingMode
        });
    } catch (error: any) {
        return failure(error instanceof Error ? error : new Error(String(error)));
    }
}
