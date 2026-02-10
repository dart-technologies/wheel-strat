import { PriceBar } from './patternMatcher';

export interface TailEvent {
    startIndex: number;
    endIndex: number;
    startDate: string;
    endDate: string;
    dropPct: number;
    durationMinutes: number;
    reboundPct?: number;
    reboundWindowMinutes?: number;
}

export interface TailScanConfig {
    dropPct: number;
    maxDurationMinutes: number;
    reboundWindowMinutes?: number;
    barIntervalMinutes?: number;
}

function parseBarTimestamp(value: string): Date | null {
    if (!value) return null;
    let raw = String(value).trim();
    if (!raw) return null;
    raw = raw.replace('T', ' ').replace('Z', '');
    if (raw.includes(' ')) {
        return new Date(raw.replace(' ', 'T'));
    }
    if (/^\d{8}$/.test(raw)) {
        raw = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return new Date(`${raw}T00:00:00`);
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferIntervalMinutes(bars: PriceBar[]) {
    const diffs: number[] = [];
    for (let i = 1; i < bars.length && diffs.length < 5; i++) {
        const prev = parseBarTimestamp(bars[i - 1].date);
        const next = parseBarTimestamp(bars[i].date);
        if (!prev || !next) continue;
        const diff = (next.getTime() - prev.getTime()) / (60 * 1000);
        if (diff > 0) diffs.push(diff);
    }
    if (!diffs.length) return 1440;
    diffs.sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)];
}

function minutesBetween(
    bars: PriceBar[],
    startIndex: number,
    endIndex: number,
    fallbackMinutes: number
) {
    const start = parseBarTimestamp(bars[startIndex].date);
    const end = parseBarTimestamp(bars[endIndex].date);
    if (start && end) {
        const diff = (end.getTime() - start.getTime()) / (60 * 1000);
        if (Number.isFinite(diff)) return diff;
    }
    return (endIndex - startIndex) * fallbackMinutes;
}

export function calculateVelocity(closes: number[], intervalMinutes: number) {
    if (closes.length < 2) return [];
    const velocity: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        const prev = closes[i - 1];
        const next = closes[i];
        if (!Number.isFinite(prev) || !Number.isFinite(next)) {
            velocity.push(0);
            continue;
        }
        velocity.push(((next - prev) / prev) / Math.max(1, intervalMinutes));
    }
    return velocity;
}

export function calculateAcceleration(velocity: number[]) {
    if (velocity.length < 2) return [];
    const acceleration: number[] = [];
    for (let i = 1; i < velocity.length; i++) {
        acceleration.push(velocity[i] - velocity[i - 1]);
    }
    return acceleration;
}

export function findRapidDrops(bars: PriceBar[], config: TailScanConfig): TailEvent[] {
    if (!bars.length) return [];
    const intervalMinutes = config.barIntervalMinutes || inferIntervalMinutes(bars);
    const events: TailEvent[] = [];

    let i = 0;
    while (i < bars.length - 1) {
        const startPrice = bars[i].close;
        if (!Number.isFinite(startPrice) || startPrice <= 0) {
            i += 1;
            continue;
        }

        let minPrice = startPrice;
        let minIndex = i;

        for (let j = i + 1; j < bars.length; j++) {
            const duration = minutesBetween(bars, i, j, intervalMinutes);
            if (duration > config.maxDurationMinutes) break;
            const price = bars[j].close;
            if (!Number.isFinite(price)) continue;
            if (price < minPrice) {
                minPrice = price;
                minIndex = j;
            }
        }

        const dropPct = (minPrice - startPrice) / startPrice;
        if (dropPct <= -Math.abs(config.dropPct) && minIndex > i) {
            const durationMinutes = minutesBetween(bars, i, minIndex, intervalMinutes);
            const event: TailEvent = {
                startIndex: i,
                endIndex: minIndex,
                startDate: bars[i].date,
                endDate: bars[minIndex].date,
                dropPct,
                durationMinutes
            };

            if (config.reboundWindowMinutes) {
                const windowEnd = config.reboundWindowMinutes;
                let maxClose = minPrice;
                for (let k = minIndex + 1; k < bars.length; k++) {
                    const reboundDuration = minutesBetween(bars, minIndex, k, intervalMinutes);
                    if (reboundDuration > windowEnd) break;
                    const price = bars[k].close;
                    if (Number.isFinite(price) && price > maxClose) {
                        maxClose = price;
                    }
                }
                event.reboundWindowMinutes = config.reboundWindowMinutes;
                event.reboundPct = (maxClose - minPrice) / minPrice;
            }

            events.push(event);
            i = minIndex + 1;
            continue;
        }

        i += 1;
    }

    return events;
}

export function summarizeTailEvents(events: TailEvent[]) {
    if (!events.length) {
        return {
            occurrences: 0,
            avgDropPct: 0,
            medianDropPct: 0,
            worstDropPct: 0,
            reboundRate: 0,
            avgReboundPct: 0
        };
    }

    const drops = events.map((event) => event.dropPct).sort((a, b) => a - b);
    const reboundEvents = events.filter((event) => typeof event.reboundPct === 'number');
    const positiveRebounds = reboundEvents.filter((event) => (event.reboundPct ?? 0) > 0);

    const avgDropPct = drops.reduce((sum, value) => sum + value, 0) / drops.length;
    const medianDropPct = drops[Math.floor(drops.length / 2)];
    const worstDropPct = drops[0];
    const avgReboundPct = reboundEvents.length
        ? reboundEvents.reduce((sum, event) => sum + (event.reboundPct ?? 0), 0) / reboundEvents.length
        : 0;

    return {
        occurrences: events.length,
        avgDropPct,
        medianDropPct,
        worstDropPct,
        reboundRate: reboundEvents.length ? positiveRebounds.length / reboundEvents.length : 0,
        avgReboundPct
    };
}
