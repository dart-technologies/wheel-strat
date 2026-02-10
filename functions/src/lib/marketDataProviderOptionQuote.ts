import {
    buildPublicOptionOsiMap,
    buildPublicOptionQuoteMap,
    fetchPublicOptionChain,
    fetchPublicOptionGreeks,
    getPublicMarketConfig
} from "./publicMarketData";
import { fetchWithTimeout } from "./fetch";
import { ibkrHistoricalSchema, ibkrOptionQuoteSchema, parseIbkrResponse } from "./ibkrSchemas";
import type { OptionQuote } from "./marketDataProviderTypes";

export async function fetchOptionQuote(
    bridgeUrl: string,
    symbol: string,
    strike: number,
    expiration: string,
    right: "C" | "P",
    bridgeApiKey?: string
): Promise<OptionQuote> {
    try {
        const providerPref = (process.env.MARKET_DATA_PROVIDER || "").trim().toLowerCase();
        const publicConfig = getPublicMarketConfig();
        const preferPublic = providerPref === "public" || providerPref === "";
        const usePublic = preferPublic && publicConfig.configured;

        if (providerPref === "public" && !publicConfig.configured) {
            console.warn("[fetchOptionQuote] MARKET_DATA_PROVIDER=public but Public credentials missing; using IBKR fallback.");
        }

        if (usePublic) {
            const normalizedExpiration = expiration.replace(/-/g, "");
            const chain = await fetchPublicOptionChain(symbol, publicConfig, expiration);
            if (chain) {
                const map = buildPublicOptionQuoteMap(chain);
                const osiMap = buildPublicOptionOsiMap(chain);
                const key = `${symbol.toUpperCase()}|${normalizedExpiration}|${right}|${strike}`;
                let publicQuote = map.get(key);
                if (publicQuote) {
                    const osi = osiMap.get(key);
                    if (osi) {
                        const greekMap = await fetchPublicOptionGreeks([osi], publicConfig);
                        const greeks = greekMap?.get(osi);
                        if (greeks) {
                            publicQuote = {
                                ...publicQuote,
                                delta: publicQuote.delta ?? greeks.delta,
                                gamma: publicQuote.gamma ?? greeks.gamma,
                                theta: publicQuote.theta ?? greeks.theta,
                                vega: publicQuote.vega ?? greeks.vega
                            };
                        }
                    }
                }
                if (publicQuote) {
                    const quote: OptionQuote = {
                        bid: publicQuote.bid,
                        ask: publicQuote.ask,
                        last: publicQuote.last,
                        close: publicQuote.close,
                        modelOptPrice: publicQuote.modelOptPrice,
                        delta: publicQuote.delta,
                        gamma: publicQuote.gamma,
                        theta: publicQuote.theta,
                        vega: publicQuote.vega
                    };

                    // Calculate premium based on hierarchy
                    let premium: number | undefined;
                    let premiumSource: OptionQuote["premiumSource"];

                    if (quote.bid !== undefined && quote.ask !== undefined && quote.bid > 0 && quote.ask > 0) {
                        premium = (quote.bid + quote.ask) / 2;
                        premiumSource = "mid";
                    } else if (quote.bid !== undefined && quote.bid > 0) {
                        premium = quote.bid;
                        premiumSource = "bid";
                    } else if (quote.ask !== undefined && quote.ask > 0) {
                        premium = quote.ask;
                        premiumSource = "ask";
                    } else if (quote.last !== undefined && quote.last > 0) {
                        premium = quote.last;
                        premiumSource = "last";
                    } else if (quote.modelOptPrice !== undefined && quote.modelOptPrice > 0) {
                        premium = quote.modelOptPrice;
                        premiumSource = "model";
                    }

                    return { ...quote, premium, premiumSource };
                }
            }
        }

        const res = await fetchWithTimeout(`${bridgeUrl}/option-quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, strike, expiration, right })
        }, 30000, bridgeApiKey);

        if (!res.ok) return {};
        const rawQuote = await res.json();
        const parsedQuote = parseIbkrResponse(ibkrOptionQuoteSchema, rawQuote, `option-quote/${symbol}`);
        const quote = (parsedQuote ?? {}) as OptionQuote;

        // Calculate premium based on hierarchy
        let premium: number | undefined;
        let premiumSource: OptionQuote["premiumSource"];

        if (quote.bid !== undefined && quote.ask !== undefined && quote.bid > 0 && quote.ask > 0) {
            premium = (quote.bid + quote.ask) / 2;
            premiumSource = "mid";
        } else if (quote.bid !== undefined && quote.bid > 0) {
            premium = quote.bid;
            premiumSource = "bid";
        } else if (quote.ask !== undefined && quote.ask > 0) {
            premium = quote.ask;
            premiumSource = "ask";
        } else if (quote.last !== undefined && quote.last > 0) {
            premium = quote.last;
            premiumSource = "last";
        } else if (quote.modelOptPrice !== undefined && quote.modelOptPrice > 0) {
            premium = quote.modelOptPrice;
            premiumSource = "model";
        }

        const result = { ...quote, premium, premiumSource };

        if (result.premium !== undefined) {
            return result;
        }

        // Historical fallback (IBKR) when live quote fails.
        try {
            const histRes = await fetchWithTimeout(`${bridgeUrl}/historical`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secType: "OPT",
                    symbol,
                    expiration,
                    strike,
                    right,
                    barSize: process.env.IB_OPTION_HIST_BAR_SIZE || "15 mins",
                    duration: process.env.IB_OPTION_HIST_DURATION || "1 D"
                })
            }, 60000, bridgeApiKey);

            if (histRes.ok) {
                const rawPayload = await histRes.json();
                const payload = parseIbkrResponse(ibkrHistoricalSchema, rawPayload, `historical/${symbol}`);
                if (!payload) return result;
                const bars = Array.isArray(payload.bars) ? payload.bars : [];
                if (bars.length) {
                    const lastBar = bars[bars.length - 1];
                    const price = lastBar.close ?? lastBar.average;
                    if (price !== undefined && price > 0) {
                        return {
                            last: price,
                            close: price,
                            premium: price,
                            premiumSource: "last"
                        };
                    }
                }
            }
        } catch (error) {
            console.warn(`❌ [fetchOptionQuote] Historical fallback failed for ${symbol} ${strike}${right}:`, error);
        }

        return result;
    } catch (error) {
        console.error(`❌ [fetchOptionQuote] Failed for ${symbol} ${strike}${right}:`, error);
        return {};
    }
}
