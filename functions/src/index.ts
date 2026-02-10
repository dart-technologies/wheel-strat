import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import { bootstrapMarketCalendar } from "./lib/marketCalendar";

setGlobalOptions({ region: "us-central1" });

admin.initializeApp();
bootstrapMarketCalendar();

// Export all Cloud Functions
export { explainTrade } from "./trades/explainTrade";
export { runMarathonAgent, runMarathonAgentManual } from "./reports/agent";
export { scanPortfolio } from "./opportunities/scanPortfolio";
export { getMarketReport } from "./reports/marketReport";
export { sendTestPush } from "./notifications/notifications";
export { monitorPositionPrices, updatePositionSnapshots } from "./portfolio/positionAlerts";
export {
    syncHistoricalData,
    repairIntradayGaps,
    repairIntradayGapsManual,
    getHistoricalBars
} from "./portfolio/historicalData";
export { refreshLiveOptions } from "./opportunities/liveMarketData";
export { syncIBKRExecutions, manualSyncIBKR, ingestIbkrExecutions } from "./trades/syncIBKR";
export { closeExpiredOptions } from "./trades/expireOptions";
export { checkSystemHealth, checkDatabaseConnectivity } from "./system/health";
export { syncCommunityPortfolio } from "./portfolio/syncCommunityPortfolio";
export { syncUserPortfolio } from "./portfolio/syncUserPortfolio";
export { getCommunityPortfolioUpdates } from "./portfolio/communityPortfolioDelta";
export { syncCorporateActions, manualSyncCorporateActions } from "./portfolio/syncCorporateActions";
export { getLeaderboard } from "./trades/leaderboard";
export { syncMarketCalendar, syncMarketCalendarManual } from "./calendar/syncMarketCalendar";
export { verifyMarathonAgent, verifyMarathonAgentManual } from "./reports/verifyMarathonAgent";
export {
    refreshVolatilityRegimes,
    refreshVolatilityRegimesManual,
    backfillVolatilityRegimes,
    backfillVolatilityRegimesManual,
    ingestSplitFactors,
    ingestSplitFactorsManual,
    precomputePatternStats,
    precomputePatternStatsManual,
    precomputeStrategyStats,
    precomputeStrategyStatsManual,
    scanAsymmetricPatterns,
    scanAsymmetricPatternsManual,
    scanScenarioAlerts,
    scanScenarioAlertsManual,
    scanPremiumAnomalies,
    scanPremiumAnomaliesManual,
    scanStrategySignals,
    scanStrategySignalsManual
} from "./analysis/backtestPipeline";
