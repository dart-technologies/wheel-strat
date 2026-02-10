/**
 * AI Regression Suite: Golden Prompts
 * Ensures Gemini 3 "Elite Allocator" logic remains consistent.
 */

import { MARKET_REPORT_PROMPT } from '@/prompts/marketReport';

describe('AI Regression: Golden Prompts', () => {
    const staticMarketSnapshot = {
        today: '2026-02-07',
        session: 'Open',
        positions: 'AAPL: 100 shares @ $150',
        opportunities: 'AAPL CSP: $140 exp 2026-03-07, 12% yield',
        calendarEvents: '2026-02-10 | CPI Release | HIGH',
        priorContext: 'Previous bias was neutral.'
    };

    it('generates a valid prompt with all required placeholders', () => {
        const prompt = MARKET_REPORT_PROMPT
            .replace('{{today}}', staticMarketSnapshot.today)
            .replace('{{session}}', staticMarketSnapshot.session)
            .replace('{{positions}}', staticMarketSnapshot.positions)
            .replace('{{opportunities}}', staticMarketSnapshot.opportunities)
            .replace('{{calendarEvents}}', staticMarketSnapshot.calendarEvents)
            .replace('{{priorContext}}', staticMarketSnapshot.priorContext);

        expect(prompt).toContain('2026-02-07');
        expect(prompt).toContain('Multi-Billion Dollar Capital Allocator');
        expect(prompt).toContain('7 CALENDAR DAYS');
    });

    it('requires valid JSON output format', () => {
        expect(MARKET_REPORT_PROMPT).toContain('Return VALID JSON only');
        expect(MARKET_REPORT_PROMPT).toContain('"marketBias": "bullish" | "bearish" | "neutral"');
    });
});
