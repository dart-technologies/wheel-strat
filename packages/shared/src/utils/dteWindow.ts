import type { DteWindow } from '../schema';

export type DteWindowOption = {
    value: DteWindow;
    label: string;
    minDays: number;
    maxDays: number;
    weeks: number;
};

export const DTE_WINDOW_OPTIONS: DteWindowOption[] = [
    { value: 'one_week', label: '1 wk', minDays: 0, maxDays: 7, weeks: 1 },
    { value: 'two_weeks', label: '2 wk', minDays: 8, maxDays: 14, weeks: 2 },
    { value: 'three_weeks', label: '3 wk', minDays: 15, maxDays: 21, weeks: 3 },
    { value: 'four_weeks', label: '4 wk', minDays: 22, maxDays: 28, weeks: 4 },
    { value: 'five_weeks', label: '5 wk', minDays: 29, maxDays: 35, weeks: 5 },
];

export const DEFAULT_DTE_WINDOW: DteWindow = 'three_weeks';

const LEGACY_DTE_WINDOW_MAP: Record<string, DteWindow> = {
    two_three_weeks: 'three_weeks',
    four_five_weeks: 'five_weeks',
};

export function normalizeDteWindow(window?: DteWindow | string): DteWindow {
    if (!window) return DEFAULT_DTE_WINDOW;
    const match = DTE_WINDOW_OPTIONS.find((option) => option.value === window);
    if (match) return match.value;
    return LEGACY_DTE_WINDOW_MAP[window] ?? DEFAULT_DTE_WINDOW;
}

export function getDteWindowRange(window?: DteWindow | string): DteWindowOption {
    const normalized = normalizeDteWindow(window);
    const match = DTE_WINDOW_OPTIONS.find((option) => option.value === normalized);
    return match ?? DTE_WINDOW_OPTIONS.find((option) => option.value === DEFAULT_DTE_WINDOW)!;
}

export function getImpliedExpirationDate(window?: DteWindow | string, now: Date = new Date()) {
    const option = getDteWindowRange(window);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = base.getDay();
    const daysUntilFriday = (5 - day + 7) % 7;
    const friday = new Date(base);
    friday.setDate(base.getDate() + daysUntilFriday + (option.weeks - 1) * 7);
    return friday;
}
