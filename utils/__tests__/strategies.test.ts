import { getStrategyColor, getStrategyLabel, getStrategyAbbreviation } from '../strategies';
import { Theme } from '../../constants/theme';

describe('strategies utils', () => {
    describe('getStrategyColor', () => {
        it('returns correct color for CC', () => {
            expect(getStrategyColor('Covered Call')).toBe(Theme.colors.strategyCc);
            expect(getStrategyColor('CC')).toBe(Theme.colors.strategyCc);
        });

        it('returns correct color for CSP', () => {
            expect(getStrategyColor('Cash-Secured Put')).toBe(Theme.colors.strategyCsp);
            expect(getStrategyColor('CSP')).toBe(Theme.colors.strategyCsp);
        });

        it('returns correct color for Buy/Sell', () => {
            expect(getStrategyColor('BUY')).toBe(Theme.colors.success);
            expect(getStrategyColor('SELL')).toBe(Theme.colors.error);
        });

        it('returns default for unknown', () => {
            expect(getStrategyColor('Iron Condor')).toBe(Theme.colors.textMuted);
        });
    });

    describe('getStrategyLabel', () => {
        it('returns friendly labels', () => {
            expect(getStrategyLabel('CC')).toBe('Covered Call');
            expect(getStrategyLabel('CSP')).toBe('Cash-Secured Put');
            expect(getStrategyLabel('buy')).toBe('Buy');
        });
    });

    describe('getStrategyAbbreviation', () => {
        it('returns short codes', () => {
            expect(getStrategyAbbreviation('Covered Call')).toBe('CC');
            expect(getStrategyAbbreviation('Cash-Secured Put')).toBe('CSP');
            expect(getStrategyAbbreviation('Other')).toBe('OTHER');
        });
    });
});
