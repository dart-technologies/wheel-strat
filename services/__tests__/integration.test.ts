import { store } from '@/data/store';
import { clearTestStore } from '@/__tests__/__helpers__/store';
import { addTrade, syncTradeFromBridge } from '@/services/trades';
import { createOrderIntent, syncOrdersFromFirestore } from '@/services/orders';
import { Trade } from '@wheel-strat/shared';

describe('TinyBase Integration', () => {
    beforeEach(() => {
        clearTestStore();
    });

    describe('Trades & Positions', () => {
        it('should add a stock trade and update position correctly', () => {
            const tradeInput = {
                symbol: 'AAPL',
                quantity: 10,
                price: 150,
                type: 'BUY' as const,
            };

            const trade = addTrade(tradeInput);
            expect(trade).not.toBeNull();
            expect(store.getRowIds('trades')).toHaveLength(1);

            const position = store.getRow('positions', 'AAPL');
            expect(position.quantity).toBe(10);
            expect(position.averageCost).toBe(150);
        });

        it('should calculate weighted average cost for multiple buys', () => {
            addTrade({ symbol: 'TSLA', quantity: 10, price: 200, type: 'BUY' });
            addTrade({ symbol: 'TSLA', quantity: 10, price: 210, type: 'BUY' });

            const position = store.getRow('positions', 'TSLA');
            expect(position.quantity).toBe(20);
            expect(position.averageCost).toBe(205);
        });

        it('should sync option trade from bridge and create optionPosition', () => {
            const optionTrade: Trade = {
                id: 'bridge_1',
                symbol: 'NVDA',
                type: 'SELL',
                quantity: 1,
                price: 5.50,
                date: '2026-02-08',
                total: 550,
                secType: 'OPT',
                right: 'P',
                strike: 100,
                expiration: '20260320',
                multiplier: 100
            };

            syncTradeFromBridge(optionTrade);

            expect(store.getRowIds('trades')).toContain('bridge_1');
            const optionPositions = store.getTable('optionPositions');
            const optionId = Object.keys(optionPositions)[0];
            expect(optionPositions[optionId].symbol).toBe('NVDA');
            expect(optionPositions[optionId].quantity).toBe(-1); // SELL is negative qty
            expect(optionPositions[optionId].marketValue).toBe(-550);
        });
    });

    describe('Order Intents', () => {
        it('should create an intent and reconcile it when a matching order arrives', () => {
            const intentId = createOrderIntent({
                symbol: 'MSFT',
                type: 'CSP',
                quantity: 1,
                strike: 400,
                expiration: '20260320'
            });

            expect(store.hasRow('orders', intentId)).toBe(true);
            expect(store.getRow('orders', intentId).status).toBe('PendingIntent');

            const matchingOrder: Trade = {
                id: 'ord_123',
                symbol: 'MSFT',
                type: 'SELL',
                quantity: 1,
                price: 10.0,
                date: '2026-02-08',
                total: 1000,
                strike: 400,
                expiration: '20260320',
                status: 'Pending'
            };

            syncOrdersFromFirestore([matchingOrder]);

            // Intent should be removed
            expect(store.hasRow('orders', intentId)).toBe(false);
            // Real order should be present
            expect(store.hasRow('orders', 'ord_123')).toBe(true);
            expect(store.getRow('orders', 'ord_123').status).toBe('Pending');
        });

        it('should not remove intent if order does not match', () => {
            const intentId = createOrderIntent({
                symbol: 'AAPL',
                type: 'CC',
                quantity: 1,
                strike: 300,
                expiration: '20260320'
            });

            const nonMatchingOrder: Trade = {
                id: 'ord_456',
                symbol: 'AAPL',
                type: 'SELL',
                quantity: 1,
                price: 5.0,
                date: '2026-02-08',
                total: 500,
                strike: 310, // Different strike
                expiration: '20260320',
                status: 'Pending'
            };

            syncOrdersFromFirestore([nonMatchingOrder]);

            expect(store.hasRow('orders', intentId)).toBe(true);
            expect(store.hasRow('orders', 'ord_456')).toBe(true);
        });
    });
});
