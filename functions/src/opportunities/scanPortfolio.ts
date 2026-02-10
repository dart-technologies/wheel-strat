import { onCall, HttpsError } from "firebase-functions/v2/https";
import { fetchWithTimeout } from "@/lib/fetch";
import { getMarketDataProvider, MarketSnapshot, fetchOptionQuote } from "@/lib/marketDataProvider";
import { getPublicMarketConfig, PUBLIC_API_SECRET } from "@/lib/publicMarketData";
import {
    calculateAnnualizedYield,
    calculateWinProbFromDelta,
    type DteWindow,
    type Opportunity,
    type Position,
} from "@wheel-strat/shared";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { ibkrHealthSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import { enrichTopOpportunitiesWithAI, generateOpportunitiesSynopsis } from "./scanPortfolioAi";
import { persistOpportunities } from "./scanPortfolioPersistence";
import {
    daysToExpiration,
    formatExpiration,
    resolveDteRange,
    selectExpiration
} from "./scanPortfolioUtils";

/**
 * scanPortfolioHandler - The core logic for scanning portfolio
 */
export const scanPortfolioHandler = async (request: any) => {
    const data = request.data;
    try {
        const publicConfig = getPublicMarketConfig();
        const providerPref = (process.env.MARKET_DATA_PROVIDER || '').trim().toLowerCase();
        const usePublic = providerPref === 'public' && publicConfig.configured;
        const {
            positions,
            cash,
            watchlist = ['NVDA', 'TSLA', 'GOOGL', 'AMZN', 'AAPL', 'MSFT', 'META'],
            dteWindow
        } = data as {
            positions: Position[];
            cash: number;
            watchlist?: string[];
            dteWindow?: DteWindow;
        };

        // Input Validation
        if (!positions || !Array.isArray(positions)) {
            console.error("Invalid input: 'positions' must be an array.");
            throw new HttpsError("invalid-argument", "Positions array is required.");
        }
        // Ensure cash is a number, default to 0 if missing/invalid
        const safeCash = typeof cash === 'number' ? cash : 0;

        const requireIbkr = !usePublic;
        const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured } = requireIbkrBridge({ requireConfigured: requireIbkr });

        const marketProvider = getMarketDataProvider();
        const resolvedBridgeUrl = bridgeUrl;

        const dteRange = resolveDteRange(dteWindow);

        console.log(`Scanning portfolio: ${positions.length} positions, $${safeCash} cash`);
        console.log(`Using DTE window: ${dteRange.label} (${dteRange.minDays}-${dteRange.maxDays} days)`);

        if (requireIbkr) {
            // Health check
            try {
                const healthRes = await fetchWithTimeout(`${resolvedBridgeUrl}/health`, {}, 15000, bridgeApiKey);
                const rawHealth = await healthRes.json();
                const health = parseIbkrResponse(ibkrHealthSchema, rawHealth, 'health');
                if (!health?.connected) {
                    throw new HttpsError("unavailable", "IBKR Bridge not connected to IB Gateway");
                }
            } catch (error) {
                console.error("Bridge health check failed:", error);
                if (error instanceof HttpsError) throw error;
                throw new HttpsError("unavailable", `Cannot reach IBKR Bridge server at ${resolvedBridgeUrl}`);
            }
        } else if (!bridgeUrlConfigured) {
            console.warn("[scanPortfolio] IBKR bridge not configured; proceeding with Public-only data.");
        }

        const opportunities: Opportunity[] = [];

        // 1. Gather all symbols for bulk data fetching
        const ccSymbols = positions.filter(p => p.quantity >= 100).map(p => p.symbol);
        const cspSymbols = watchlist.filter(s => !positions.some(p => p.symbol === s && p.quantity >= 100));
        const allTargetSymbols = Array.from(new Set([...ccSymbols, ...cspSymbols]));

        console.log(`🌐 Fetching market data for ${allTargetSymbols.length} target symbols...`);
        const snapshots = await marketProvider.getMarketSnapshot(allTargetSymbols);
        const snapshotMap = new Map<string, MarketSnapshot>(snapshots.map((s: MarketSnapshot) => [s.symbol, s]));

        // 2. Process Opportunities in Parallel
        await Promise.all(allTargetSymbols.map(async (symbol) => {
            try {
                const snapshot = snapshotMap.get(symbol);
                if (!snapshot) return;

                const isCC = ccSymbols.includes(symbol);
                const isCSP = cspSymbols.includes(symbol);
                const currentPrice = snapshot.price;

                // Simple cash check for CSP
                if (isCSP && currentPrice * 100 > safeCash) return;

                const chain = await marketProvider.getOptionChain(symbol);
                if (!chain || !chain.expirations.length || !chain.strikes.length) return;

                const targetExp = selectExpiration(chain.expirations, dteRange) || chain.expirations[0];
                const sortedStrikes = [...chain.strikes].sort((a, b) => a - b);

                if (isCC) {
                    const otmStrike = sortedStrikes.find(s => s >= currentPrice * 1.05 && s <= currentPrice * 1.15)
                        || sortedStrikes.find(s => s > currentPrice);

                    if (otmStrike) {
                        const quote = await fetchOptionQuote(resolvedBridgeUrl, symbol, otmStrike, targetExp, 'C', bridgeApiKey);
                        if (quote.bid && quote.ask) {
                            const premium = (quote.bid + quote.ask) / 2;
                            const daysOut = daysToExpiration(targetExp);
                            const annualizedYield = calculateAnnualizedYield(premium, currentPrice, daysOut);
                            const delta = Math.abs(quote.delta || 0.3);
                            const winProb = calculateWinProbFromDelta(delta);

                            opportunities.push({
                                symbol,
                                strategy: "Covered Call",
                                strike: otmStrike,
                                expiration: formatExpiration(targetExp),
                                premium: Math.round(premium * 100) / 100,
                                winProb,
                                ivRank: snapshot.ivRank ?? 0,
                                annualizedYield,
                                reasoning: "",
                                priority: 0
                            });
                        }
                    }
                }

                if (isCSP) {
                    const descStrikes = [...sortedStrikes].sort((a, b) => b - a);
                    // Optimal: 85-95% OTM
                    let otmStrike = descStrikes.find(s => s <= currentPrice * 0.95 && s >= currentPrice * 0.85 && s * 100 <= safeCash);
                    
                    // Fallback: Any OTM strike that fits in cash
                    if (!otmStrike) {
                        otmStrike = descStrikes.find(s => s < currentPrice && s * 100 <= safeCash);
                    }

                    if (otmStrike) {
                        const quote = await fetchOptionQuote(resolvedBridgeUrl, symbol, otmStrike, targetExp, 'P', bridgeApiKey);
                        if (quote.bid && quote.ask) {
                            const premium = (quote.bid + quote.ask) / 2;
                            const daysOut = daysToExpiration(targetExp);
                            const annualizedYield = calculateAnnualizedYield(premium, otmStrike, daysOut);
                            const delta = Math.abs(quote.delta || 0.25);
                            const winProb = calculateWinProbFromDelta(delta);

                            opportunities.push({
                                symbol,
                                strategy: "Cash-Secured Put",
                                strike: otmStrike,
                                expiration: formatExpiration(targetExp),
                                premium: Math.round(premium * 100) / 100,
                                winProb,
                                ivRank: snapshot.ivRank ?? 0,
                                annualizedYield,
                                reasoning: "",
                                priority: 0,
                                currentPrice
                            });
                        }
                    }
                }
            } catch (e) {
                console.error(`Error analyzing ${symbol}:`, e);
            }
        }));

        // 3. Sort by annualized yield and select top 3
        console.log(`=== Found ${opportunities.length} total opportunities ===`);
        opportunities.sort((a, b) => (b.annualizedYield ?? 0) - (a.annualizedYield ?? 0));
        const top3 = opportunities.slice(0, 3);

        const today = new Date().toISOString().split('T')[0];
        await enrichTopOpportunitiesWithAI(top3, positions, today);
        const synopsis = await generateOpportunitiesSynopsis(top3, positions, today);
        await persistOpportunities(top3, synopsis);

        return {
            opportunities: top3,
            scannedAt: new Date().toISOString(),
            totalCandidates: opportunities.length,
            bridgeUrl: resolvedBridgeUrl
        };
    } catch (error) {
        console.error("Critical error in scanPortfolio:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An internal error occurred during portfolio scan", error);
    }
};

/**
 * scanPortfolio - Scan portfolio for Covered Call and Cash-Secured Put opportunities
 */
export const scanPortfolio = onCall({
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [PUBLIC_API_SECRET]
}, scanPortfolioHandler);
