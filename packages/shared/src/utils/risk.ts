import type { RiskLevel } from '../schema';

export type { RiskLevel };

export const RISK_TARGET_WIN_PROB: Record<RiskLevel, number> = {
    Aggressive: 55,
    Moderate: 70,
    Conservative: 85,
};

export function normalizeRiskLevel(level?: RiskLevel | string): RiskLevel {
    if (level === 'Aggressive' || level === 'Moderate' || level === 'Conservative') {
        return level;
    }
    return 'Moderate';
}

export function getTargetWinProb(level?: RiskLevel | string) {
    const normalized = normalizeRiskLevel(level);
    return RISK_TARGET_WIN_PROB[normalized];
}

export type RiskConfig = {
    winProb: number;
    label: RiskLevel;
};

export function getRiskConfig(level?: RiskLevel | string): RiskConfig {
    const normalized = normalizeRiskLevel(level);
    return {
        winProb: getTargetWinProb(normalized),
        label: normalized,
    };
}
