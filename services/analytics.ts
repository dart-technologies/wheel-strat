import { getAnalytics, logEvent as firebaseLogEvent } from '@react-native-firebase/analytics';

const analytics = getAnalytics();

/**
 * Analytics Service
 * Provides a typed wrapper for Firebase Analytics events.
 */
export const Analytics = {
    /**
     * Log a screen view event
     */
    async logScreenView(screenName: string) {
        try {
            await firebaseLogEvent(analytics, 'screen_view', {
                screen_name: screenName,
                screen_class: screenName,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log screen view:', error);
        }
    },

    /**
     * Log when an opportunity is viewed
     */
    async logOpportunityView(symbol: string, strategy: string) {
        try {
            await firebaseLogEvent(analytics, 'opportunity_view', {
                symbol,
                strategy,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log opportunity view:', error);
        }
    },

    /**
     * Log when a position is viewed
     */
    async logPositionView(symbol: string) {
        try {
            await firebaseLogEvent(analytics, 'position_view', {
                symbol,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log position view:', error);
        }
    },

    /**
     * Log when a market scan is triggered
     */
    async logScanTriggered(
        riskLevel: string,
        options?: { traderLevel?: string; dteWindow?: string }
    ) {
        try {
            await firebaseLogEvent(analytics, 'scan_opportunities', {
                risk_level: riskLevel,
                trader_level: options?.traderLevel,
                dte_window: options?.dteWindow,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log scan triggered:', error);
        }
    },

    /**
     * Log when a trade execution is initiated (e.g., clicking IBKR link)
     */
    async logTradeExecution(symbol: string, strategy: string) {
        try {
            await firebaseLogEvent(analytics, 'trade_execution', {
                symbol,
                strategy,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log trade execution:', error);
        }
    },

    /**
     * Log when a strategy explanation is viewed
     */
    async logStrategyExplanation(symbol: string, strategy: string) {
        try {
            await firebaseLogEvent(analytics, 'strategy_explanation_view', {
                symbol,
                strategy,
            });
        } catch (error) {
            console.warn('[Analytics] Failed to log strategy explanation view:', error);
        }
    },

    /**
     * Log generic events
     */
    async logEvent(name: string, params?: object) {
        try {
            await firebaseLogEvent(analytics, name, params || {});
        } catch (error) {
            console.warn(`[Analytics] Failed to log event ${name}:`, error);
        }
    }
};
