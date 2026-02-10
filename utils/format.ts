/**
 * Formats a number as a currency string (e.g., "$1,234.56").
 */
export const formatCurrency = (value: number, currencySymbol = '$'): string => {
    if (!Number.isFinite(value)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/**
 * Formats a number as a percentage string (e.g., "12.5%").
 */
export const formatPercent = (value: number, decimals = 1): string => {
    if (!Number.isFinite(value)) return '0.0%';
    return `${value.toFixed(decimals)}%`;
};

/**
 * Safely parses a value to a number, returning undefined or a fallback if invalid.
 */
export const parseNumber = (value: unknown, fallback?: number): number | undefined => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatCompactCurrency = (value?: number, decimals = 0, currencySymbol = '$'): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const sign = value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    return `${sign}${currencySymbol}${absValue.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
    })}`;
};

export const formatCompactPercent = (value?: number, decimals = 1): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return formatPercent(value, decimals);
};
