export const MARKET_TIMEZONE = 'America/New_York';
export const MARKET_OPEN_MINUTES = 9 * 60 + 30;
export const MARKET_CLOSE_MINUTES = 16 * 60;

const NYSE_HOLIDAYS_BY_YEAR: Record<number, string[]> = {
    2026: [
        '2026-01-01', // New Year's Day
        '2026-01-19', // Martin Luther King Jr. Day
        '2026-02-16', // Washington's Birthday
        '2026-04-03', // Good Friday
        '2026-05-25', // Memorial Day
        '2026-06-19', // Juneteenth
        '2026-07-03', // Independence Day (Observed)
        '2026-09-07', // Labor Day
        '2026-11-26', // Thanksgiving Day
        '2026-12-25', // Christmas Day
    ],
};

const HOLIDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeHolidayList = (holidays: string[]) => {
    const unique = new Set<string>();
    holidays.forEach((holiday) => {
        if (typeof holiday !== 'string') return;
        const trimmed = holiday.trim();
        if (!HOLIDAY_PATTERN.test(trimmed)) return;
        unique.add(trimmed);
    });
    return Array.from(unique).sort();
};

const normalizeYear = (year: number) => (
    Number.isFinite(year) ? Math.trunc(year) : null
);

export function setNYSEHolidays(year: number, holidays: string[]) {
    const normalizedYear = normalizeYear(year);
    if (!normalizedYear) return;
    NYSE_HOLIDAYS_BY_YEAR[normalizedYear] = normalizeHolidayList(holidays);
}

export function mergeNYSEHolidays(calendar: Record<number, string[]>) {
    Object.entries(calendar).forEach(([yearKey, holidays]) => {
        const year = Number(yearKey);
        const normalizedYear = normalizeYear(year);
        if (!normalizedYear || !Array.isArray(holidays)) return;
        const existing = NYSE_HOLIDAYS_BY_YEAR[normalizedYear] ?? [];
        NYSE_HOLIDAYS_BY_YEAR[normalizedYear] = normalizeHolidayList([...existing, ...holidays]);
    });
}

export function getNYSEHolidays(year: number) {
    const normalizedYear = normalizeYear(year);
    if (!normalizedYear) return [];
    return [...(NYSE_HOLIDAYS_BY_YEAR[normalizedYear] ?? [])];
}

export type MarketClock = {
    eastern: Date;
    minutes: number;
    isWeekday: boolean;
    isHoliday: boolean;
    isMarketDay: boolean;
    openDate: Date;
    closeDate: Date;
};

export function getEasternDate(now: Date) {
    try {
        const localized = now.toLocaleString('en-US', { timeZone: MARKET_TIMEZONE });
        const eastern = new Date(localized);
        if (Number.isNaN(eastern.getTime())) return now;
        return eastern;
    } catch {
        return now;
    }
}

function formatEasternYmd(eastern: Date) {
    return [
        eastern.getFullYear(),
        String(eastern.getMonth() + 1).padStart(2, '0'),
        String(eastern.getDate()).padStart(2, '0'),
    ].join('-');
}

function isNYSEHolidayEastern(eastern: Date) {
    const holidays = NYSE_HOLIDAYS_BY_YEAR[eastern.getFullYear()];
    if (!holidays) return false;
    return holidays.includes(formatEasternYmd(eastern));
}

function isMarketDayEastern(eastern: Date) {
    const day = eastern.getDay();
    if (day === 0 || day === 6) return false;
    if (isNYSEHolidayEastern(eastern)) return false;
    return true;
}

function buildMarketOpenDate(eastern: Date) {
    const openDate = new Date(eastern);
    openDate.setHours(Math.floor(MARKET_OPEN_MINUTES / 60), MARKET_OPEN_MINUTES % 60, 0, 0);
    return openDate;
}

function buildMarketCloseDate(eastern: Date) {
    const closeDate = new Date(eastern);
    closeDate.setHours(Math.floor(MARKET_CLOSE_MINUTES / 60), MARKET_CLOSE_MINUTES % 60, 0, 0);
    return closeDate;
}

export function getMarketClock(now: Date = new Date()): MarketClock {
    const eastern = getEasternDate(now);
    const day = eastern.getDay();
    const minutes = eastern.getHours() * 60 + eastern.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isHoliday = isNYSEHolidayEastern(eastern);
    const isMarketDay = isWeekday && !isHoliday;
    return {
        eastern,
        minutes,
        isWeekday,
        isHoliday,
        isMarketDay,
        openDate: buildMarketOpenDate(eastern),
        closeDate: buildMarketCloseDate(eastern),
    };
}

export function isNYSEHoliday(date: Date) {
    return isNYSEHolidayEastern(getEasternDate(date));
}

export function isMarketDay(date: Date) {
    return isMarketDayEastern(getEasternDate(date));
}

export function isMarketOpen(date: Date) {
    const clock = getMarketClock(date);
    if (!clock.isMarketDay) return false;
    return clock.minutes >= MARKET_OPEN_MINUTES && clock.minutes <= MARKET_CLOSE_MINUTES;
}

export function getNextMarketOpenDate(date: Date) {
    const clock = getMarketClock(date);
    if (clock.isMarketDay && clock.minutes < MARKET_OPEN_MINUTES) {
        return clock.openDate;
    }
    const cursor = new Date(clock.eastern);
    cursor.setDate(cursor.getDate() + 1);
    while (!isMarketDayEastern(cursor)) {
        cursor.setDate(cursor.getDate() + 1);
    }
    return buildMarketOpenDate(cursor);
}
