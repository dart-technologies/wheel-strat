import { useCallback } from 'react';
import { useRowIds } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { addTrade, TradeInput } from '@/services/trades';

export function useTradeJournal() {
    const tradeIds = useRowIds('trades', store);

    const saveTrade = useCallback((input: TradeInput) => {
        return addTrade(input);
    }, []);

    return { tradeIds, saveTrade };
}

export function usePendingOrders() {
    const orderIds = useRowIds('orders', store);
    return { orderIds };
}
