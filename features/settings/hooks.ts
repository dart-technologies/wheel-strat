import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRow } from 'tinybase/ui-react';
import { store } from '@/data/store';
import type { RiskLevel, AnalysisSettings, DteWindow, TraderLevel } from '@wheel-strat/shared';
import {
    areAnalysisSettingsEqual,
    DEFAULT_DTE_WINDOW,
    DEFAULT_TRADER_LEVEL,
    getDteWindowRange,
    normalizeTraderLevel,
} from '@/utils/settings';

type AppSettingsRow = {
    riskLevel?: RiskLevel;
    traderLevel?: TraderLevel;
    dteWindow?: DteWindow;
    analysisRiskLevel?: RiskLevel;
    analysisTraderLevel?: TraderLevel;
    analysisDteWindow?: DteWindow;
    analysisUpdatedAt?: string;
    onboardingSeen?: boolean;
};

function buildCurrentSettings(appSettings?: AppSettingsRow): AnalysisSettings {
    const normalizedDte = getDteWindowRange(appSettings?.dteWindow).value;
    return {
        riskLevel: appSettings?.riskLevel ?? 'Moderate',
        traderLevel: normalizeTraderLevel(appSettings?.traderLevel),
        dteWindow: normalizedDte ?? DEFAULT_DTE_WINDOW,
    };
}

export function useRiskProfile() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const currentRisk = appSettings?.riskLevel ?? 'Moderate';

    const setRiskLevel = useCallback((level: RiskLevel) => {
        store.setCell('appSettings', 'main', 'riskLevel', level);
    }, []);

    return { currentRisk, setRiskLevel };
}

export function useTraderLevel() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const currentTraderLevel = normalizeTraderLevel(appSettings?.traderLevel);

    const setTraderLevel = useCallback((level: TraderLevel) => {
        store.setCell('appSettings', 'main', 'traderLevel', level);
    }, []);

    return { currentTraderLevel, setTraderLevel };
}

export function useDteWindow() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const currentDteWindow = getDteWindowRange(appSettings?.dteWindow).value ?? DEFAULT_DTE_WINDOW;

    const setDteWindow = useCallback((window: DteWindow) => {
        store.setCell('appSettings', 'main', 'dteWindow', window);
    }, []);

    return { currentDteWindow, setDteWindow };
}

export function useAnalysisSettings() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const currentSettings = useMemo(
        () => buildCurrentSettings(appSettings),
        [appSettings]
    );

    return { currentSettings, appSettings };
}

export function useAnalysisStaleness() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const currentSettings = useMemo(
        () => buildCurrentSettings(appSettings),
        [appSettings]
    );

    const analysisSettings: Partial<AnalysisSettings> = {
        riskLevel: appSettings?.analysisRiskLevel,
        traderLevel: appSettings?.analysisTraderLevel,
        dteWindow: appSettings?.analysisDteWindow,
    };

    const analysisUpdatedAt = appSettings?.analysisUpdatedAt
        ? new Date(appSettings.analysisUpdatedAt)
        : null;
    const hasSnapshot = Boolean(appSettings?.analysisUpdatedAt);
    const isStale = hasSnapshot && !areAnalysisSettingsEqual(currentSettings, analysisSettings);

    return { isStale, analysisUpdatedAt, currentSettings };
}

export function useOnboardingState() {
    const appSettings = useRow('appSettings', 'main', store) as AppSettingsRow | undefined;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (appSettings?.onboardingSeen === false) {
            setIsVisible(true);
        }
    }, [appSettings]);

    const markOnboardingSeen = useCallback(() => {
        store.setCell('appSettings', 'main', 'onboardingSeen', true);
        setIsVisible(false);
    }, []);

    return { isVisible, setIsVisible, markOnboardingSeen };
}
