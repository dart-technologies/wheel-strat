import { isMarketOpen } from '@/lib/time';

describe('isMarketOpen', () => {
    // Note: The tests depend on the 'America/New_York' timezone being handled correctly
    // inside the function using .toLocaleString().

    it('returns true during normal market hours (Tue 10:30 AM ET)', () => {
        // 2026-01-20 is a Tuesday (Normal day)
        // 15:30 UTC is 10:30 AM ET
        const date = new Date('2026-01-20T15:30:00Z');
        expect(isMarketOpen(date)).toBe(true);
    });

    it('returns false before market open (Tue 9:00 AM ET)', () => {
        // 14:00 UTC is 9:00 AM ET
        const date = new Date('2026-01-20T14:00:00Z');
        expect(isMarketOpen(date)).toBe(false);
    });

    it('returns false after market close (Tue 4:30 PM ET)', () => {
        // 21:30 UTC is 4:30 PM ET
        const date = new Date('2026-01-20T21:30:00Z');
        expect(isMarketOpen(date)).toBe(false);
    });

    it('returns false on Saturday', () => {
        // 2026-01-17 is a Saturday
        const date = new Date('2026-01-17T15:30:00Z');
        expect(isMarketOpen(date)).toBe(false);
    });

    it('returns false on Sunday', () => {
        // 2026-01-18 is a Sunday
        const date = new Date('2026-01-18T15:30:00Z');
        expect(isMarketOpen(date)).toBe(false);
    });

    it('returns false on a holiday (MLK Day 2026-01-19)', () => {
        // 2026-01-19 is MLK Day
        const date = new Date('2026-01-19T15:30:00Z');
        expect(isMarketOpen(date)).toBe(false);
    });

    it('returns true on a Friday right before close (3:59 PM ET)', () => {
        // 2026-01-23 is a Friday
        // 20:59 UTC is 3:59 PM ET
        const date = new Date('2026-01-23T20:59:00Z');
        expect(isMarketOpen(date)).toBe(true);
    });
});
