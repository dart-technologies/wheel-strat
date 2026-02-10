import { requireIbkrBridge } from "./ibkrGuards";
import { isFunctionsEmulator } from "./runtime";
import { getPublicMarketConfig } from "./publicMarketData";
import { IbkrMarketDataProvider } from "./marketDataProviderIbkr";
import { PublicMarketDataProvider } from "./marketDataProviderPublic";
import {
    FallbackMarketDataProvider,
    HistoricalMarketDataProvider,
    MockMarketDataProvider,
    UnconfiguredMarketDataProvider
} from "./marketDataProviderFallback";
import { fetchOptionQuote } from "./marketDataProviderOptionQuote";
import type {
    MarketDataMode,
    MarketDataProvider,
    MarketSnapshot,
    OptionQuote
} from "./marketDataProviderTypes";

export type { MarketDataProvider, MarketSnapshot, OptionQuote, MarketDataMode };
export { fetchOptionQuote };

function normalizeMarketMode(value?: string): MarketDataMode | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "public") return "public";
    if (normalized === "ibkr") return "ibkr";
    if (normalized === "mock") return "mock";
    if (normalized === "historical" || normalized === "last" || normalized === "last-known") return "historical";
    if (normalized === "live") return "live";
    return undefined;
}

export function getMarketDataProvider(modeOverride?: string): MarketDataProvider {
    const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured } = requireIbkrBridge();
    const publicConfig = getPublicMarketConfig();
    const mode = normalizeMarketMode(modeOverride)
        || normalizeMarketMode(process.env.MARATHON_MARKET_MODE)
        || normalizeMarketMode(process.env.MARKET_DATA_PROVIDER);
    const publicProvider = publicConfig.configured ? new PublicMarketDataProvider(publicConfig) : null;
    const ibkrProvider = bridgeUrlConfigured ? new IbkrMarketDataProvider(bridgeUrl, bridgeApiKey) : null;

    if (mode === "mock") return new MockMarketDataProvider();
    if (mode === "historical") return new HistoricalMarketDataProvider();
    if (!mode && (process.env.NODE_ENV === "test" || isFunctionsEmulator())) return new MockMarketDataProvider();

    if (mode === "public") {
        if (publicProvider && ibkrProvider) return new FallbackMarketDataProvider(publicProvider, ibkrProvider);
        if (publicProvider) return publicProvider;
        if (ibkrProvider) return ibkrProvider;
        return new UnconfiguredMarketDataProvider();
    }

    if (mode === "ibkr" || mode === "live") {
        if (!ibkrProvider) return new UnconfiguredMarketDataProvider();
        return ibkrProvider;
    }

    if (!mode) {
        if (publicProvider && ibkrProvider) return new FallbackMarketDataProvider(publicProvider, ibkrProvider);
        if (publicProvider) return publicProvider;
        if (ibkrProvider) return ibkrProvider;
        return new UnconfiguredMarketDataProvider();
    }

    return new UnconfiguredMarketDataProvider();
}
