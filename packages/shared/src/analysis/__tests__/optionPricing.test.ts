import { blackScholesPrice } from '../optionPricing';

describe('optionPricing', () => {
    it('should calculate call price correctly', () => {
        const input = {
            spot: 100,
            strike: 100,
            timeToExpYears: 1,
            rate: 0.05,
            volatility: 0.2,
            right: 'C' as const
        };
        const price = blackScholesPrice(input);
        expect(price).toBeCloseTo(10.45, 1);
    });

    it('should calculate put price correctly', () => {
        const input = {
            spot: 100,
            strike: 100,
            timeToExpYears: 1,
            rate: 0.05,
            volatility: 0.2,
            right: 'P' as const
        };
        const price = blackScholesPrice(input);
        expect(price).toBeCloseTo(5.57, 1);
    });

    it('should return intrinsic value if time or volatility is 0', () => {
        const input = {
            spot: 110,
            strike: 100,
            timeToExpYears: 0,
            rate: 0.05,
            volatility: 0.2,
            right: 'C' as const
        };
        expect(blackScholesPrice(input)).toBe(10);
        
        const putInput = { ...input, right: 'P' as const };
        expect(blackScholesPrice(putInput)).toBe(0);
    });

    it('should handle invalid inputs', () => {
        expect(blackScholesPrice({ spot: -1, strike: 100, timeToExpYears: 1, rate: 0.05, volatility: 0.2, right: 'C' })).toBeNull();
        expect(blackScholesPrice({ spot: 100, strike: 0, timeToExpYears: 1, rate: 0.05, volatility: 0.2, right: 'C' })).toBeNull();
    });
});
