import { defineSecret } from "firebase-functions/params";
import type {
    PublicEquityQuote,
    PublicMarketConfig,
    PublicOptionChain,
    PublicOptionQuote
} from "./publicMarketDataTypes";
import { publicRequest } from "./publicMarketDataClient";
import {
    extractQuote,
    formatExpirationRequest,
    normalizeExpiration,
    parseOptionChain,
    toNumber
} from "./publicMarketDataUtils";

export type {
    PublicEquityQuote,
    PublicMarketConfig,
    PublicOptionChain,
    PublicOptionQuote
} from "./publicMarketDataTypes";

const DEFAULT_PUBLIC_GATEWAY = "https://api.public.com/userapigateway";

export const PUBLIC_API_SECRET = defineSecret("PUBLIC_API_SECRET");

export function getPublicMarketConfig(env: Record<string, string | undefined> = process.env): PublicMarketConfig {
    const apiKey = env.PUBLIC_API_KEY || "";
    let apiSecret = env.PUBLIC_API_SECRET;
    if (!apiSecret) {
        try {
            apiSecret = PUBLIC_API_SECRET.value();
        } catch {
            apiSecret = undefined;
        }
    }
    const gateway = env.PUBLIC_API_GATEWAY || DEFAULT_PUBLIC_GATEWAY;
    const accountId = env.PUBLIC_ACCOUNT_ID || "";
    return {
        apiKey,
        apiSecret,
        gateway,
        accountId,
        configured: Boolean(accountId && (apiKey || apiSecret))
    };
}

export async function fetchPublicOptionExpirations(
    symbol: string,
    config: PublicMarketConfig
): Promise<string[]> {
    if (!config.configured) return [];
    const payload = await publicRequest(config, `/marketdata/${config.accountId}/option-expirations`, {
        method: "POST",
        body: { instrument: { symbol, type: "EQUITY" } }
    });
    if (!payload) return [];

    const raw = payload.expirationDates
        || payload.expirations
        || payload.data?.expirationDates
        || payload.data?.expirations
        || payload.results
        || [];
    if (!Array.isArray(raw)) return [];

    const normalized = raw
        .map(normalizeExpiration)
        .filter((exp): exp is string => Boolean(exp));
    return Array.from(new Set(normalized)).sort();
}

export async function fetchPublicEquityQuotes(
    symbols: string[],
    config: PublicMarketConfig
): Promise<Map<string, PublicEquityQuote> | null> {
    if (!config.configured) return null;
    const normalized = symbols.map((symbol) => symbol.toUpperCase());
    const payload = await publicRequest(config, `/marketdata/${config.accountId}/quotes`, {
        method: "POST",
        body: {
            symbols: normalized,
            instruments: normalized.map((symbol) => ({ symbol, type: "EQUITY" }))
        }
    });
    if (!payload) return null;

    const rawQuotes = payload.quotes || payload.data?.quotes || payload.results || payload.marketData || [];
    if (!Array.isArray(rawQuotes)) return null;

    const map = new Map<string, PublicEquityQuote>();
    rawQuotes.forEach((quote: any) => {
        const symbol = String(quote.symbol || quote?.instrument?.symbol || quote?.ticker || "").toUpperCase();
        if (!symbol) return;
        map.set(symbol, {
            symbol,
            bid: toNumber(quote.bid ?? quote.bidPrice ?? quote.bid_price),
            ask: toNumber(quote.ask ?? quote.askPrice ?? quote.ask_price),
            last: toNumber(quote.last ?? quote.lastPrice ?? quote.tradePrice ?? quote.price),
            close: toNumber(quote.close ?? quote.prevClose ?? quote.previousClose)
        });
    });
    return map;
}

export async function fetchPublicOptionChain(
    symbol: string,
    config: PublicMarketConfig,
    expirationDate?: string
): Promise<PublicOptionChain | null> {
    if (!config.configured) return null;
    const normalizedSymbol = symbol.toUpperCase();
    let normalizedExpiration = expirationDate ? normalizeExpiration(expirationDate) : null;
    if (!normalizedExpiration) {
        const expirations = await fetchPublicOptionExpirations(normalizedSymbol, config);
        if (!expirations.length) {
            console.warn(`[publicMarketData] option-chain: no expirations for ${normalizedSymbol}`);
            return null;
        }
        normalizedExpiration = expirations[0];
    }

    const body: Record<string, any> = {
        instrument: { symbol: normalizedSymbol, type: "EQUITY" },
        expirationDate: formatExpirationRequest(normalizedExpiration)
    };
    const payload = await publicRequest(config, `/marketdata/${config.accountId}/option-chain`, {
        method: "POST",
        body
    }, 30000);
    const chain = parseOptionChain(normalizedSymbol, payload);
    if (!chain) return null;
    return { ...chain, expirations: [normalizedExpiration] };
}

export function buildPublicOptionQuoteMap(chain: PublicOptionChain): Map<string, PublicOptionQuote> {
    const map = new Map<string, PublicOptionQuote>();
    chain.options.forEach((option) => {
        const key = `${chain.symbol}|${option.expiration}|${option.right}|${option.strike}`;
        map.set(key, option.quote);
    });
    return map;
}

export function buildPublicOptionOsiMap(chain: PublicOptionChain): Map<string, string> {
    const map = new Map<string, string>();
    chain.options.forEach((option) => {
        if (!option.osiSymbol) return;
        const key = `${chain.symbol}|${option.expiration}|${option.right}|${option.strike}`;
        map.set(key, option.osiSymbol);
    });
    return map;
}

export async function fetchPublicOptionGreeks(
    osiSymbols: string[],
    config: PublicMarketConfig
): Promise<Map<string, PublicOptionQuote> | null> {
    if (!config.configured) return null;
    const unique = Array.from(new Set(osiSymbols.filter(Boolean)));
    if (!unique.length) return null;
    const query = new URLSearchParams({ osiSymbols: unique.join(",") }).toString();
    const payload = await publicRequest(
        config,
        `/option-details/${config.accountId}/greeks?${query}`
    );
    if (!payload) return null;

    const raw = payload.greeks || payload.data?.greeks || payload.results || [];
    if (!Array.isArray(raw)) return null;

    const map = new Map<string, PublicOptionQuote>();
    raw.forEach((entry: any) => {
        const symbol = String(entry.symbol || entry.osiSymbol || entry?.instrument?.symbol || "").toUpperCase();
        if (!symbol) return;
        const quote = extractQuote(entry);
        map.set(symbol, {
            delta: quote.delta,
            gamma: quote.gamma,
            theta: quote.theta,
            vega: quote.vega
        });
    });
    return map;
}
