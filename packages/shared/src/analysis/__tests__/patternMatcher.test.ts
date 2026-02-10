import { 
    calculateEuclideanDistance, 
    normalizePrices, 
    findHistoricalDoppelgangers, 
    calculateThetaGrade 
} from '../patternMatcher';

describe('Pattern Matcher', () => {
    describe('calculateEuclideanDistance', () => {
        it('calculates distance correctly', () => {
            const a = [0, 1];
            const b = [1, 1];
            expect(calculateEuclideanDistance(a, b)).toBe(1);
        });
    });

    describe('normalizePrices', () => {
        it('normalizes to percentage change', () => {
            const prices = [100, 110, 90];
            const normalized = normalizePrices(prices);
            expect(normalized[0]).toBe(0);
            expect(normalized[1]).toBeCloseTo(0.1);
            expect(normalized[2]).toBeCloseTo(-0.1);
        });
    });

    describe('findHistoricalDoppelgangers', () => {
        // Need at least windowSize * 2 + some buffer if we want matches
        const history = [
            { close: 100, date: '1', open: 0, high: 0, low: 0, volume: 0 },
            { close: 101, date: '2', open: 0, high: 0, low: 0, volume: 0 },
            { close: 102, date: '3', open: 0, high: 0, low: 0, volume: 0 },
            { close: 103, date: '4', open: 0, high: 0, low: 0, volume: 0 },
            { close: 104, date: '5', open: 0, high: 0, low: 0, volume: 0 },
            { close: 105, date: '6', open: 0, high: 0, low: 0, volume: 0 },
            { close: 106, date: '7', open: 0, high: 0, low: 0, volume: 0 },
            { close: 107, date: '8', open: 0, high: 0, low: 0, volume: 0 },
            { close: 108, date: '9', open: 0, high: 0, low: 0, volume: 0 },
        ];

        it('finds closest matches', () => {
            const current = [200, 202, 204]; // [0, 0.01, 0.02] action
            const matches = findHistoricalDoppelgangers(current, history, 3, 1);
            
            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0].distance).toBeCloseTo(0);
        });
    });

    describe('calculateThetaGrade', () => {
        it('identifies Grade A (Expensive/High IV)', () => {
            const res = calculateThetaGrade(0.50, 0.20, 80);
            expect(res.grade).toBe('A');
        });

        it('identifies Grade D (Cheap)', () => {
            const res = calculateThetaGrade(0.20, 0.40, 10);
            expect(res.grade).toBe('D'); // Current implementation returns D for < 0.9
        });
    });
});