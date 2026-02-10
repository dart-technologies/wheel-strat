import {
    getMarketClock,
    getNextMarketOpenDate,
    isMarketOpen,
    MARKET_CLOSE_MINUTES,
    MARKET_OPEN_MINUTES,
} from '@wheel-strat/shared';

type MarketStatus = {
    isOpen: boolean;
    statusLabel: string;
    detailLabel: string;
};

function formatMinutes(minutes: number) {
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${mins.toString().padStart(2, '0')} ${period} ET`;
}

function formatDuration(ms: number) {
    if (!Number.isFinite(ms)) return null;
    const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) {
        return `${days}d ${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m`;
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
    const clock = getMarketClock(now);
    const isOpen = isMarketOpen(now);

    if (isOpen) {
        const timeToClose = clock.closeDate.getTime() - clock.eastern.getTime();
        const closeDuration = formatDuration(timeToClose);
        return {
            isOpen: true,
            statusLabel: 'Market Open',
            detailLabel: closeDuration
                ? `Closes in ${closeDuration}`
                : `Closes at ${formatMinutes(MARKET_CLOSE_MINUTES)}`,
        };
    }

    const nextOpen = getNextMarketOpenDate(now);
    const timeToOpen = nextOpen.getTime() - clock.eastern.getTime();
    const openDuration = formatDuration(timeToOpen);
    return {
        isOpen: false,
        statusLabel: 'Market Closed',
        detailLabel: openDuration
            ? `Opens in ${openDuration}`
            : `Opens at ${formatMinutes(MARKET_OPEN_MINUTES)}`,
    };
}
