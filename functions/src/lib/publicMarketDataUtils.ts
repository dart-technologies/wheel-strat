import type { PublicOptionChain, PublicOptionContract, PublicOptionQuote } from "./publicMarketDataTypes";

export function toNumber(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeExpiration(value: any): string | null {
    if (!value) return null;
    let exp = String(value);
    if (exp.includes("T")) exp = exp.split("T")[0];
    exp = exp.replace(/-/g, "");
    if (exp.length !== 8) return null;
    return exp;
}

export function formatExpirationRequest(exp: string): string {
    if (exp.length === 8) {
        return `${exp.slice(0, 4)}-${exp.slice(4, 6)}-${exp.slice(6, 8)}`;
    }
    return exp;
}

export function normalizeRight(value: any): "C" | "P" | null {
    if (!value) return null;
    const raw = String(value).toUpperCase();
    if (raw.startsWith("P")) return "P";
    if (raw.startsWith("C")) return "C";
    if (raw.includes("PUT")) return "P";
    if (raw.includes("CALL")) return "C";
    return null;
}

type OsiParseResult = {
    root: string;
    expiration: string;
    strike: number;
    right: "C" | "P";
};

export function parseOsiSymbol(raw?: string | null): OsiParseResult | null {
    if (!raw) return null;
    const cleaned = String(raw).toUpperCase().replace(/\s+/g, "");
    const match = cleaned.match(/^([A-Z0-9]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    if (!match) return null;
    const root = match[1];
    const year = Number(match[2]);
    const expYear = year >= 70 ? 1900 + year : 2000 + year;
    const expiration = `${expYear}${match[3]}${match[4]}`;
    const strike = Number(match[6]) / 1000;
    const right = match[5] as "C" | "P";
    return { root, expiration, strike, right };
}

function extractGreeks(value: any) {
    const greeks = value?.greeks || value?.greek || {};
    return {
        delta: toNumber(greeks.delta ?? greeks.Delta ?? value?.delta ?? value?.Delta),
        gamma: toNumber(greeks.gamma ?? greeks.Gamma ?? value?.gamma ?? value?.Gamma),
        theta: toNumber(greeks.theta ?? greeks.Theta ?? value?.theta ?? value?.Theta),
        vega: toNumber(greeks.vega ?? greeks.Vega ?? value?.vega ?? value?.Vega),
    };
}

export function extractQuote(value: any): PublicOptionQuote {
    const quote = value?.quote || value?.marketData || value || {};
    const greeks = extractGreeks(value);
    return {
        bid: toNumber(quote.bid ?? quote.bidPrice ?? quote.Bid),
        ask: toNumber(quote.ask ?? quote.askPrice ?? quote.Ask),
        last: toNumber(quote.last ?? quote.lastPrice ?? quote.Last),
        close: toNumber(quote.close ?? quote.prevClose ?? quote.previousClose ?? quote.Close),
        modelOptPrice: toNumber(quote.modelOptPrice ?? quote.modelPrice ?? quote.ModelPrice),
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
    };
}

export function parseOptionChain(symbol: string, payload: any): PublicOptionChain | null {
    const chain = payload.optionChain || payload.chain || payload.data?.optionChain || payload;
    if (!chain) return null;

    const baseSymbol = String(chain.baseSymbol || chain.symbol || symbol).toUpperCase();
    const calls = Array.isArray(chain.calls) ? chain.calls : [];
    const puts = Array.isArray(chain.puts) ? chain.puts : [];
    const hasCallsPuts = calls.length > 0 || puts.length > 0;

    const rawOptions = chain.options || chain.optionSeries || chain.contracts || chain.optionContracts;
    const optionsList = Array.isArray(rawOptions) ? rawOptions : [];
    const expirations = chain.expirations || chain.expirationDates || chain.expirationDate;
    const strikes = chain.strikes || chain.strikePrices || chain.strikePrice;

    const normalizedExpirations = (Array.isArray(expirations) ? expirations : [expirations])
        .map((exp) => normalizeExpiration(exp))
        .filter((exp): exp is string => Boolean(exp));
    const normalizedStrikes = (Array.isArray(strikes) ? strikes : [strikes])
        .map((strike) => toNumber(strike))
        .filter((strike): strike is number => typeof strike === "number" && Number.isFinite(strike));

    const options: PublicOptionContract[] = [];
    if (hasCallsPuts) {
        const parseSide = (items: any[], rightHint: "C" | "P") => {
            items.forEach((option) => {
                const osiRaw = option?.instrument?.symbol || option?.symbol;
                const parsed = parseOsiSymbol(osiRaw);
                const expiration = parsed?.expiration || normalizeExpiration(option?.expirationDate || option?.expiration);
                const strike = parsed?.strike ?? toNumber(option?.strike);
                const right = parsed?.right || normalizeRight(option?.right) || rightHint;
                if (!expiration || typeof strike !== 'number' || !right) return;
                const quote = extractQuote(option);
                options.push({
                    symbol: baseSymbol,
                    expiration,
                    strike,
                    right,
                    osiSymbol: osiRaw ? String(osiRaw) : undefined,
                    quote,
                });
            });
        };
        parseSide(calls, "C");
        parseSide(puts, "P");
    } else if (optionsList.length) {
        optionsList.forEach((option) => {
            const expiration = normalizeExpiration(
                option.expirationDate
                || option.expiration
                || option.expirationDateTime
                || option.expiration_datetime
            );
            const strike = toNumber(option.strike ?? option.strikePrice ?? option.strike_price);
            const right = normalizeRight(option.right ?? option.putCall ?? option.optionType ?? option.callPut);
            if (!expiration || typeof strike !== 'number' || !right) return;
            const quote = extractQuote(option);
            options.push({
                symbol: baseSymbol,
                expiration,
                strike,
                right,
                osiSymbol: option.osiSymbol ? String(option.osiSymbol) : undefined,
                quote,
            });
        });
    }

    const derivedExpirations = normalizedExpirations.length
        ? normalizedExpirations
        : Array.from(new Set(options.map((option) => option.expiration)));
    const derivedStrikes = normalizedStrikes.length
        ? normalizedStrikes
        : Array.from(new Set(options.map((option) => option.strike)));

    const underlyingPrice = toNumber(
        chain.underlyingPrice
        || chain.underlyingPriceDecimal
        || chain.underlying?.price
        || chain.underlying?.last
        || chain.underlying?.lastPrice
        || chain.underlying?.close
        || chain.underlying?.previousClose
        || chain.underlying?.bid
    );

    return {
        symbol: baseSymbol,
        expirations: derivedExpirations.sort(),
        strikes: derivedStrikes.sort((a, b) => a - b),
        options,
        underlyingPrice
    };
}
