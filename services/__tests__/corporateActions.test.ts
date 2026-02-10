import { store } from '@/data/store';
import { applyCorporateActions } from '@/services/corporateActions';
import { CorporateAction } from '@wheel-strat/shared';

describe('Corporate Actions Service', () => {
    beforeEach(() => {
        store.delTables();
    });

    it('should correctly adjust positions for a 3-for-1 stock split', () => {
        // 1. Setup initial position
        store.setRow('positions', 'TSLA', {
            symbol: 'TSLA',
            quantity: 100,
            averageCost: 600,
            currentPrice: 630,
            costBasis: 60000,
            marketValue: 63000
        });

        const splitAction: CorporateAction = {
            id: 'split_123',
            symbol: 'TSLA',
            type: 'split',
            ratio: 3, // 3-for-1
            effectiveDate: new Date().toISOString().split('T')[0]
        };

        // 2. Apply action
        applyCorporateActions([splitAction]);

        // 3. Verify results
        const nextPos = store.getRow('positions', 'TSLA');
        expect(nextPos.quantity).toBe(300);
        expect(nextPos.averageCost).toBe(200);
        expect(nextPos.costBasis).toBe(60000); // Basis stays same
        expect(nextPos.marketValue).toBe(189000); // currentPrice (630) * nextQuantity (300)
        
        // Check processed flag
        expect(store.getRow('corporateActions', 'split_123').processedAt).toBeDefined();
    });

    it('should adjust option positions during a split', () => {
        // 1. Setup initial option
        const optId = 'opt_123';
        store.setRow('optionPositions', optId, {
            symbol: 'TSLA',
            quantity: -1,
            averageCost: 10,
            currentPrice: 5,
            strike: 600,
            multiplier: 100,
            costBasis: -1000,
            marketValue: -500
        });

        const splitAction: CorporateAction = {
            id: 'split_456',
            symbol: 'TSLA',
            type: 'split',
            ratio: 2, // 2-for-1
            effectiveDate: new Date().toISOString().split('T')[0]
        };

        applyCorporateActions([splitAction]);

        const nextOpt = store.getRow('optionPositions', optId);
        expect(nextOpt.strike).toBe(300);
        expect(nextOpt.multiplier).toBe(200);
        expect(nextOpt.averageCost).toBe(5);
        expect(nextOpt.costBasis).toBe(-1000);
    });
});
