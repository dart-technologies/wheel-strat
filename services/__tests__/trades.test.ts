import { addTrade, syncTradeFromBridge } from '../trades';
import { store } from '@/data/store';
import { Trade } from '@wheel-strat/shared';

// Mock the singleton store to ensure isolation and avoid SQLite dependency issues
jest.mock('@/data/store', () => {
    const { createStore } = jest.requireActual('tinybase');
    return {
        store: createStore(),
        initStore: jest.fn(),
        persister: { startAutoLoad: jest.fn(), startAutoSave: jest.fn() }
    };
});

describe('trades service', () => {
    beforeEach(() => {
        store.delTable('trades');
        store.delTable('positions');
        store.delTable('optionPositions');
    });

    describe('addTrade', () => {
        it('adds a trade and creates a position', () => {
            const trade = addTrade({
                symbol: 'AAPL',
                quantity: 10,
                price: 150,
                type: 'BUY'
            });

            expect(trade).toBeTruthy();
            expect(store.hasRow('trades', trade!.id)).toBe(true);
            
            const pos = store.getRow('positions', 'AAPL');
            expect(pos.quantity).toBe(10);
            expect(pos.averageCost).toBe(150);
        });

        it('updates existing position average cost', () => {
            addTrade({ symbol: 'AAPL', quantity: 10, price: 100, type: 'BUY' });
            addTrade({ symbol: 'AAPL', quantity: 10, price: 200, type: 'BUY' });

            const pos = store.getRow('positions', 'AAPL');
            expect(pos.quantity).toBe(20);
            expect(pos.averageCost).toBe(150);
        });

        it('reduces position on sell', () => {
            addTrade({ symbol: 'TSLA', quantity: 10, price: 200, type: 'BUY' });
            addTrade({ symbol: 'TSLA', quantity: 5, price: 210, type: 'SELL' });

            const pos = store.getRow('positions', 'TSLA');
            expect(pos.quantity).toBe(5);
            expect(pos.averageCost).toBe(200);
        });

        it('removes position when quantity is zero', () => {
            addTrade({ symbol: 'AMD', quantity: 5, price: 100, type: 'BUY' });
            addTrade({ symbol: 'AMD', quantity: 5, price: 110, type: 'SELL' });

            expect(store.hasRow('positions', 'AMD')).toBe(false);
        });
    });

    describe('syncTradeFromBridge', () => {
        it('syncs new trade and updates position', () => {
            const trade: Trade = {
                id: 'exec1',
                symbol: 'NVDA',
                quantity: 100,
                price: 50,
                total: 5000,
                date: '2026-01-01',
                type: 'BUY'
            };

            syncTradeFromBridge(trade);

            expect(store.hasRow('trades', 'exec1')).toBe(true);
            expect(store.getCell('positions', 'NVDA', 'quantity')).toBe(100);
        });

        it('syncs option trades into optionPositions', () => {
            const trade: Trade = {
                id: 'exec2',
                symbol: 'AMZN',
                quantity: 1,
                price: 1.05,
                total: 105,
                date: '2026-01-01',
                type: 'SELL',
                raw: {
                    secType: 'OPT',
                    right: 'P',
                    strike: 210,
                    expiration: '2026-02-06',
                    multiplier: 100,
                    localSymbol: 'AMZN  260206P00210000'
                }
            };

            syncTradeFromBridge(trade);

            expect(store.hasRow('optionPositions', 'AMZN  260206P00210000')).toBe(true);
            expect(store.hasRow('positions', 'AMZN')).toBe(false);
        });

        it('ignores duplicates', () => {
            const trade: Trade = {
                id: 'exec1',
                symbol: 'NVDA',
                quantity: 100,
                price: 50,
                total: 5000,
                date: '2026-01-01',
                type: 'BUY'
            };

            syncTradeFromBridge(trade);
            const firstState = store.getJson();
            
            syncTradeFromBridge(trade);
            
            expect(store.getJson()).toEqual(firstState);
        });

        it('updates syncMetadata lastTradesSync timestamp', () => {
            const trade: Trade = {
                id: 'exec3',
                symbol: 'META',
                quantity: 10,
                price: 500,
                total: 5000,
                date: '2026-01-01',
                type: 'BUY'
            };

            syncTradeFromBridge(trade);

            const lastSync = store.getCell('syncMetadata', 'main', 'lastTradesSync');
            expect(lastSync).toBeTruthy();
            expect(typeof lastSync).toBe('string');
        });
    });
});
