/**
 * Prediction Verification & Reinforcement Learning Test Suite
 */

// Mocking the behavior of the future verifyMarathonAgent logic
function verifyPrediction(
    opportunity: any,
    currentPrice: number
): { win: boolean; status: string; pnl: number } {
    const isCSP = opportunity.strategy === 'Cash-Secured Put';
    const strike = opportunity.strike;
    
    if (isCSP) {
        // CSP wins if price stays ABOVE strike
        const win = currentPrice >= strike;
        return {
            win,
            status: win ? 'Expired Worthless' : 'Assigned',
            pnl: win ? opportunity.premium : (currentPrice - strike + opportunity.premium)
        };
    } else {
        // CC wins if price stays BELOW strike
        const win = currentPrice <= strike;
        return {
            win,
            status: win ? 'Expired Worthless' : 'Called Away',
            pnl: win ? opportunity.premium : (strike - opportunity.currentPrice + opportunity.premium)
        };
    }
}

describe('Reinforcement Learning: Prediction Verification', () => {
    const mockOpportunity = {
        symbol: 'NVDA',
        strategy: 'Cash-Secured Put',
        strike: 100,
        premium: 5.0,
        currentPrice: 110
    };

    it('identifies a winning CSP prediction (Price > Strike)', () => {
        const result = verifyPrediction(mockOpportunity, 105);
        expect(result.win).toBe(true);
        expect(result.status).toBe('Expired Worthless');
        expect(result.pnl).toBe(5.0);
    });

    it('identifies a losing CSP prediction (Price < Strike)', () => {
        const result = verifyPrediction(mockOpportunity, 90);
        expect(result.win).toBe(false);
        expect(result.status).toBe('Assigned');
        // Loss = (90 - 100) + 5 = -5
        expect(result.pnl).toBe(-5.0);
    });

    it('identifies a winning CC prediction (Price < Strike)', () => {
        const ccOpp = { ...mockOpportunity, strategy: 'Covered Call', strike: 120 };
        const result = verifyPrediction(ccOpp, 115);
        expect(result.win).toBe(true);
        expect(result.status).toBe('Expired Worthless');
    });

    it('identifies a losing CC prediction (Price > Strike)', () => {
        const ccOpp = { ...mockOpportunity, strategy: 'Covered Call', strike: 120 };
        const result = verifyPrediction(ccOpp, 130);
        expect(result.win).toBe(false);
        expect(result.status).toBe('Called Away');
    });
});
