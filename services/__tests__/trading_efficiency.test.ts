import { calculateEfficiencyGrade } from '../trading';

describe('Trading Service - Efficiency Logic', () => {
    describe('calculateEfficiencyGrade', () => {
        it('grades A for high annualized ROC', () => {
            // Profit: $1000, Margin: $10000, Days: 30
            // ROC = 10% in 1 month -> ~120% annualized
            expect(calculateEfficiencyGrade(1000, 10000, 30)).toBe('A');
        });

        it('grades A for solid annualized ROC', () => {
            // Profit: $250, Margin: $10000, Days: 30
            // ROC = 2.5% in 1 month -> 30% annualized (>= 25% is A)
            expect(calculateEfficiencyGrade(250, 10000, 30)).toBe('A');
        });

        it('grades C for moderate annualized ROC', () => {
            // Profit: $100, Margin: $10000, Days: 30
            // ROC = 1% in 1 month -> 12% annualized
            expect(calculateEfficiencyGrade(100, 10000, 30)).toBe('C');
        });

        it('grades F for negative ROC', () => {
            expect(calculateEfficiencyGrade(-100, 10000, 30)).toBe('F');
        });

        it('handles zero days gracefully', () => {
            expect(calculateEfficiencyGrade(100, 10000, 0)).toBe('C');
        });
    });
});
