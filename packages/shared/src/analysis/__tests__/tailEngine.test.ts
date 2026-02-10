import { findRapidDrops, calculateVelocity, calculateAcceleration, summarizeTailEvents } from '../tailEngine';

describe('tailEngine', () => {
    const bars = [
        { date: '2026-01-01', open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        { date: '2026-01-02', open: 100, high: 100, low: 97, close: 98, volume: 1000 },
        { date: '2026-01-03', open: 98, high: 98, low: 94, close: 95, volume: 1000 }, // 5% drop from start
        { date: '2026-01-04', open: 95, high: 97, low: 95, close: 96, volume: 1000 }, // Small rebound
        { date: '2026-01-05', open: 96, high: 96, low: 93, close: 94, volume: 1000 }, // 6% drop from start
        { date: '2026-01-06', open: 94, high: 101, low: 94, close: 100, volume: 1000 }, // Big rebound
    ];

    it('should calculate velocity correctly', () => {
        const closes = [100, 110, 121];
        const velocity = calculateVelocity(closes, 1440); // daily
        expect(velocity[0]).toBeCloseTo(0.000069, 5); // (10/100)/1440
    });

    it('should calculate acceleration correctly', () => {
        const velocity = [0.1, 0.3, 0.2];
        const acceleration = calculateAcceleration(velocity);
        expect(acceleration[0]).toBeCloseTo(0.2, 5);
        expect(acceleration[1]).toBeCloseTo(-0.1, 5);
    });

    it('should find rapid drops', () => {
        const config = {
            dropPct: 0.05,
            maxDurationMinutes: 10000,
            barIntervalMinutes: 1440
        };
        const events = findRapidDrops(bars, config);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].dropPct).toBeLessThanOrEqual(-0.05);
    });

    it('should summarize events correctly', () => {
        const events = [
            { startIndex: 0, endIndex: 2, startDate: 'A', endDate: 'B', dropPct: -0.05, durationMinutes: 100 },
            { startIndex: 3, endIndex: 5, startDate: 'C', endDate: 'D', dropPct: -0.10, durationMinutes: 200, reboundPct: 0.05 }
        ];
        const summary = summarizeTailEvents(events);
        expect(summary.occurrences).toBe(2);
        expect(summary.worstDropPct).toBe(-0.10);
        expect(summary.avgDropPct).toBeCloseTo(-0.075, 5);
    });
});
