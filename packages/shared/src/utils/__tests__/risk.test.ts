import {
    normalizeRiskLevel,
    getTargetWinProb,
    getRiskConfig
} from '../risk';

describe('Risk Utilities', () => {
    describe('normalizeRiskLevel', () => {
        it('identifies valid levels', () => {
            expect(normalizeRiskLevel('Aggressive')).toBe('Aggressive');
            expect(normalizeRiskLevel('Moderate')).toBe('Moderate');
            expect(normalizeRiskLevel('Conservative')).toBe('Conservative');
        });

        it('defaults to Moderate for invalid levels', () => {
            expect(normalizeRiskLevel('YOLO')).toBe('Moderate');
            expect(normalizeRiskLevel('')).toBe('Moderate');
            expect(normalizeRiskLevel(undefined)).toBe('Moderate');
        });
    });

    describe('getTargetWinProb', () => {
        it('returns correct targets', () => {
            expect(getTargetWinProb('Aggressive')).toBe(55);
            expect(getTargetWinProb('Moderate')).toBe(70);
            expect(getTargetWinProb('Conservative')).toBe(85);
        });
    });

    describe('getRiskConfig', () => {
        it('returns full config object', () => {
            const config = getRiskConfig('Conservative');
            expect(config).toEqual({
                winProb: 85,
                label: 'Conservative'
            });
        });
    });
});
