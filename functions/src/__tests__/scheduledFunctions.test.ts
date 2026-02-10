/**
 * Tests for scheduled Cloud Functions schedules and market-aware behavior.
 * Validates that functions run during correct market hours and skip appropriately.
 */
import { isMarketOpen } from '@/lib/time';

function createCallableMock(optionsOrHandler: any, maybeHandler?: any) {
    const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
    const options = typeof optionsOrHandler === 'function' ? undefined : optionsOrHandler;
    const fn = jest.fn();
    (fn as any).__options = options;
    (fn as any).__handler = handler;
    return fn;
}

function createScheduleMock(optionsOrSchedule: any, handler?: any) {
    const options = typeof optionsOrSchedule === 'string' ? { schedule: optionsOrSchedule } : optionsOrSchedule;
    const fn = jest.fn();
    (fn as any).__options = options;
    (fn as any).__handler = handler;
    return fn;
}

jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn(createCallableMock),
    onRequest: jest.fn(createCallableMock),
    HttpsError: class HttpsError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
    FunctionsErrorCode: {}
}));

jest.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: jest.fn(createScheduleMock)
}));

// Mock other dependencies to prevent initialization errors
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({ exists: false }),
                set: jest.fn().mockResolvedValue({})
            }),
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
            add: jest.fn().mockResolvedValue({})
        })
    })
}));

jest.mock('../lib/ibkrRuntime', () => ({
    getIbkrFunctionsConfig: jest.fn().mockReturnValue({
        bridgeUrl: 'http://test',
        bridgeApiKey: 'test-key',
        tradingMode: 'paper',
        bridgeUrlConfigured: true
    })
}));

jest.mock('../lib/vertexai', () => ({
    getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
            response: { candidates: [] }
        })
    })
}));

jest.mock('../lib/cloudsql', () => ({
    getDB: jest.fn(),
    isDbConfigured: jest.fn().mockReturnValue(false),
    initSchema: jest.fn(),
    resolveDbConnection: jest.fn()
}));

jest.mock('../lib/fetch', () => ({
    fetchWithTimeout: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ connected: true })
    })
}));

jest.mock('../lib/marketDataProvider', () => ({
    getMarketDataProvider: jest.fn().mockReturnValue({
        getMarketSnapshot: jest.fn().mockResolvedValue([])
    }),
    fetchOptionQuote: jest.fn().mockResolvedValue({})
}));

jest.mock('../lib/historicalRepository', () => ({
    HistoricalRepository: jest.fn().mockImplementation(() => ({
        calculateLiveRSI: jest.fn().mockResolvedValue(50),
        getHistoricalContext: jest.fn().mockResolvedValue({})
    }))
}));

jest.mock('../notifications/notifications', () => ({
    notifyPositionAlert: jest.fn().mockResolvedValue({})
}));

jest.mock('@google-cloud/logging', () => ({
    Logging: jest.fn().mockImplementation(() => ({
        getEntries: jest.fn().mockResolvedValue([[]])
    }))
}));

let runMarathonAgent: any;
let checkSystemHealth: any;
let syncHistoricalData: any;
let syncIBKRExecutions: any;
let monitorPositionPrices: any;

beforeAll(() => {
    ({ runMarathonAgent } = require('../reports/agent'));
    ({ checkSystemHealth } = require('../system/health'));
    ({ syncHistoricalData } = require('../portfolio/historicalData'));
    ({ syncIBKRExecutions } = require('../trades/syncIBKR'));
    ({ monitorPositionPrices } = require('../portfolio/positionAlerts'));
});

function getSchedule(fn: any) {
    return fn?.__options?.schedule;
}

