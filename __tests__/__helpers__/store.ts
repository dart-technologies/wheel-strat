import { store } from '@/data/store';
import { Row, Table } from 'tinybase';

/**
 * Completely clears the TinyBase store for a clean test state.
 */
export const clearTestStore = () => {
    store.delTables();
    store.delValues();
};

/**
 * Seeds the store with common Mag7 positions for testing.
 */
export const seedTestPositions = () => {
    const mag7: Record<string, Row> = {
        AAPL: { symbol: 'AAPL', quantity: 100, averageCost: 150, currentPrice: 155 },
        NVDA: { symbol: 'NVDA', quantity: 50, averageCost: 400, currentPrice: 420 },
        TSLA: { symbol: 'TSLA', quantity: 200, averageCost: 200, currentPrice: 190 },
    };
    
    Object.entries(mag7).forEach(([symbol, row]) => {
        store.setRow('positions', symbol, row);
    });
};

/**
 * Helper to get a table or empty object.
 */
export const getTestTable = (tableId: string): Table => {
    return store.getTable(tableId) || {};
};
