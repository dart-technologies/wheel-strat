import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { placeOptionOrder, triggerCommunityPortfolioSync, triggerSync } from '@/services/trading';
import { createOrderIntent, updateOrderIntent, removeOrderIntent } from '@/services/orders';
import { formatCurrency } from '@/utils/format';
import { Analytics } from '@/services/analytics';

export type ExecuteOptionOrderInput = {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    right: 'C' | 'P';
    strike: number;
    expiration: string;
    limitPrice: number;
};

type ExecuteOptions = {
    confirmTitle?: string;
    confirmActionLabel?: string;
    source?: string;
    onSuccess?: (orderId?: number) => void;
    onError?: (error: unknown) => void;
};

export function useExecuteOptionOrder() {
    const { isAuthenticated, user } = useAuth();
    const [executing, setExecuting] = useState(false);

    const executeOptionOrder = useCallback((order: ExecuteOptionOrderInput, options?: ExecuteOptions) => {
        if (!order) return;
        if (!isAuthenticated || !user) {
            Alert.alert('Authentication Required', 'Please sign in to execute trades on the shared IBKR account.');
            return;
        }

        if (!order.strike || !order.expiration) {
            Alert.alert('Missing Contract', 'Missing strike or expiration. Cannot execute.');
            return;
        }

        const quantity = Math.max(1, Number(order.quantity || 1));
        const rightLabel = order.right === 'C' ? 'Call' : 'Put';
        const actionLabel = order.action === 'BUY' ? 'BUY' : 'SELL';
        const premiumLabel = Number.isFinite(order.limitPrice) ? formatCurrency(order.limitPrice) : 'MARKET';
        const confirmTitle = options?.confirmTitle || 'Confirm Order';
        const confirmActionLabel = options?.confirmActionLabel || 'Submit Order';

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        Alert.alert(
            confirmTitle,
            `Place Limit ${actionLabel} for ${order.symbol}?\n\nContract: ${order.symbol} ${order.expiration} $${order.strike} ${rightLabel}\nLimit Price: ${premiumLabel}\nQty: ${quantity}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: confirmActionLabel,
                    style: 'default',
                    onPress: async () => {
                        const intentId = createOrderIntent({
                            symbol: order.symbol,
                            type: order.action,
                            quantity,
                            price: order.limitPrice,
                            strike: order.strike,
                            expiration: order.expiration,
                            right: order.right
                        });
                        try {
                            setExecuting(true);
                            const res = await placeOptionOrder({
                                symbol: order.symbol,
                                action: order.action,
                                quantity,
                                right: order.right,
                                strike: order.strike,
                                expiration: order.expiration,
                                limitPrice: order.limitPrice,
                                uid: user.uid
                            });
                            if (res.error) {
                                throw res.error;
                            }

                            updateOrderIntent(intentId, {
                                orderStatus: res.data.status || 'Submitted',
                                status: 'PendingIntent',
                                orderId: res.data.orderId
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            Alert.alert('Order Placed', `Order ID: ${res.data.orderId}\nStatus: ${res.data.status}`);
                            Analytics.logTradeExecution(order.symbol, options?.source || 'Execution');
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
                            Alert.alert('Execution Failed', String((error as any)?.message || error));
                            options?.onError?.(error);
                        } finally {
                            setExecuting(false);
                        }
                    }
                }
            ]
        );
    }, [isAuthenticated, user]);

    return { executeOptionOrder, executing };
}
