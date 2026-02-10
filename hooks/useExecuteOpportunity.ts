import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Opportunity } from '@wheel-strat/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/features/portfolio/hooks';
import { getOrderGuard } from '@/utils/orderGuards';
import { formatCurrency } from '@/utils/format';
import { Analytics } from '@/services/analytics';
import { placeOrder, triggerCommunityPortfolioSync, triggerSync } from '@/services/trading';
import { createOrderIntent, updateOrderIntent, removeOrderIntent } from '@/services/orders';

type ExecuteOpportunityInput = {
    symbol: string;
    strategy: string;
    strike: number;
    expiration: string;
    premium?: number;
};

type ExecuteOptions = {
    quantity?: number;
    confirmTitle?: string;
    confirmActionLabel?: string;
    source?: string;
    onStart?: () => void;
    onSuccess?: (orderId?: number) => void;
    onError?: (error: unknown) => void;
};

export function useExecuteOpportunity() {
    const { isAuthenticated, user } = useAuth();
    const { portfolio, positions } = usePortfolio();
    const [executing, setExecuting] = useState(false);

    const executeOpportunity = useCallback((opp: ExecuteOpportunityInput, options?: ExecuteOptions) => {
        if (!opp) return;
        if (!isAuthenticated || !user) {
            Alert.alert("Authentication Required", "Please sign in to execute trades on the shared IBKR account.");
            return;
        }

        if (!opp.strike || !opp.expiration) {
            Alert.alert("Missing Contract", "Missing strike or expiration. Cannot execute.");
            return;
        }

        const quantity = options?.quantity ?? 1;
        const buyingPower = portfolio.buyingPower ?? portfolio.cash;
        const guard = getOrderGuard({
            strategy: opp.strategy,
            symbol: opp.symbol,
            strike: opp.strike,
            quantity,
            buyingPower,
            positions
        });
        if (!guard.allowed) {
            Alert.alert("Order Blocked", guard.message || "Not enough buying power to place this order.");
            return;
        }

        const isCoveredCall = opp.strategy?.toLowerCase?.().includes('call');
        const action = isCoveredCall ? 'SELL' : 'BUY';
        const premiumLabel = typeof opp.premium === 'number' ? formatCurrency(opp.premium) : 'MARKET';
        const confirmTitle = options?.confirmTitle || 'Confirm Order';
        const confirmActionLabel = options?.confirmActionLabel || 'Submit Order';

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        Alert.alert(
            confirmTitle,
            `Place Limit ${action} for ${opp.symbol}?\n\nContract: ${opp.symbol} ${opp.expiration} $${opp.strike} ${isCoveredCall ? 'Call' : 'Put'}\nLimit Price: ${premiumLabel}\nQty: ${quantity}`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: confirmActionLabel,
                    style: "default",
                    onPress: async () => {
                        options?.onStart?.();
                        const intentId = createOrderIntent({
                            symbol: opp.symbol,
                            type: (opp.strategy?.toLowerCase?.().includes('call') ? 'CC' : 'CSP') as 'CC' | 'CSP',
                            quantity,
                            price: opp.premium,
                            strike: opp.strike,
                            expiration: opp.expiration,
                            right: isCoveredCall ? 'C' : 'P'
                        });
                        try {
                            setExecuting(true);
                            const res = await placeOrder(opp as Opportunity, user.uid, quantity);
                            if (res.error) {
                                throw res.error;
                            }

                            updateOrderIntent(intentId, {
                                orderStatus: res.data.status || 'Submitted',
                                status: 'PendingIntent',
                                orderId: res.data.orderId
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            Alert.alert("Order Placed", `Order ID: ${res.data.orderId}\nStatus: ${res.data.status}`);
                            Analytics.logTradeExecution(opp.symbol, options?.source || 'Execution');
                            triggerSync().catch(console.error);
                            triggerCommunityPortfolioSync().catch(console.error);
                            options?.onSuccess?.(res.data.orderId);
                        } catch (error) {
                            updateOrderIntent(intentId, {
                                status: 'Failed',
                                orderStatus: 'Failed'
                            });
                            removeOrderIntent(intentId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert("Execution Failed", String((error as any)?.message || error));
                            options?.onError?.(error);
                        } finally {
                            setExecuting(false);
                        }
                    }
                }
            ]
        );
    }, [isAuthenticated, user, portfolio.buyingPower, portfolio.cash, positions]);

    return { executeOpportunity, executing };
}