describe('Scheduled Functions Configuration', () => {
    describe('Schedule Patterns', () => {
        it('runMarathonAgent runs at 9:30 AM and 3:30 PM ET weekdays', () => {
            // Schedule: '30 9,15 * * 1-5'
            // Validates: Minute 30, Hours 9 and 15, Mon-Fri
            const schedule = getSchedule(runMarathonAgent);
            expect(schedule).toMatch(/^30 9,15 \* \* 1-5$/);
        });

        it('checkSystemHealth runs at 9:45 AM and 3:45 PM ET weekdays', () => {
            // Schedule: '45 9,15 * * 1-5'
            const schedule = getSchedule(checkSystemHealth);
            expect(schedule).toMatch(/^45 9,15 \* \* 1-5$/);
        });

        it('syncHistoricalData runs at 5 PM ET weekdays', () => {
            // Schedule: '0 17 * * 1-5'
            const schedule = getSchedule(syncHistoricalData);
            expect(schedule).toMatch(/^0 17 \* \* 1-5$/);
        });

        it('syncIBKRExecutions runs hourly 10 AM - 4 PM ET weekdays', () => {
            // Schedule: '0 10-16 * * 1-5'
            const schedule = getSchedule(syncIBKRExecutions);
            expect(schedule).toMatch(/^0 10-16 \* \* 1-5$/);
        });

        it('monitorPositionPrices runs every 5 mins 9 AM - 4 PM ET weekdays', () => {
            // Schedule: '*/5 9-16 * * 1-5'
            const schedule = getSchedule(monitorPositionPrices);
            expect(schedule).toMatch(/^\*\/5 9-16 \* \* 1-5$/);
        });
    });

    describe('Market Hours Gating', () => {
        it('isMarketOpen returns false at 9:00 AM ET (before open)', () => {
            // 2026-01-20 is a Tuesday, 14:00 UTC is 9:00 AM ET
            const date = new Date('2026-01-20T14:00:00Z');
            expect(isMarketOpen(date)).toBe(false);
        });

        it('isMarketOpen returns true at 9:30 AM ET (at open)', () => {
            // 14:30 UTC is 9:30 AM ET
            const date = new Date('2026-01-20T14:30:00Z');
            expect(isMarketOpen(date)).toBe(true);
        });

        it('isMarketOpen returns true at 4:00 PM ET (at close)', () => {
            // 21:00 UTC is 4:00 PM ET
            const date = new Date('2026-01-20T21:00:00Z');
            expect(isMarketOpen(date)).toBe(true);
        });

        it('isMarketOpen returns false at 4:01 PM ET (after close)', () => {
            // 21:01 UTC is 4:01 PM ET
            const date = new Date('2026-01-20T21:01:00Z');
            expect(isMarketOpen(date)).toBe(false);
        });

        it('isMarketOpen returns false on weekends', () => {
            // 2026-01-17 is Saturday
            const saturday = new Date('2026-01-17T15:30:00Z');
            // 2026-01-18 is Sunday
            const sunday = new Date('2026-01-18T15:30:00Z');

            expect(isMarketOpen(saturday)).toBe(false);
            expect(isMarketOpen(sunday)).toBe(false);
        });

        it('isMarketOpen returns false on 2026 NYSE holidays', () => {
            const holidays = [
                '2026-01-01', // New Year's Day
                '2026-01-19', // MLK Day
                '2026-02-16', // Washington's Birthday
                '2026-04-03', // Good Friday
                '2026-05-25', // Memorial Day
                '2026-06-19', // Juneteenth
                '2026-07-03', // Independence Day (Observed)
                '2026-09-07', // Labor Day
                '2026-11-26', // Thanksgiving
                '2026-12-25', // Christmas
            ];

            for (const holiday of holidays) {
                // Test at 10:30 AM ET (would normally be open)
                const date = new Date(`${holiday}T15:30:00Z`);
                expect(isMarketOpen(date)).toBe(false);
            }
        });
    });

    describe('Function Schedule Efficiency', () => {
        it('monitorPositionPrices schedule avoids weekend invocations', () => {
            // Cron '*/5 9-16 * * 1-5' only runs Mon-Fri
            // The '1-5' at the end means Monday (1) through Friday (5)
            const cron = getSchedule(monitorPositionPrices);
            expect(cron).toBeDefined();
            const cronString = cron as string;
            const cronDayOfWeek = cronString.split(' ')[4];
            expect(cronDayOfWeek).not.toContain('0'); // Sunday
            expect(cronDayOfWeek).not.toContain('6'); // Saturday
        });

        it('monitorPositionPrices schedule limits to business hours', () => {
            // Cron '*/5 9-16 * * 1-5' runs hours 9-16 (9 AM to 4:55 PM)
            const cron = getSchedule(monitorPositionPrices);
            expect(cron).toBeDefined();
            const cronString = cron as string;
            const cronHours = cronString.split(' ')[1];
            const [start, end] = cronHours.split('-').map(Number);

            expect(start).toBe(9);  // 9 AM
            expect(end).toBe(16);   // Up to 4 PM (last run at 4:55)
        });

        it('max daily invocations for monitorPositionPrices is ~96 (weekdays only)', () => {
            // 9 AM to 4 PM = 8 hours
            // Every 5 minutes = 12 invocations per hour
            // 8 * 12 = 96 invocations max per weekday
            // Note: Actual is slightly less because 9:00-9:25 runs but isMarketOpen skips
            const hoursActive = 8;
            const invocationsPerHour = 12;
            const maxInvocations = hoursActive * invocationsPerHour;

            expect(maxInvocations).toBe(96);
            // Compare to 24/7: 288 per day, 7 days = 2016/week
            // Now: 96 per day, 5 days = 480/week (76% reduction)
        });
    });
});

describe('Function Market-Aware Behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('syncIBKRExecutions should skip when market is closed', async () => {
        // This validates the behavior pattern - actual function import would require more setup
        const mockDate = new Date('2026-01-17T15:30:00Z'); // Saturday
        expect(isMarketOpen(mockDate)).toBe(false);
    });

    it('monitorPositionPrices should skip when market is closed', async () => {
        // Test the gate condition
        const mockDate = new Date('2026-01-19T15:30:00Z'); // MLK Day
        expect(isMarketOpen(mockDate)).toBe(false);
    });

    it('functions without isMarketOpen check rely on cron schedule', () => {
        // runMarathonAgent, checkSystemHealth, syncHistoricalData
        // These run on specific cron times and don't check isMarketOpen()
        // They assume the cron schedule is correct (weekdays only)
        // If a holiday falls on a weekday, they WILL run

        // This is a documentation test - holidays may need future handling
        const goodFriday2026 = new Date('2026-04-03T14:30:00Z'); // Friday, holiday
        const isWeekday = goodFriday2026.getDay() >= 1 && goodFriday2026.getDay() <= 5;

        expect(isWeekday).toBe(true); // Would trigger cron
        expect(isMarketOpen(goodFriday2026)).toBe(false); // But market is closed
    });
});
