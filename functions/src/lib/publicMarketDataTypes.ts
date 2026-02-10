export type PublicMarketConfig = {
    apiKey: string;
    apiSecret?: string;
    gateway: string;
    accountId: string;
    configured: boolean;
};

export type PublicEquityQuote = {
    symbol: string;
    bid?: number;
    ask?: number;
    last?: number;
    close?: number;
};

export type PublicOptionQuote = {
    bid?: number;
    ask?: number;
    last?: number;
    close?: number;
    modelOptPrice?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
};

export type PublicOptionContract = {
    symbol: string;
    expiration: string;
    strike: number;
    right: "C" | "P";
    osiSymbol?: string;
    quote: PublicOptionQuote;
};

export type PublicOptionChain = {
    symbol: string;
    expirations: string[];
    strikes: number[];
    options: PublicOptionContract[];
    underlyingPrice?: number;
};
