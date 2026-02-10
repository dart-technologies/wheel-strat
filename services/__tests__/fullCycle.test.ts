import { store } from '@/data/store';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { mockPlaceOrderSuccess } from '@/__tests__/__helpers__/bridge';
import { createOrderIntent, syncOrdersFromFirestore } from '@/services/orders';
import { syncTradeFromBridge } from '@/services/trades';
import * as tradingService from '@/services/trading';
import { Trade } from '@wheel-strat/shared';

// Mock the placeOrder service
jest.mock('@/services/trading', () => ({
    ...jest.requireActual('@/services/trading'),
    placeOrder: jest.fn(),
    triggerSync: jest.fn().mockResolvedValue({ success: true }),
    triggerCommunityPortfolioSync: jest.fn().mockResolvedValue({ success: true })
}));

describe('Full-Cycle Trade Execution', () => {
    beforeEach(() => {
        clearTestStore();
        jest.clearAllMocks();
    });

    it('should navigate from intent creation to a filled position', async () => {
        const symbol = 'AAPL';
        const quantity = 100;
        const price = 150;
        const orderId = 99999;

        // 1. User initiates trade (creates Intent)
        const intentId = createOrderIntent({
            symbol,
            type: 'BUY',
            quantity,
            price
        });

        expect(store.hasRow('orders', intentId)).toBe(true);
        expect(store.getRow('orders', intentId).status).toBe('PendingIntent');

        // 2. Simulate successful bridge placement
        mockPlaceOrderSuccess(orderId);
        
        // (In actual app, useExecuteOpportunity would call placeOrder here)
        const result = await tradingService.placeOrder({ symbol } as any, 'user_1', quantity);
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();

        // 3. Update intent with Order ID (simulating hook behavior)
        store.setCell('orders', intentId, 'orderId', orderId);
        store.setCell('orders', intentId, 'orderStatus', 'Submitted');

        // 4. Simulate Bridge Sync: Real order arrives from Firestore
        const incomingOrder: Trade = {
            id: String(orderId),
            symbol,
            type: 'BUY',
            quantity,
            price,
            date: '2026-02-08',
            total: quantity * price,
            status: 'Filled'
        };

        // This should remove the intent and add the real order
        syncOrdersFromFirestore([incomingOrder]);
        
        expect(store.hasRow('orders', intentId)).toBe(false);
        expect(store.hasRow('orders', String(orderId))).toBe(true);

        // 5. Simulate Fill: Fill arrives via Trade sync
        syncTradeFromBridge(incomingOrder);

        // 6. Verify Position Update
        const position = store.getRow('positions', symbol);
        expect(position.quantity).toBe(quantity);
        expect(position.averageCost).toBe(price);
        
        // 7. Verify Journal state
        expect(store.getRowIds('trades')).toContain(String(orderId));
    });
});
