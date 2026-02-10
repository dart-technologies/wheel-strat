import {
    AnalysisSettings,
    DteWindow,
    DEFAULT_DTE_WINDOW,
    DTE_WINDOW_OPTIONS,
    getDteWindowRange,
    getImpliedExpirationDate,
    normalizeDteWindow,
    TraderLevel,
} from '@wheel-strat/shared';

export type { TraderLevel, DteWindow, AnalysisSettings };
export { DEFAULT_DTE_WINDOW, DTE_WINDOW_OPTIONS, getDteWindowRange, getImpliedExpirationDate };

export const TRADER_LEVELS: TraderLevel[] = ['Novice', 'Intermediate', 'Expert'];
export const DEFAULT_TRADER_LEVEL: TraderLevel = 'Intermediate';

const LEGACY_TRADER_LEVEL_MAP: Record<string, TraderLevel> = {
    Beginner: 'Novice',
    Advanced: 'Expert',
};

export function normalizeTraderLevel(level?: TraderLevel | string): TraderLevel {
    if (!level) return DEFAULT_TRADER_LEVEL;
    if (TRADER_LEVELS.includes(level as TraderLevel)) {
        return level as TraderLevel;
    }
    return LEGACY_TRADER_LEVEL_MAP[level] ?? DEFAULT_TRADER_LEVEL;
}

function normalizeSettings(settings?: Partial<AnalysisSettings>): AnalysisSettings {
    return {
        riskLevel: settings?.riskLevel ?? 'Moderate',
        traderLevel: normalizeTraderLevel(settings?.traderLevel),
        dteWindow: normalizeDteWindow(settings?.dteWindow),
    };
}

export function areAnalysisSettingsEqual(
    left?: Partial<AnalysisSettings>,
    right?: Partial<AnalysisSettings>
) {
    const normalizedLeft = normalizeSettings(left);
    const normalizedRight = normalizeSettings(right);
    return normalizedLeft.riskLevel === normalizedRight.riskLevel
        && normalizedLeft.traderLevel === normalizedRight.traderLevel
        && normalizedLeft.dteWindow === normalizedRight.dteWindow;
}
