import {
    calculateAnnualizedYield,
    calculateIvRank,
    gradeEfficiency,
    calculateAnnualizedRoc,
    calculateWinProbFromDelta
} from '../finance';

describe('Finance Utilities', () => {
    describe('calculateAnnualizedYield', () => {
        it('calculates yield correctly for CSP', () => {
            // $2 premium, $150 strike, 30 days
            const result = calculateAnnualizedYield(2, 150, 30);
            // (2 / 150) * (365 / 30) * 100 = 16.222...
            expect(result).toBe(16.2);
        });

        it('returns 0 if collateral or days are <= 0', () => {
            expect(calculateAnnualizedYield(2, 0, 30)).toBe(0);
            expect(calculateAnnualizedYield(2, 150, 0)).toBe(0);
        });
    });

    describe('calculateIvRank', () => {
        it('calculates IV rank correctly', () => {
            expect(calculateIvRank(30, 10, 50)).toBe(50);
            expect(calculateIvRank(10, 10, 50)).toBe(0);
            expect(calculateIvRank(50, 10, 50)).toBe(100);
        });

        it('clamps values between 0 and 100', () => {
            expect(calculateIvRank(5, 10, 50)).toBe(0);
            expect(calculateIvRank(60, 10, 50)).toBe(100);
        });

        it('returns 0 if high equals low', () => {
            expect(calculateIvRank(30, 30, 30)).toBe(0);
        });
    });

    describe('gradeEfficiency', () => {
        it('assigns correct grades based on ROC', () => {
            expect(gradeEfficiency(30)).toBe('A');
            expect(gradeEfficiency(20)).toBe('B');
            expect(gradeEfficiency(10)).toBe('C');
            expect(gradeEfficiency(5)).toBe('D');
            expect(gradeEfficiency(-5)).toBe('F');
        });
    });

    describe('calculateAnnualizedRoc', () => {
        it('calculates ROC correctly', () => {
            // $500 profit, $5000 margin, 45 days
            const result = calculateAnnualizedRoc(500, 5000, 45);
            // (500 / 5000) / (45 / 365) * 100 = 81.11...
            expect(result).toBeCloseTo(81.11, 1);
        });
    });

    describe('calculateWinProbFromDelta', () => {
        it('converts delta to probability correctly', () => {
            expect(calculateWinProbFromDelta(0.3)).toBe(70);
            expect(calculateWinProbFromDelta(-0.25)).toBe(75);
            expect(calculateWinProbFromDelta(0)).toBe(100);
            expect(calculateWinProbFromDelta(1.0)).toBe(0);
        });
    });
});
