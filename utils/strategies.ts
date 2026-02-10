import { Theme } from '../constants/theme';

export type StrategyType = 'Covered Call' | 'Cash-Secured Put' | 'Buy' | 'Sell' | 'CC' | 'CSP' | 'BUY' | 'SELL';

export const getStrategyColor = (type: StrategyType | string): string => {
    const normalized = type.toUpperCase();
    switch (normalized) {
        case 'COVERED CALL':
        case 'CC':
            return Theme.colors.strategyCc;
        case 'CASH-SECURED PUT':
        case 'CSP':
        case 'CASH SECURED PUT':
            return Theme.colors.strategyCsp;
        case 'BUY':
            return Theme.colors.success; // Or a specific Long color
        case 'SELL':
            return Theme.colors.error; // Or a specific Short color
        default:
            return Theme.colors.textMuted;
    }
};

export const getStrategyLabel = (type: StrategyType | string): string => {
    const normalized = type.toUpperCase();
    switch (normalized) {
        case 'CC': return 'Covered Call';
        case 'CSP': return 'Cash-Secured Put';
        default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
};

export const getStrategyAbbreviation = (type: StrategyType | string): string => {
    const normalized = type.toUpperCase();
    switch (normalized) {
        case 'COVERED CALL': return 'CC';
        case 'CASH-SECURED PUT':
        case 'CASH SECURED PUT': return 'CSP';
        default: return normalized;
    }
};
