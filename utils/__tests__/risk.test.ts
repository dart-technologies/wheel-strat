
import { getTargetWinProb, RISK_TARGET_WIN_PROB } from '../risk';

describe('risk utils', () => {
    describe('RISK_TARGET_WIN_PROB', () => {
        it('has correct values', () => {
            expect(RISK_TARGET_WIN_PROB.Aggressive).toBe(55);
            expect(RISK_TARGET_WIN_PROB.Moderate).toBe(70);
            expect(RISK_TARGET_WIN_PROB.Conservative).toBe(85);
        });
    });

    describe('getTargetWinProb', () => {
        it('returns Moderate probability by default', () => {
            expect(getTargetWinProb()).toBe(70);
        });

        it('returns correct probability for Aggressive', () => {
            expect(getTargetWinProb('Aggressive')).toBe(55);
        });

        it('returns correct probability for Moderate', () => {
            expect(getTargetWinProb('Moderate')).toBe(70);
        });

        it('returns correct probability for Conservative', () => {
            expect(getTargetWinProb('Conservative')).toBe(85);
        });
    });
});
